"""
Root URL configuration for the Self-Querying Retriever project.

Routes API requests to the appropriate app-level URL configurations.
"""

from django.contrib import admin
from django.urls import include, path

from retriever.a2a.views import A2ADiscoveryView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/retriever/", include("retriever.urls")),
    path("api/v1/documents/", include("documents.urls")),
    path("api/v1/analytics/", include("analytics.urls")),

    # A2A (Agent-to-Agent) protocol
    path("api/v1/a2a/", include("retriever.a2a.urls")),

    # Standard A2A discovery endpoint
    path(".well-known/agent.json", A2ADiscoveryView.as_view(), name="a2a-well-known"),
]
