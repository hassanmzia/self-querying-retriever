"""
WebSocket consumers for the retriever application.

Provides real-time updates on query progress and pipeline execution.
"""

import json
import logging

from channels.generic.websocket import AsyncJsonWebsocketConsumer

logger = logging.getLogger(__name__)


class QueryConsumer(AsyncJsonWebsocketConsumer):
    """Streams updates for a specific query execution."""

    async def connect(self):
        self.query_id = self.scope["url_route"]["kwargs"]["query_id"]
        self.group_name = f"query_{self.query_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "connected", "query_id": self.query_id})

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        """Handle incoming messages (e.g. cancel requests)."""
        msg_type = content.get("type")
        if msg_type == "cancel":
            await self.send_json(
                {"type": "cancelled", "query_id": self.query_id}
            )

    # Group message handlers -------------------------------------------------

    async def query_progress(self, event):
        """Forward progress updates to the client."""
        await self.send_json(event)

    async def query_result(self, event):
        """Forward final results to the client."""
        await self.send_json(event)

    async def query_error(self, event):
        """Forward error information to the client."""
        await self.send_json(event)


class PipelineConsumer(AsyncJsonWebsocketConsumer):
    """Streams pipeline-level status for all active queries."""

    async def connect(self):
        self.group_name = "pipeline_updates"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "connected", "channel": "pipeline"})

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def pipeline_update(self, event):
        """Forward pipeline status update to connected clients."""
        await self.send_json(event)
