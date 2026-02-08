"""
A2A Task Router for the Self-Querying Retriever.

The ``AgentRouter`` inspects an incoming task and decides which agent
(or agents) should handle it, based on the task's stated capability
requirements, the requested method, or explicit agent targeting.
"""

from __future__ import annotations

import logging
from typing import Any

from .agent_card import AgentCard, AGENT_CARDS, get_all_agent_cards

logger = logging.getLogger("retriever.a2a.router")


# ---------------------------------------------------------------------------
# Capability  ->  agent mapping (built once at import time)
# ---------------------------------------------------------------------------

_CAPABILITY_INDEX: dict[str, list[str]] = {}


def _rebuild_capability_index() -> None:
    """(Re-)build the reverse index from capability to agent names."""
    _CAPABILITY_INDEX.clear()
    for name, card in AGENT_CARDS.items():
        for cap in card.capabilities:
            _CAPABILITY_INDEX.setdefault(cap, []).append(name)


_rebuild_capability_index()


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

class AgentRouter:
    """
    Routes incoming A2A tasks to the most appropriate agent.

    Routing priority
    ~~~~~~~~~~~~~~~~
    1. **Explicit target** -- if the task payload contains a ``"target_agent"``
       key, the task is routed directly to that agent.
    2. **Capability match** -- if the payload contains a ``"capability"`` key,
       all agents advertising that capability are considered.  The first
       active match wins.
    3. **Method match** -- if the payload contains a ``"method"`` key, agents
       whose ``supported_methods`` include it are considered.
    4. **Fallback** -- the Supervisor agent handles anything unmatched.
    """

    # ------------------------------------------------------------------
    # Main routing entry-point
    # ------------------------------------------------------------------

    @staticmethod
    def route_task(task: dict[str, Any]) -> AgentCard:
        """
        Determine which agent should handle *task* and return its card.

        Parameters
        ----------
        task : dict
            Must contain at least one routing hint: ``target_agent``,
            ``capability``, or ``method``.

        Returns
        -------
        AgentCard
            The selected agent's card.

        Raises
        ------
        ValueError
            If no suitable agent can be found.
        """
        # 1. Explicit target ---------------------------------------------------
        target_name: str | None = task.get("target_agent")
        if target_name:
            card = AGENT_CARDS.get(target_name)
            if card and card.status == "active":
                logger.info("Routed to explicit target: %s", target_name)
                return card
            logger.warning(
                "Explicit target '%s' not found or inactive; falling through",
                target_name,
            )

        # 2. Capability match --------------------------------------------------
        capability: str | None = task.get("capability")
        if capability:
            card = AgentRouter.get_agent_by_capability(capability)
            if card:
                logger.info(
                    "Routed by capability '%s' to %s", capability, card.name
                )
                return card

        # 3. Method match ------------------------------------------------------
        method: str | None = task.get("method")
        if method:
            for card in AGENT_CARDS.values():
                if method in card.supported_methods and card.status == "active":
                    logger.info(
                        "Routed by method '%s' to %s", method, card.name
                    )
                    return card

        # 4. Fallback to Supervisor --------------------------------------------
        supervisor = AGENT_CARDS.get("Supervisor")
        if supervisor:
            logger.info("No specific route matched; falling back to Supervisor")
            return supervisor

        raise ValueError(
            f"Cannot route task: no matching agent and Supervisor unavailable. "
            f"Task keys: {list(task.keys())}"
        )

    # ------------------------------------------------------------------
    # Capability look-up
    # ------------------------------------------------------------------

    @staticmethod
    def get_agent_by_capability(capability: str) -> AgentCard | None:
        """
        Return the first *active* agent that advertises *capability*,
        or ``None`` if no match is found.
        """
        agent_names = _CAPABILITY_INDEX.get(capability, [])
        for name in agent_names:
            card = AGENT_CARDS.get(name)
            if card and card.status == "active":
                return card
        return None

    @staticmethod
    def get_agents_by_capability(capability: str) -> list[AgentCard]:
        """Return *all* active agents that advertise *capability*."""
        agent_names = _CAPABILITY_INDEX.get(capability, [])
        return [
            AGENT_CARDS[name]
            for name in agent_names
            if name in AGENT_CARDS and AGENT_CARDS[name].status == "active"
        ]

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    @staticmethod
    def get_all_agent_cards() -> list[AgentCard]:
        """Return every registered agent card."""
        return get_all_agent_cards()

    @staticmethod
    def get_active_agents() -> list[AgentCard]:
        """Return only the currently active agent cards."""
        return [c for c in AGENT_CARDS.values() if c.status == "active"]

    @staticmethod
    def get_agents_by_stage(stage: str) -> list[AgentCard]:
        """
        Return agents whose ``metadata["pipeline_stage"]`` equals *stage*.

        Common stages: ``preprocessing``, ``retrieval``, ``postprocessing``,
        ``generation``, ``orchestration``.
        """
        return [
            card
            for card in AGENT_CARDS.values()
            if card.metadata.get("pipeline_stage") == stage
               and card.status == "active"
        ]
