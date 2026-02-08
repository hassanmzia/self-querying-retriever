"""
Django admin registration for the documents application.
"""

from django.contrib import admin

from .models import DocumentCollection, UploadBatch


@admin.register(DocumentCollection)
class DocumentCollectionAdmin(admin.ModelAdmin):
    list_display = ["name", "description_short", "created_at", "updated_at"]
    search_fields = ["name", "description"]
    readonly_fields = ["id", "created_at", "updated_at"]

    @admin.display(description="Description")
    def description_short(self, obj):
        return obj.description[:80] + ("..." if len(obj.description) > 80 else "")


@admin.register(UploadBatch)
class UploadBatchAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "collection",
        "status",
        "processed_docs",
        "total_docs",
        "progress_pct",
        "created_at",
    ]
    list_filter = ["status", "created_at"]
    readonly_fields = ["id", "created_at", "completed_at"]

    @admin.display(description="Progress")
    def progress_pct(self, obj):
        return f"{obj.progress_pct}%"
