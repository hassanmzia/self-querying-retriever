from django.apps import AppConfig


class RetrieverConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "retriever"
    verbose_name = "AI Self-Querying Retriever"

    def ready(self):
        from retriever.services.observability import ObservabilityService

        ObservabilityService.initialize()
