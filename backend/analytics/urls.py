"""
URL patterns for the analytics application.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(
    r"query-analytics",
    views.QueryAnalyticsViewSet,
    basename="query-analytics",
)
router.register(
    r"system-metrics",
    views.SystemMetricsViewSet,
    basename="system-metrics",
)

urlpatterns = [
    path("", include(router.urls)),
    path("dashboard/", views.DashboardStatsView.as_view(), name="dashboard-stats"),
    path("trends/", views.QueryTrendsView.as_view(), name="query-trends"),
    path("methods/", views.MethodComparisonView.as_view(), name="method-comparison"),
    path("feedback/", views.UserFeedbackView.as_view(), name="user-feedback"),
    path("export/", views.ExportAnalyticsView.as_view(), name="export-analytics"),
]
