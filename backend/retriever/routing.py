"""
WebSocket URL routing for the retriever application.

Provides a real-time channel for streaming query progress and results.
"""

from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/query/(?P<query_id>[0-9a-f-]+)/$", consumers.QueryConsumer.as_asgi()),
    re_path(r"ws/pipeline/$", consumers.PipelineConsumer.as_asgi()),
]
