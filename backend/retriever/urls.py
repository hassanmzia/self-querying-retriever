"""
URL patterns for the retriever application.

Registers ViewSets via a DRF router and adds standalone API views.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"documents", views.DocumentViewSet, basename="document")
router.register(r"collections", views.CollectionViewSet, basename="collection")
router.register(r"queries", views.QueryViewSet, basename="query")
router.register(r"pipelines", views.RetrievalPipelineViewSet, basename="pipeline")
router.register(
    r"agent-executions", views.AgentExecutionViewSet, basename="agent-execution"
)

urlpatterns = [
    # Standalone views must come before the router include so that
    # explicit paths like agent-executions/graph/ are matched before
    # the router's <pk> catch-all pattern.
    path("query/", views.QueryAPIView.as_view(), name="query-api"),
    path("health/", views.HealthCheckView.as_view(), name="health-check"),
    path("analytics/", views.AnalyticsView.as_view(), name="retriever-analytics"),
    path(
        "agent-graph/",
        views.AgentGraphView.as_view(),
        name="agent-graph",
    ),
    path(
        "agents/",
        views.AgentListView.as_view(),
        name="agent-list",
    ),
    path("", include(router.urls)),
]
