"""
A2A Protocol implementation for inter-agent communication.

Defines the message envelope, supported message types, and the
``A2AProtocol`` helper class that agents use to exchange tasks,
results, status updates, and capability queries.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from typing import Any

import requests

from .agent_card import AgentCard

logger = logging.getLogger("retriever.a2a.protocol")


# ---------------------------------------------------------------------------
# Message types
# ---------------------------------------------------------------------------

class MessageType(str, Enum):
    """Well-known A2A message types."""

    TASK_REQUEST = "TASK_REQUEST"
    TASK_RESULT = "TASK_RESULT"
    STATUS_UPDATE = "STATUS_UPDATE"
    CAPABILITY_QUERY = "CAPABILITY_QUERY"
    CAPABILITY_RESPONSE = "CAPABILITY_RESPONSE"
    ERROR = "ERROR"


# ---------------------------------------------------------------------------
# Message envelope
# ---------------------------------------------------------------------------

@dataclass
class A2AMessage:
    """
    Immutable envelope for every message exchanged between agents.

    Parameters
    ----------
    sender : str
        Name of the sending agent.
    receiver : str
        Name of the intended recipient agent.
    task_id : str
        Unique identifier for the task / conversation thread.
    message_type : MessageType
        The kind of message (see :class:`MessageType`).
    payload : dict
        Arbitrary JSON-serialisable data.
    timestamp : str
        ISO-8601 timestamp (defaults to *now* in UTC).
    message_id : str
        Unique message identifier (auto-generated UUID-4).
    correlation_id : str | None
        Optional ID linking this message to a previous one.
    """

    sender: str
    receiver: str
    task_id: str
    message_type: MessageType
    payload: dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )
    message_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    correlation_id: str | None = None

    # -- Serialisation helpers -----------------------------------------------

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["message_type"] = self.message_type.value
        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "A2AMessage":
        data = dict(data)  # shallow copy
        raw_type = data.pop("message_type", "TASK_REQUEST")
        message_type = MessageType(raw_type)
        return cls(message_type=message_type, **data)

    # -- Convenience constructors -------------------------------------------

    @classmethod
    def task_request(
        cls,
        sender: str,
        receiver: str,
        task_id: str,
        payload: dict[str, Any],
        *,
        correlation_id: str | None = None,
    ) -> "A2AMessage":
        return cls(
            sender=sender,
            receiver=receiver,
            task_id=task_id,
            message_type=MessageType.TASK_REQUEST,
            payload=payload,
            correlation_id=correlation_id,
        )

    @classmethod
    def task_result(
        cls,
        sender: str,
        receiver: str,
        task_id: str,
        payload: dict[str, Any],
        *,
        correlation_id: str | None = None,
    ) -> "A2AMessage":
        return cls(
            sender=sender,
            receiver=receiver,
            task_id=task_id,
            message_type=MessageType.TASK_RESULT,
            payload=payload,
            correlation_id=correlation_id,
        )

    @classmethod
    def error(
        cls,
        sender: str,
        receiver: str,
        task_id: str,
        error_message: str,
        *,
        correlation_id: str | None = None,
    ) -> "A2AMessage":
        return cls(
            sender=sender,
            receiver=receiver,
            task_id=task_id,
            message_type=MessageType.ERROR,
            payload={"error": error_message},
            correlation_id=correlation_id,
        )


# ---------------------------------------------------------------------------
# Protocol helper
# ---------------------------------------------------------------------------

# Simple in-memory store for task results (swap for Redis in production).
_task_results: dict[str, A2AMessage] = {}
_task_statuses: dict[str, dict[str, Any]] = {}

_REQUEST_TIMEOUT_SECONDS = 30


class A2AProtocol:
    """
    High-level helpers for sending / receiving A2A messages.

    The current implementation uses synchronous HTTP POST calls between
    agents.  A production deployment could substitute WebSocket or a
    message broker without changing the public API.
    """

    # ------------------------------------------------------------------
    # Sending tasks
    # ------------------------------------------------------------------

    @staticmethod
    def send_task(agent_card: AgentCard, task: dict[str, Any]) -> A2AMessage:
        """
        Send a TASK_REQUEST to the agent described by *agent_card*.

        Returns the TASK_RESULT or ERROR response message.
        """
        task_id = task.get("task_id", str(uuid.uuid4()))

        message = A2AMessage.task_request(
            sender=task.get("sender", "Supervisor"),
            receiver=agent_card.name,
            task_id=task_id,
            payload=task,
        )

        logger.info(
            "Sending task %s to %s at %s",
            task_id,
            agent_card.name,
            agent_card.endpoint,
        )

        try:
            response = requests.post(
                agent_card.endpoint,
                json=message.to_dict(),
                headers={"Content-Type": "application/json"},
                timeout=_REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()

            result_data = response.json()
            result_message = A2AMessage.from_dict(result_data)

            # Cache the result for later retrieval.
            _task_results[task_id] = result_message
            _task_statuses[task_id] = {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }

            logger.info("Task %s completed by %s", task_id, agent_card.name)
            return result_message

        except requests.exceptions.Timeout:
            logger.error("Timeout sending task %s to %s", task_id, agent_card.name)
            _task_statuses[task_id] = {"status": "timeout"}
            return A2AMessage.error(
                sender="A2AProtocol",
                receiver=task.get("sender", "Supervisor"),
                task_id=task_id,
                error_message=f"Timeout contacting {agent_card.name}",
            )

        except requests.exceptions.ConnectionError as exc:
            logger.error(
                "Connection error sending task %s to %s: %s",
                task_id,
                agent_card.name,
                exc,
            )
            _task_statuses[task_id] = {"status": "connection_error"}
            return A2AMessage.error(
                sender="A2AProtocol",
                receiver=task.get("sender", "Supervisor"),
                task_id=task_id,
                error_message=f"Cannot reach {agent_card.name}: {exc}",
            )

        except requests.exceptions.RequestException as exc:
            logger.error(
                "Request error sending task %s to %s: %s",
                task_id,
                agent_card.name,
                exc,
            )
            _task_statuses[task_id] = {"status": "error", "error": str(exc)}
            return A2AMessage.error(
                sender="A2AProtocol",
                receiver=task.get("sender", "Supervisor"),
                task_id=task_id,
                error_message=str(exc),
            )

    # ------------------------------------------------------------------
    # Receiving results
    # ------------------------------------------------------------------

    @staticmethod
    def receive_result(task_id: str) -> A2AMessage | None:
        """
        Look up a previously received task result by *task_id*.

        Returns ``None`` if the result has not arrived yet.
        """
        return _task_results.get(task_id)

    @staticmethod
    def get_task_status(task_id: str) -> dict[str, Any]:
        """Return the current status dict for *task_id*."""
        return _task_statuses.get(task_id, {"status": "unknown"})

    # ------------------------------------------------------------------
    # Capability negotiation
    # ------------------------------------------------------------------

    @staticmethod
    def negotiate_capability(agent_card: AgentCard) -> A2AMessage:
        """
        Send a CAPABILITY_QUERY to *agent_card* and return the response.
        """
        task_id = str(uuid.uuid4())

        message = A2AMessage(
            sender="Supervisor",
            receiver=agent_card.name,
            task_id=task_id,
            message_type=MessageType.CAPABILITY_QUERY,
            payload={"requested_capabilities": agent_card.capabilities},
        )

        logger.info(
            "Negotiating capabilities with %s at %s",
            agent_card.name,
            agent_card.endpoint,
        )

        try:
            response = requests.post(
                agent_card.endpoint,
                json=message.to_dict(),
                headers={"Content-Type": "application/json"},
                timeout=_REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()

            result_data = response.json()
            return A2AMessage.from_dict(result_data)

        except requests.exceptions.RequestException as exc:
            logger.error(
                "Capability negotiation failed for %s: %s",
                agent_card.name,
                exc,
            )
            return A2AMessage.error(
                sender="A2AProtocol",
                receiver="Supervisor",
                task_id=task_id,
                error_message=f"Capability negotiation failed: {exc}",
            )

    # ------------------------------------------------------------------
    # Status broadcast
    # ------------------------------------------------------------------

    @staticmethod
    def broadcast_status(
        status: dict[str, Any],
        *,
        sender: str = "Supervisor",
        agent_cards: list[AgentCard] | None = None,
    ) -> list[A2AMessage]:
        """
        Broadcast a STATUS_UPDATE to one or more agents.

        If *agent_cards* is ``None`` the status is only logged locally
        (useful for internal bookkeeping without network calls).
        """
        task_id = str(uuid.uuid4())
        responses: list[A2AMessage] = []

        if agent_cards is None:
            logger.info("Status broadcast (local only): %s", status)
            return responses

        for card in agent_cards:
            message = A2AMessage(
                sender=sender,
                receiver=card.name,
                task_id=task_id,
                message_type=MessageType.STATUS_UPDATE,
                payload=status,
            )

            try:
                resp = requests.post(
                    card.endpoint,
                    json=message.to_dict(),
                    headers={"Content-Type": "application/json"},
                    timeout=_REQUEST_TIMEOUT_SECONDS,
                )
                resp.raise_for_status()
                responses.append(A2AMessage.from_dict(resp.json()))
                logger.info("Status delivered to %s", card.name)
            except requests.exceptions.RequestException as exc:
                logger.warning(
                    "Failed to deliver status to %s: %s", card.name, exc
                )
                responses.append(
                    A2AMessage.error(
                        sender="A2AProtocol",
                        receiver=card.name,
                        task_id=task_id,
                        error_message=str(exc),
                    )
                )

        return responses
