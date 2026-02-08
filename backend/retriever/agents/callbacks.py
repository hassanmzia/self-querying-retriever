"""
Custom callback handlers for the multi-agent retrieval pipeline.

Provides three handlers:
- ``LangFuseCallbackHandler`` -- pushes traces to LangFuse for observability.
- ``AgentExecutionLogger``   -- logs execution events to a Django model.
- ``StreamingCallbackHandler`` -- streams token-level events over WebSockets.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict, List, Optional, Sequence, Union
from uuid import UUID

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.documents import Document
from langchain_core.outputs import LLMResult

logger = logging.getLogger(__name__)


# ===================================================================
# 1. LangFuse callback handler
# ===================================================================

class LangFuseCallbackHandler(BaseCallbackHandler):
    """Forward LangChain callback events to LangFuse for tracing.

    This handler wraps the official ``langfuse`` Python SDK. If the SDK
    is not installed or the environment variables are not set the handler
    degrades gracefully and logs a warning.
    """

    def __init__(
        self,
        trace_name: str = "retriever_pipeline",
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__()
        self.trace_name = trace_name
        self.session_id = session_id
        self.user_id = user_id
        self.extra_metadata = metadata or {}
        self._langfuse = None
        self._trace = None
        self._spans: Dict[str, Any] = {}

        try:
            from langfuse import Langfuse

            self._langfuse = Langfuse()
            self._trace = self._langfuse.trace(
                name=self.trace_name,
                session_id=self.session_id,
                user_id=self.user_id,
                metadata=self.extra_metadata,
            )
            logger.info(
                "LangFuse tracing initialized (trace=%s)", self.trace_name
            )
        except Exception as exc:
            logger.warning(
                "LangFuse initialization failed -- tracing disabled: %s", exc
            )

    # -- LLM events -----------------------------------------------------

    def on_llm_start(
        self,
        serialized: Dict[str, Any],
        prompts: List[str],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        if self._trace is None:
            return
        try:
            span = self._trace.span(
                name=serialized.get("name", "llm_call"),
                input={"prompts": prompts},
                metadata={"run_id": str(run_id)},
            )
            self._spans[str(run_id)] = span
        except Exception as exc:
            logger.debug("LangFuse on_llm_start error: %s", exc)

    def on_llm_end(
        self,
        response: LLMResult,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        span = self._spans.pop(str(run_id), None)
        if span is None:
            return
        try:
            output_text = ""
            if response.generations:
                output_text = response.generations[0][0].text
            span.end(output={"response": output_text})
        except Exception as exc:
            logger.debug("LangFuse on_llm_end error: %s", exc)

    def on_llm_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        span = self._spans.pop(str(run_id), None)
        if span is None:
            return
        try:
            span.end(output={"error": str(error)}, level="ERROR")
        except Exception as exc:
            logger.debug("LangFuse on_llm_error error: %s", exc)

    # -- Chain events ---------------------------------------------------

    def on_chain_start(
        self,
        serialized: Dict[str, Any],
        inputs: Dict[str, Any],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        if self._trace is None:
            return
        try:
            span = self._trace.span(
                name=serialized.get("name", "chain"),
                input=_safe_serialize(inputs),
                metadata={"run_id": str(run_id)},
            )
            self._spans[str(run_id)] = span
        except Exception as exc:
            logger.debug("LangFuse on_chain_start error: %s", exc)

    def on_chain_end(
        self,
        outputs: Dict[str, Any],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        span = self._spans.pop(str(run_id), None)
        if span is None:
            return
        try:
            span.end(output=_safe_serialize(outputs))
        except Exception as exc:
            logger.debug("LangFuse on_chain_end error: %s", exc)

    def on_chain_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        span = self._spans.pop(str(run_id), None)
        if span is None:
            return
        try:
            span.end(output={"error": str(error)}, level="ERROR")
        except Exception as exc:
            logger.debug("LangFuse on_chain_error error: %s", exc)

    # -- Retriever events -----------------------------------------------

    def on_retriever_start(
        self,
        serialized: Dict[str, Any],
        query: str,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        if self._trace is None:
            return
        try:
            span = self._trace.span(
                name=serialized.get("name", "retriever"),
                input={"query": query},
                metadata={"run_id": str(run_id)},
            )
            self._spans[str(run_id)] = span
        except Exception as exc:
            logger.debug("LangFuse on_retriever_start error: %s", exc)

    def on_retriever_end(
        self,
        documents: Sequence[Document],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        span = self._spans.pop(str(run_id), None)
        if span is None:
            return
        try:
            span.end(
                output={
                    "document_count": len(documents),
                    "documents": [
                        {
                            "content": d.page_content[:200],
                            "metadata": d.metadata,
                        }
                        for d in documents[:5]
                    ],
                }
            )
        except Exception as exc:
            logger.debug("LangFuse on_retriever_end error: %s", exc)

    # -- Flush ----------------------------------------------------------

    def flush(self) -> None:
        """Ensure all buffered events are sent to LangFuse."""
        if self._langfuse is not None:
            try:
                self._langfuse.flush()
            except Exception as exc:
                logger.debug("LangFuse flush error: %s", exc)


# ===================================================================
# 2. Django model execution logger
# ===================================================================

class AgentExecutionLogger(BaseCallbackHandler):
    """Log agent execution events to a Django database model.

    The logger expects a Django model with at least these fields:

    - ``session_id``  (CharField)
    - ``node_name``   (CharField)
    - ``event_type``  (CharField)
    - ``payload``     (JSONField)
    - ``created_at``  (DateTimeField, auto_now_add)

    The model path is configurable via ``model_path`` (dotted import).
    If the model cannot be imported the logger falls back to the Python
    ``logging`` module.
    """

    def __init__(
        self,
        session_id: str,
        model_path: str = "retriever.models.AgentExecutionLog",
    ) -> None:
        super().__init__()
        self.session_id = session_id
        self._model = None

        try:
            module_path, class_name = model_path.rsplit(".", 1)
            import importlib

            module = importlib.import_module(module_path)
            self._model = getattr(module, class_name)
            logger.info(
                "AgentExecutionLogger: using model %s", model_path
            )
        except Exception as exc:
            logger.warning(
                "AgentExecutionLogger: model %s not available, "
                "falling back to Python logging: %s",
                model_path,
                exc,
            )

    def _persist(
        self,
        node_name: str,
        event_type: str,
        payload: Dict[str, Any],
    ) -> None:
        """Write an event record to the database or to the log."""
        if self._model is not None:
            try:
                self._model.objects.create(
                    session_id=self.session_id,
                    node_name=node_name,
                    event_type=event_type,
                    payload=payload,
                )
                return
            except Exception as exc:
                logger.warning(
                    "AgentExecutionLogger DB write failed: %s", exc
                )
        # Fallback: structured log.
        logger.info(
            "AgentExecution | session=%s node=%s event=%s payload=%s",
            self.session_id,
            node_name,
            event_type,
            json.dumps(payload, default=str)[:500],
        )

    # -- LLM events -----------------------------------------------------

    def on_llm_start(
        self,
        serialized: Dict[str, Any],
        prompts: List[str],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        self._persist(
            node_name=serialized.get("name", "llm"),
            event_type="llm_start",
            payload={
                "run_id": str(run_id),
                "prompt_length": sum(len(p) for p in prompts),
            },
        )

    def on_llm_end(
        self,
        response: LLMResult,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        output_text = ""
        if response.generations:
            output_text = response.generations[0][0].text[:500]
        self._persist(
            node_name="llm",
            event_type="llm_end",
            payload={
                "run_id": str(run_id),
                "response_preview": output_text,
            },
        )

    def on_llm_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        self._persist(
            node_name="llm",
            event_type="llm_error",
            payload={"run_id": str(run_id), "error": str(error)},
        )

    # -- Chain events ---------------------------------------------------

    def on_chain_start(
        self,
        serialized: Dict[str, Any],
        inputs: Dict[str, Any],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        self._persist(
            node_name=serialized.get("name", "chain"),
            event_type="chain_start",
            payload={
                "run_id": str(run_id),
                "input_keys": list(inputs.keys()) if isinstance(inputs, dict) else [],
            },
        )

    def on_chain_end(
        self,
        outputs: Dict[str, Any],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        self._persist(
            node_name="chain",
            event_type="chain_end",
            payload={
                "run_id": str(run_id),
                "output_keys": (
                    list(outputs.keys()) if isinstance(outputs, dict) else []
                ),
            },
        )

    def on_chain_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        self._persist(
            node_name="chain",
            event_type="chain_error",
            payload={"run_id": str(run_id), "error": str(error)},
        )


# ===================================================================
# 3. WebSocket streaming handler
# ===================================================================

class StreamingCallbackHandler(BaseCallbackHandler):
    """Stream token-level and node-level events over a Django Channels
    WebSocket consumer.

    The handler expects a *channel layer* and a *group name* so it can
    broadcast events asynchronously via ``async_to_sync``.  When no
    channel layer is provided it logs events instead.
    """

    def __init__(
        self,
        group_name: str,
        channel_layer: Any = None,
    ) -> None:
        super().__init__()
        self.group_name = group_name
        self.channel_layer = channel_layer
        self._async_send = None

        if channel_layer is not None:
            try:
                from asgiref.sync import async_to_sync

                self._async_send = async_to_sync(
                    channel_layer.group_send
                )
            except Exception as exc:
                logger.warning(
                    "StreamingCallbackHandler: channel layer setup "
                    "failed: %s",
                    exc,
                )

    def _send_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """Broadcast an event to the WebSocket group."""
        message = {
            "type": "agent.event",
            "event_type": event_type,
            "data": data,
            "timestamp": time.time(),
        }
        if self._async_send is not None:
            try:
                self._async_send(self.group_name, message)
            except Exception as exc:
                logger.debug(
                    "StreamingCallbackHandler send error: %s", exc
                )
        else:
            logger.info(
                "StreamingEvent | group=%s type=%s data=%s",
                self.group_name,
                event_type,
                json.dumps(data, default=str)[:300],
            )

    # -- Token streaming ------------------------------------------------

    def on_llm_new_token(
        self,
        token: str,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        self._send_event(
            "token",
            {"token": token, "run_id": str(run_id)},
        )

    # -- LLM events -----------------------------------------------------

    def on_llm_start(
        self,
        serialized: Dict[str, Any],
        prompts: List[str],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        self._send_event(
            "llm_start",
            {
                "name": serialized.get("name", "llm"),
                "run_id": str(run_id),
            },
        )

    def on_llm_end(
        self,
        response: LLMResult,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        self._send_event(
            "llm_end",
            {"run_id": str(run_id)},
        )

    def on_llm_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        self._send_event(
            "llm_error",
            {"run_id": str(run_id), "error": str(error)},
        )

    # -- Chain events ---------------------------------------------------

    def on_chain_start(
        self,
        serialized: Dict[str, Any],
        inputs: Dict[str, Any],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        self._send_event(
            "chain_start",
            {
                "name": serialized.get("name", "chain"),
                "run_id": str(run_id),
            },
        )

    def on_chain_end(
        self,
        outputs: Dict[str, Any],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        self._send_event(
            "chain_end",
            {"run_id": str(run_id)},
        )

    def on_chain_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        self._send_event(
            "chain_error",
            {"run_id": str(run_id), "error": str(error)},
        )

    # -- Retriever events -----------------------------------------------

    def on_retriever_start(
        self,
        serialized: Dict[str, Any],
        query: str,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        self._send_event(
            "retriever_start",
            {
                "name": serialized.get("name", "retriever"),
                "query": query,
                "run_id": str(run_id),
            },
        )

    def on_retriever_end(
        self,
        documents: Sequence[Document],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        self._send_event(
            "retriever_end",
            {
                "run_id": str(run_id),
                "document_count": len(documents),
            },
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_serialize(obj: Any) -> Any:
    """Convert an object to a JSON-safe form, truncating large values."""
    try:
        serialized = json.loads(json.dumps(obj, default=str))
        return serialized
    except Exception:
        return str(obj)[:500]
