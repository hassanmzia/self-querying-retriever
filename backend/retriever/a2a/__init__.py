"""
A2A (Agent-to-Agent) protocol implementation for the Self-Querying Retriever.

This package provides inter-agent communication capabilities following
the Agent-to-Agent protocol specification, including agent discovery,
task routing, and message exchange.
"""

from .agent_card import AgentCard, get_all_agent_cards, get_agent_card_by_name
from .protocol import A2AMessage, A2AProtocol, MessageType
from .router import AgentRouter

__all__ = [
    "AgentCard",
    "get_all_agent_cards",
    "get_agent_card_by_name",
    "A2AMessage",
    "A2AProtocol",
    "MessageType",
    "AgentRouter",
]
