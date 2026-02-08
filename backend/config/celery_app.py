"""
Celery application configuration for the Self-Querying Retriever project.

Uses Redis as the message broker and Django DB for result storage.
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("self_querying_retriever")

# Read config from Django settings, using the CELERY_ namespace.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks in all installed apps.
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Simple debug task that prints its own request info."""
    print(f"Request: {self.request!r}")
