"""
Django REST Framework views for the A2A protocol endpoints.

Provides agent card discovery, task submission, and task status
tracking over a standard HTTP JSON API.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .agent_card import (
    AgentCard,
    get_all_agent_cards,
    get_agent_card_by_name,
    get_discovery_document,
)
from .protocol import A2AMessage, A2AProtocol, MessageType
from .router import AgentRouter

logger = logging.getLogger("retriever.a2a.views")


# ---------------------------------------------------------------------------
# Agent card endpoints
# ---------------------------------------------------------------------------

class AgentCardListView(APIView):
    """
    GET /api/v1/a2a/agents/

    Return the full list of registered agent cards.
    """

    def get(self, request: Request) -> Response:
        cards = get_all_agent_cards()

        # Optional query-string filters
        agent_type = request.query_params.get("type")
        stage = request.query_params.get("stage")
        capability = request.query_params.get("capability")

        if agent_type:
            cards = [c for c in cards if c.agent_type == agent_type]
        if stage:
            cards = [
                c for c in cards if c.metadata.get("pipeline_stage") == stage
            ]
        if capability:
            cards = [c for c in cards if capability in c.capabilities]

        return Response(
            {
                "count": len(cards),
                "agents": [card.to_json_schema() for card in cards],
            },
            status=status.HTTP_200_OK,
        )


class AgentCardDetailView(APIView):
    """
    GET /api/v1/a2a/agents/<agent_name>/

    Return the agent card for a specific agent.
    """

    def get(self, request: Request, agent_name: str) -> Response:
        card = get_agent_card_by_name(agent_name)

        if card is None:
            return Response(
                {"error": f"Agent '{agent_name}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(card.to_json_schema(), status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Task submission
# ---------------------------------------------------------------------------

class TaskSubmitView(APIView):
    """
    POST /api/v1/a2a/agents/<agent_name>/tasks/

    Submit a task to a specific agent.  The request body is the task
    payload; the view wraps it in an :class:`A2AMessage` envelope and
    delegates to the appropriate agent.

    Expected body::

        {
            "query": "...",
            "method": "vector",       // optional routing hint
            "capability": "...",      // optional routing hint
            "parameters": { ... }     // agent-specific params
        }
    """

    def post(self, request: Request, agent_name: str) -> Response:
        card = get_agent_card_by_name(agent_name)

        if card is None:
            return Response(
                {"error": f"Agent '{agent_name}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        payload: dict[str, Any] = request.data  # type: ignore[assignment]
        task_id = payload.get("task_id", str(uuid.uuid4()))

        # Build response message (in a real deployment this would invoke the
        # agent logic asynchronously; here we acknowledge receipt).
        response_message = A2AMessage.task_result(
            sender=agent_name,
            receiver=payload.get("sender", "client"),
            task_id=task_id,
            payload={
                "status": "accepted",
                "agent": agent_name,
                "task_id": task_id,
                "message": (
                    f"Task accepted by {agent_name}. "
                    f"Processing with capabilities: "
                    f"{', '.join(card.capabilities)}."
                ),
            },
        )

        logger.info("Task %s submitted to agent %s", task_id, agent_name)

        return Response(
            response_message.to_dict(),
            status=status.HTTP_202_ACCEPTED,
        )


# ---------------------------------------------------------------------------
# Task status
# ---------------------------------------------------------------------------

class TaskStatusView(APIView):
    """
    GET /api/v1/a2a/tasks/<task_id>/status/

    Return the current status of a previously submitted task.
    """

    def get(self, request: Request, task_id: str) -> Response:
        task_status = A2AProtocol.get_task_status(task_id)

        if task_status.get("status") == "unknown":
            return Response(
                {
                    "task_id": task_id,
                    "status": "unknown",
                    "message": "Task not found. It may have expired or never existed.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Try to include the result payload if available.
        result = A2AProtocol.receive_result(task_id)

        response_data: dict[str, Any] = {
            "task_id": task_id,
            **task_status,
        }
        if result is not None:
            response_data["result"] = result.to_dict()

        return Response(response_data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Route task (automatic routing)
# ---------------------------------------------------------------------------

class TaskRouteView(APIView):
    """
    POST /api/v1/a2a/tasks/route/

    Submit a task and let the router decide which agent handles it.

    The body must contain at least one routing hint (``target_agent``,
    ``capability``, or ``method``).
    """

    def post(self, request: Request) -> Response:
        payload: dict[str, Any] = request.data  # type: ignore[assignment]

        try:
            card = AgentRouter.route_task(payload)
        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        task_id = payload.get("task_id", str(uuid.uuid4()))

        response_message = A2AMessage.task_result(
            sender=card.name,
            receiver=payload.get("sender", "client"),
            task_id=task_id,
            payload={
                "status": "routed",
                "routed_to": card.name,
                "task_id": task_id,
                "agent_endpoint": card.endpoint,
                "message": f"Task routed to {card.name}.",
            },
        )

        logger.info("Task %s routed to %s", task_id, card.name)

        return Response(
            response_message.to_dict(),
            status=status.HTTP_202_ACCEPTED,
        )


# ---------------------------------------------------------------------------
# .well-known discovery
# ---------------------------------------------------------------------------

class A2ADiscoveryView(APIView):
    """
    GET /.well-known/agent.json

    Standard A2A discovery endpoint.  Returns a JSON document describing
    the service, its agents, and protocol details.
    """

    def get(self, request: Request) -> Response:
        return Response(
            get_discovery_document(),
            status=status.HTTP_200_OK,
        )
