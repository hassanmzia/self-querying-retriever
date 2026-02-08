"""
Root URL configuration for the Self-Querying Retriever project.

Routes API requests to the appropriate app-level URL configurations.
"""

from django.contrib import admin
from django.urls import include, path

from retriever.a2a.views import A2ADiscoveryView
from retriever.views import AgentGraphView, AgentListView

urlpatterns = [
    path("admin/", admin.site.urls),

    # Agent endpoints must be before the retriever include to avoid
    # router's <pk> catch-all matching "graph" as a primary key.
    path(
        "api/v1/retriever/agent-graph/",
        AgentGraphView.as_view(),
        name="agent-graph-root",
    ),
    path(
        "api/v1/retriever/agents/",
        AgentListView.as_view(),
        name="agent-list",
    ),

    path("api/v1/retriever/", include("retriever.urls")),
    path("api/v1/documents/", include("documents.urls")),
    path("api/v1/analytics/", include("analytics.urls")),

    # A2A (Agent-to-Agent) protocol
    path("api/v1/a2a/", include("retriever.a2a.urls")),

    # Standard A2A discovery endpoint
    path(".well-known/agent.json", A2ADiscoveryView.as_view(), name="a2a-well-known"),
]
