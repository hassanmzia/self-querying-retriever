"""
URL patterns for the A2A (Agent-to-Agent) protocol endpoints.

These are included under ``/api/v1/a2a/`` in the root URL configuration.
The ``.well-known/agent.json`` discovery endpoint is mounted separately
at the project root.
"""

from django.urls import path

from .views import (
    AgentCardListView,
    AgentCardDetailView,
    TaskSubmitView,
    TaskStatusView,
    TaskRouteView,
    A2ADiscoveryView,
)

app_name = "a2a"

urlpatterns = [
    # Agent card discovery
    path(
        "agents/",
        AgentCardListView.as_view(),
        name="agent-card-list",
    ),
    path(
        "agents/<str:agent_name>/",
        AgentCardDetailView.as_view(),
        name="agent-card-detail",
    ),

    # Task submission to a specific agent
    path(
        "agents/<str:agent_name>/tasks/",
        TaskSubmitView.as_view(),
        name="task-submit",
    ),

    # Task status lookup
    path(
        "tasks/<str:task_id>/status/",
        TaskStatusView.as_view(),
        name="task-status",
    ),

    # Automatic task routing
    path(
        "tasks/route/",
        TaskRouteView.as_view(),
        name="task-route",
    ),

    # A2A discovery document (also mountable at /.well-known/agent.json)
    path(
        "discovery/",
        A2ADiscoveryView.as_view(),
        name="a2a-discovery",
    ),
]
