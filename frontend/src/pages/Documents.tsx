import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import {
  FileText,
  Upload,
  Search,
  Trash2,
  Eye,
  X,
  Loader2,
  File,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useDocuments, useUploadDocument, useDeleteDocument, useCollections } from "../hooks/useDocuments";
import { formatDistanceToNow } from "date-fns";

export default function Documents() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<string | null>(null);
  const [uploadCollectionId, setUploadCollectionId] = useState("");

  const { data: docsData, isLoading } = useDocuments(selectedCollection || undefined, page, 20, searchQuery || undefined);
  const { data: collections } = useCollections();
  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      acceptedFiles.forEach((file) => {
        uploadMutation.mutate({
          file,
          collection_id: uploadCollectionId || "default",
        });
      });
    },
    [uploadMutation, uploadCollectionId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "text/markdown": [".md"],
      "application/json": [".json"],
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxSize: 50 * 1024 * 1024,
  });

  const documents = docsData?.data ?? [];
  const totalPages = docsData?.total_pages ?? 1;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="input-field pl-10"
            />
          </div>
          <select
            value={selectedCollection}
            onChange={(e) => { setSelectedCollection(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-surface-800 border border-surface-600/50 rounded-lg text-sm text-surface-300 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          >
            <option value="">All Collections</option>
            {collections?.map((col) => (
              <option key={col.id} value={col.id}>{col.name}</option>
            ))}
          </select>
        </div>
        <button onClick={() => setShowUpload(!showUpload)} className="btn-primary">
          <Upload className="w-4 h-4" />
          Upload
        </button>
      </div>

      {/* Upload area */}
      {showUpload && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="overflow-hidden">
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-surface-100">Upload Documents</h3>
              <button onClick={() => setShowUpload(false)} className="text-surface-400 hover:text-surface-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <select
              value={uploadCollectionId}
              onChange={(e) => setUploadCollectionId(e.target.value)}
              className="px-3 py-2 bg-surface-800 border border-surface-600/50 rounded-lg text-sm text-surface-300 focus:outline-none focus:ring-2 focus:ring-brand-500/50 w-full max-w-xs"
            >
              <option value="">Select collection</option>
              {collections?.map((col) => (
                <option key={col.id} value={col.id}>{col.name}</option>
              ))}
            </select>

            <div
              {...getRootProps()}
              className={clsx(
                "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
                isDragActive ? "border-brand-400 bg-brand-600/5" : "border-surface-600 hover:border-surface-500"
              )}
            >
              <input {...getInputProps()} />
              <Upload className="w-8 h-8 text-surface-500 mx-auto mb-3" />
              <p className="text-sm text-surface-300">
                {isDragActive ? "Drop files here..." : "Drag & drop files here, or click to browse"}
              </p>
              <p className="text-xs text-surface-500 mt-1">PDF, TXT, MD, JSON, CSV, DOCX (max 50MB)</p>
            </div>

            {uploadMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-brand-300">
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Documents list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-12 h-12 text-surface-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-surface-400">No documents found</h3>
          <p className="text-sm text-surface-500 mt-1">Upload documents to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc, idx) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="card-hover p-4"
            >
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-surface-800 text-surface-400 flex-shrink-0">
                  <File className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-surface-200 truncate">
                      {doc.metadata.source || doc.id}
                    </p>
                    {doc.metadata.file_type && (
                      <span className="badge-brand text-[10px]">{doc.metadata.file_type}</span>
                    )}
                  </div>
                  <p className="text-xs text-surface-400 mt-1 line-clamp-2">{doc.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-surface-500">
                    <span>{formatDistanceToNow(new Date(doc.metadata.created_at), { addSuffix: true })}</span>
                    {doc.metadata.file_size != null && (
                      <span>{(doc.metadata.file_size / 1024).toFixed(1)} KB</span>
                    )}
                    {doc.metadata.chunk_index !== undefined && doc.metadata.total_chunks !== undefined && (
                      <span>Chunk {doc.metadata.chunk_index + 1}/{doc.metadata.total_chunks}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setViewingDoc(viewingDoc === doc.id ? null : doc.id)}
                    className="p-1.5 rounded text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(doc.id)}
                    className="p-1.5 rounded text-surface-400 hover:text-red-400 hover:bg-surface-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {viewingDoc === doc.id && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} className="mt-3 pt-3 border-t border-surface-700/50">
                  <pre className="text-xs text-surface-300 whitespace-pre-wrap bg-surface-800/50 p-3 rounded-lg max-h-60 overflow-y-auto font-mono">
                    {doc.content}
                  </pre>
                  {doc.metadata.tags && doc.metadata.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {doc.metadata.tags.map((tag) => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 bg-surface-800 rounded-full text-surface-400">{tag}</span>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="btn-ghost px-3 py-1.5 text-sm disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-surface-400">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="btn-ghost px-3 py-1.5 text-sm disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
