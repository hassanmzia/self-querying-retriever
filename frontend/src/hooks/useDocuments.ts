import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { documentApi, collectionApi } from "../services/api";
import type {
  DocumentUploadRequest,
  CollectionCreateRequest,
} from "../types";
import toast from "react-hot-toast";

// ============================================================
// Query Keys
// ============================================================

export const documentKeys = {
  all: ["documents"] as const,
  list: (collectionId?: string, page?: number, search?: string) =>
    [...documentKeys.all, "list", collectionId, page, search] as const,
  detail: (id: string) => [...documentKeys.all, "detail", id] as const,
  search: (query: string, collectionId?: string) =>
    [...documentKeys.all, "search", query, collectionId] as const,
};

export const collectionKeys = {
  all: ["collections"] as const,
  list: () => [...collectionKeys.all, "list"] as const,
  detail: (id: string) => [...collectionKeys.all, "detail", id] as const,
  stats: (id: string) => [...collectionKeys.all, "stats", id] as const,
};

// ============================================================
// useDocuments - List documents with pagination
// ============================================================

export function useDocuments(
  collectionId?: string,
  page = 1,
  pageSize = 20,
  search?: string
) {
  return useQuery({
    queryKey: documentKeys.list(collectionId, page, search),
    queryFn: () => documentApi.list(collectionId, page, pageSize, search),
    staleTime: 30000,
  });
}

// ============================================================
// useDocument - Get a single document
// ============================================================

export function useDocument(documentId: string) {
  return useQuery({
    queryKey: documentKeys.detail(documentId),
    queryFn: () => documentApi.get(documentId),
    enabled: !!documentId,
    staleTime: 60000,
  });
}

// ============================================================
// useDocumentSearch - Search documents
// ============================================================

export function useDocumentSearch(query: string, collectionId?: string) {
  return useQuery({
    queryKey: documentKeys.search(query, collectionId),
    queryFn: () => documentApi.search(query, collectionId),
    enabled: query.length > 2,
    staleTime: 15000,
  });
}

// ============================================================
// useUploadDocument - Upload a document
// ============================================================

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: DocumentUploadRequest) =>
      documentApi.upload(request),
    onSuccess: (data) => {
      toast.success(
        `Document uploaded successfully. ${data.chunks_created} chunks created.`
      );
      void queryClient.invalidateQueries({ queryKey: documentKeys.all });
      void queryClient.invalidateQueries({ queryKey: collectionKeys.all });
    },
    onError: () => {
      toast.error("Failed to upload document. Please try again.");
    },
  });
}

// ============================================================
// useDeleteDocument - Delete a document
// ============================================================

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => documentApi.delete(documentId),
    onSuccess: () => {
      toast.success("Document deleted successfully.");
      void queryClient.invalidateQueries({ queryKey: documentKeys.all });
      void queryClient.invalidateQueries({ queryKey: collectionKeys.all });
    },
    onError: () => {
      toast.error("Failed to delete document.");
    },
  });
}

// ============================================================
// useBulkDeleteDocuments - Delete multiple documents
// ============================================================

export function useBulkDeleteDocuments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentIds: string[]) =>
      documentApi.bulkDelete(documentIds),
    onSuccess: () => {
      toast.success("Documents deleted successfully.");
      void queryClient.invalidateQueries({ queryKey: documentKeys.all });
      void queryClient.invalidateQueries({ queryKey: collectionKeys.all });
    },
    onError: () => {
      toast.error("Failed to delete documents.");
    },
  });
}

// ============================================================
// useCollections - List all collections
// ============================================================

export function useCollections() {
  return useQuery({
    queryKey: collectionKeys.list(),
    queryFn: () => collectionApi.list(),
    staleTime: 30000,
  });
}

// ============================================================
// useCollection - Get a single collection
// ============================================================

export function useCollection(collectionId: string) {
  return useQuery({
    queryKey: collectionKeys.detail(collectionId),
    queryFn: () => collectionApi.get(collectionId),
    enabled: !!collectionId,
    staleTime: 60000,
  });
}

// ============================================================
// useCollectionStats - Get collection statistics
// ============================================================

export function useCollectionStats(collectionId: string) {
  return useQuery({
    queryKey: collectionKeys.stats(collectionId),
    queryFn: () => collectionApi.getStats(collectionId),
    enabled: !!collectionId,
    staleTime: 30000,
  });
}

// ============================================================
// useCreateCollection - Create a new collection
// ============================================================

export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CollectionCreateRequest) =>
      collectionApi.create(request),
    onSuccess: (data) => {
      toast.success(`Collection "${data.name}" created successfully.`);
      void queryClient.invalidateQueries({ queryKey: collectionKeys.all });
    },
    onError: () => {
      toast.error("Failed to create collection.");
    },
  });
}

// ============================================================
// useUpdateCollection - Update a collection
// ============================================================

export function useUpdateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CollectionCreateRequest>;
    }) => collectionApi.update(id, data),
    onSuccess: (data) => {
      toast.success(`Collection "${data.name}" updated successfully.`);
      void queryClient.invalidateQueries({ queryKey: collectionKeys.all });
    },
    onError: () => {
      toast.error("Failed to update collection.");
    },
  });
}

// ============================================================
// useDeleteCollection - Delete a collection
// ============================================================

export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (collectionId: string) =>
      collectionApi.delete(collectionId),
    onSuccess: () => {
      toast.success("Collection deleted successfully.");
      void queryClient.invalidateQueries({ queryKey: collectionKeys.all });
      void queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
    onError: () => {
      toast.error("Failed to delete collection.");
    },
  });
}
