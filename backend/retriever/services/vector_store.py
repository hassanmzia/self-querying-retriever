"""
ChromaDB vector-store service.

Manages collections, document embeddings, and similarity search against a
remote ChromaDB instance.  Uses OpenAI embeddings by default.
"""

import logging
from typing import Any

import chromadb
from django.conf import settings

logger = logging.getLogger(__name__)


class ChromaDBService:
    """
    Thin wrapper around the ChromaDB HTTP client that standardises
    collection management, document indexing and similarity search.
    """

    def __init__(
        self,
        host: str | None = None,
        port: int | None = None,
    ):
        self._host = host or settings.CHROMA_HOST
        self._port = port or settings.CHROMA_PORT
        self._client: chromadb.HttpClient | None = None
        self._embedding_fn = None

    # ------------------------------------------------------------------
    # Lazy initialisers
    # ------------------------------------------------------------------

    @property
    def client(self) -> chromadb.HttpClient:
        """Lazy-initialised ChromaDB HTTP client."""
        if self._client is None:
            logger.info(
                "Connecting to ChromaDB at %s:%s", self._host, self._port
            )
            self._client = chromadb.HttpClient(
                host=self._host, port=self._port
            )
        return self._client

    @property
    def embedding_function(self):
        """Return an OpenAI-based embedding function for ChromaDB."""
        if self._embedding_fn is None:
            from chromadb.utils.embedding_functions import (
                OpenAIEmbeddingFunction,
            )

            self._embedding_fn = OpenAIEmbeddingFunction(
                api_key=settings.OPENAI_API_KEY,
                model_name=settings.OPENAI_EMBEDDING_MODEL,
            )
        return self._embedding_fn

    # ------------------------------------------------------------------
    # Collection management
    # ------------------------------------------------------------------

    def get_or_create_collection(self, collection_name: str):
        """Return the ChromaDB collection, creating it if needed."""
        return self.client.get_or_create_collection(
            name=collection_name,
            embedding_function=self.embedding_function,
            metadata={"hnsw:space": "cosine"},
        )

    def create_collection(self, collection_name: str, metadata: dict | None = None):
        """
        Create a new ChromaDB collection.

        Args:
            collection_name: Unique name for the collection.
            metadata: Optional collection-level metadata.
        """
        col_metadata = {"hnsw:space": "cosine"}
        if metadata:
            col_metadata.update(metadata)

        collection = self.client.create_collection(
            name=collection_name,
            embedding_function=self.embedding_function,
            metadata=col_metadata,
        )
        logger.info("Created collection '%s'.", collection_name)
        return collection

    def delete_collection(self, collection_name: str):
        """
        Delete a ChromaDB collection and all of its documents.

        Args:
            collection_name: Name of the collection to delete.
        """
        try:
            self.client.delete_collection(name=collection_name)
            logger.info("Deleted collection '%s'.", collection_name)
        except Exception:
            logger.warning(
                "Collection '%s' could not be deleted (may not exist).",
                collection_name,
            )

    def list_collections(self) -> list[str]:
        """Return names of all existing collections."""
        collections = self.client.list_collections()
        return [c.name for c in collections]

    # ------------------------------------------------------------------
    # Document operations
    # ------------------------------------------------------------------

    def add_documents(
        self,
        collection_name: str,
        texts: list[str],
        metadatas: list[dict] | None = None,
        ids: list[str] | None = None,
    ):
        """
        Add (or upsert) documents into a collection.

        Args:
            collection_name: Target collection.
            texts: Document texts to embed and store.
            metadatas: Per-document metadata dicts.
            ids: Unique IDs for each document.
        """
        collection = self.get_or_create_collection(collection_name)

        # Sanitise metadata values -- ChromaDB only accepts str, int, float, bool.
        sanitised_metadatas = None
        if metadatas:
            sanitised_metadatas = [
                self._sanitise_metadata(m) for m in metadatas
            ]

        collection.upsert(
            documents=texts,
            metadatas=sanitised_metadatas,
            ids=ids or [str(i) for i in range(len(texts))],
        )
        logger.info(
            "Upserted %d documents into '%s'.", len(texts), collection_name
        )

    def search(
        self,
        collection_name: str,
        query_text: str,
        top_k: int = 5,
        where: dict | None = None,
        include: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Perform similarity search.

        Args:
            collection_name: Collection to search.
            query_text: Natural-language query.
            top_k: Number of results.
            where: ChromaDB ``where`` filter dict.
            include: Fields to include (default: documents, metadatas, distances).

        Returns:
            List of result dicts with keys ``id``, ``document``, ``metadata``,
            ``distance``.
        """
        collection = self.get_or_create_collection(collection_name)

        query_params: dict[str, Any] = {
            "query_texts": [query_text],
            "n_results": top_k,
            "include": include or ["documents", "metadatas", "distances"],
        }
        if where:
            query_params["where"] = where

        results = collection.query(**query_params)

        # Flatten the nested lists returned by ChromaDB.
        output: list[dict[str, Any]] = []
        ids = results.get("ids", [[]])[0]
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        for i in range(len(ids)):
            output.append(
                {
                    "id": ids[i],
                    "document": documents[i] if i < len(documents) else "",
                    "metadata": metadatas[i] if i < len(metadatas) else {},
                    "distance": distances[i] if i < len(distances) else None,
                }
            )

        return output

    def get_collection_count(self, collection_name: str) -> int:
        """Return the number of documents in a collection."""
        collection = self.get_or_create_collection(collection_name)
        return collection.count()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _sanitise_metadata(meta: dict) -> dict:
        """
        Convert metadata values to types accepted by ChromaDB
        (str, int, float, bool).  Lists are joined into comma-separated
        strings; other complex types are cast to str.
        """
        sanitised = {}
        for key, value in meta.items():
            if value is None:
                continue
            if isinstance(value, (str, int, float, bool)):
                sanitised[key] = value
            elif isinstance(value, list):
                sanitised[key] = ", ".join(str(v) for v in value)
            else:
                sanitised[key] = str(value)
        return sanitised
