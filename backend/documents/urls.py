"""
URL patterns for the documents application.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(
    r"collections",
    views.DocumentCollectionViewSet,
    basename="doc-collection",
)
router.register(
    r"batches",
    views.UploadBatchViewSet,
    basename="upload-batch",
)

urlpatterns = [
    path("", include(router.urls)),
    path("upload/", views.DocumentUploadView.as_view(), name="document-upload"),
    path(
        "upload/bulk/",
        views.BulkDocumentUploadView.as_view(),
        name="bulk-document-upload",
    ),
    path(
        "preview/<uuid:document_id>/",
        views.DocumentPreviewView.as_view(),
        name="document-preview",
    ),
]
