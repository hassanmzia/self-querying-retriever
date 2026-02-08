"""
LangSmith and LangFuse observability integration.

Provides unified tracing and monitoring for all LLM operations,
agent executions, and retrieval pipelines.
"""
import logging
import os
import time
from contextlib import contextmanager
from functools import wraps
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class LangSmithService:
    """LangSmith tracing integration."""

    _initialized = False

    @classmethod
    def initialize(cls):
        """Initialize LangSmith tracing."""
        if cls._initialized:
            return

        api_key = os.environ.get("LANGCHAIN_API_KEY")
        if not api_key:
            logger.warning("LANGCHAIN_API_KEY not set, LangSmith tracing disabled")
            return

        os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
        os.environ.setdefault("LANGCHAIN_PROJECT", "self-querying-retriever")
        os.environ.setdefault(
            "LANGCHAIN_ENDPOINT", "https://api.smith.langchain.com"
        )

        cls._initialized = True
        logger.info(
            "LangSmith tracing initialized for project: %s",
            os.environ.get("LANGCHAIN_PROJECT"),
        )

    @classmethod
    def is_enabled(cls) -> bool:
        return cls._initialized

    @classmethod
    def get_run_url(cls, run_id: str) -> Optional[str]:
        """Get the LangSmith URL for a run."""
        if not cls._initialized:
            return None
        project = os.environ.get("LANGCHAIN_PROJECT", "default")
        return f"https://smith.langchain.com/o/default/projects/p/{project}/r/{run_id}"


class LangFuseService:
    """LangFuse observability integration."""

    _client = None
    _initialized = False

    @classmethod
    def initialize(cls):
        """Initialize LangFuse client."""
        if cls._initialized:
            return

        public_key = os.environ.get("LANGFUSE_PUBLIC_KEY")
        secret_key = os.environ.get("LANGFUSE_SECRET_KEY")
        host = os.environ.get("LANGFUSE_HOST", "http://langfuse:3085")

        if not public_key or not secret_key:
            logger.warning(
                "LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY not set, "
                "LangFuse tracing disabled"
            )
            return

        try:
            from langfuse import Langfuse

            cls._client = Langfuse(
                public_key=public_key,
                secret_key=secret_key,
                host=host,
            )
            cls._initialized = True
            logger.info("LangFuse initialized with host: %s", host)
        except ImportError:
            logger.warning("langfuse package not installed")
        except Exception as e:
            logger.error("Failed to initialize LangFuse: %s", e)

    @classmethod
    def is_enabled(cls) -> bool:
        return cls._initialized and cls._client is not None

    @classmethod
    def get_client(cls):
        """Get the LangFuse client instance."""
        if not cls._initialized:
            cls.initialize()
        return cls._client

    @classmethod
    def create_trace(
        cls,
        name: str,
        metadata: Optional[Dict] = None,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ):
        """Create a new LangFuse trace."""
        if not cls.is_enabled():
            return None

        try:
            trace = cls._client.trace(
                name=name,
                metadata=metadata or {},
                user_id=user_id,
                session_id=session_id,
                tags=tags or [],
            )
            return trace
        except Exception as e:
            logger.error("Failed to create LangFuse trace: %s", e)
            return None

    @classmethod
    def create_span(
        cls,
        trace,
        name: str,
        input_data: Optional[Dict] = None,
        metadata: Optional[Dict] = None,
    ):
        """Create a span within a trace."""
        if trace is None:
            return None

        try:
            span = trace.span(
                name=name,
                input=input_data,
                metadata=metadata or {},
            )
            return span
        except Exception as e:
            logger.error("Failed to create LangFuse span: %s", e)
            return None

    @classmethod
    def create_generation(
        cls,
        trace,
        name: str,
        model: str,
        input_data: Optional[Any] = None,
        output_data: Optional[Any] = None,
        metadata: Optional[Dict] = None,
        usage: Optional[Dict] = None,
    ):
        """Log an LLM generation."""
        if trace is None:
            return None

        try:
            generation = trace.generation(
                name=name,
                model=model,
                input=input_data,
                output=output_data,
                metadata=metadata or {},
                usage=usage,
            )
            return generation
        except Exception as e:
            logger.error("Failed to create LangFuse generation: %s", e)
            return None

    @classmethod
    def score_trace(
        cls,
        trace,
        name: str,
        value: float,
        comment: Optional[str] = None,
    ):
        """Add a score to a trace."""
        if trace is None:
            return

        try:
            trace.score(name=name, value=value, comment=comment)
        except Exception as e:
            logger.error("Failed to score LangFuse trace: %s", e)

    @classmethod
    def flush(cls):
        """Flush pending events."""
        if cls._client:
            try:
                cls._client.flush()
            except Exception as e:
                logger.error("Failed to flush LangFuse: %s", e)

    @classmethod
    def get_callback_handler(cls):
        """Get a LangFuse callback handler for LangChain."""
        if not cls.is_enabled():
            return None

        try:
            from langfuse.callback import CallbackHandler

            handler = CallbackHandler(
                public_key=os.environ.get("LANGFUSE_PUBLIC_KEY"),
                secret_key=os.environ.get("LANGFUSE_SECRET_KEY"),
                host=os.environ.get("LANGFUSE_HOST", "http://langfuse:3085"),
            )
            return handler
        except ImportError:
            logger.warning("langfuse callback handler not available")
            return None
        except Exception as e:
            logger.error("Failed to create LangFuse callback handler: %s", e)
            return None


class ObservabilityService:
    """Unified observability service combining LangSmith and LangFuse."""

    _initialized = False

    @classmethod
    def initialize(cls):
        """Initialize all observability services."""
        if cls._initialized:
            return

        LangSmithService.initialize()
        LangFuseService.initialize()
        cls._initialized = True

        status = []
        if LangSmithService.is_enabled():
            status.append("LangSmith")
        if LangFuseService.is_enabled():
            status.append("LangFuse")

        if status:
            logger.info("Observability initialized: %s", ", ".join(status))
        else:
            logger.warning("No observability services enabled")

    @classmethod
    def get_callbacks(cls) -> List:
        """Get all active callback handlers for LangChain."""
        callbacks = []

        langfuse_handler = LangFuseService.get_callback_handler()
        if langfuse_handler:
            callbacks.append(langfuse_handler)

        return callbacks

    @classmethod
    @contextmanager
    def trace_query(
        cls,
        query: str,
        retrieval_method: str,
        user_id: Optional[str] = None,
        metadata: Optional[Dict] = None,
    ):
        """Context manager to trace a query execution."""
        trace_data = {
            "query": query,
            "retrieval_method": retrieval_method,
            "start_time": time.time(),
            "langfuse_trace": None,
            "langsmith_run_id": None,
            "spans": [],
        }

        # Create LangFuse trace
        langfuse_trace = LangFuseService.create_trace(
            name=f"query:{retrieval_method}",
            metadata={
                "query": query,
                "retrieval_method": retrieval_method,
                **(metadata or {}),
            },
            user_id=user_id,
            tags=["query", retrieval_method],
        )
        trace_data["langfuse_trace"] = langfuse_trace

        try:
            yield trace_data
        except Exception as e:
            if langfuse_trace:
                LangFuseService.create_span(
                    langfuse_trace,
                    name="error",
                    input_data={"error": str(e)},
                    metadata={"error_type": type(e).__name__},
                )
            raise
        finally:
            trace_data["end_time"] = time.time()
            trace_data["duration_ms"] = (
                trace_data["end_time"] - trace_data["start_time"]
            ) * 1000

            if langfuse_trace:
                LangFuseService.create_span(
                    langfuse_trace,
                    name="completion",
                    metadata={
                        "duration_ms": trace_data["duration_ms"],
                        "results_count": trace_data.get("results_count", 0),
                    },
                )

            LangFuseService.flush()

    @classmethod
    @contextmanager
    def trace_agent(cls, agent_name: str, parent_trace=None):
        """Context manager to trace an agent execution."""
        span = None
        if parent_trace:
            span = LangFuseService.create_span(
                parent_trace,
                name=f"agent:{agent_name}",
                metadata={"agent": agent_name},
            )

        start_time = time.time()
        span_data = {"agent": agent_name, "span": span, "start_time": start_time}

        try:
            yield span_data
        except Exception as e:
            span_data["error"] = str(e)
            raise
        finally:
            span_data["duration_ms"] = (time.time() - start_time) * 1000
            if span:
                try:
                    span.end(
                        output=span_data.get("output"),
                        metadata={
                            "duration_ms": span_data["duration_ms"],
                            "error": span_data.get("error"),
                        },
                    )
                except Exception:
                    pass


def traced(name: Optional[str] = None, trace_type: str = "span"):
    """Decorator to trace a function execution."""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            trace_name = name or func.__name__
            start = time.time()

            try:
                result = func(*args, **kwargs)
                duration = (time.time() - start) * 1000
                logger.debug(
                    "Traced %s completed in %.2fms", trace_name, duration
                )
                return result
            except Exception as e:
                duration = (time.time() - start) * 1000
                logger.error(
                    "Traced %s failed after %.2fms: %s",
                    trace_name,
                    duration,
                    e,
                )
                raise

        return wrapper

    return decorator
