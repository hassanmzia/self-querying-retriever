import { useState } from "react";
import { motion } from "framer-motion";
import {
  FolderOpen,
  Plus,
  FileText,
  Trash2,
  Edit3,
  Loader2,
  X,
  Database,
} from "lucide-react";
import { useCollections, useCreateCollection, useDeleteCollection } from "../hooks/useDocuments";
import { formatDistanceToNow } from "date-fns";

export default function Collections() {
  const { data: collections, isLoading } = useCollections();
  const createMutation = useCreateCollection();
  const deleteMutation = useDeleteCollection();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newEmbeddingModel, setNewEmbeddingModel] = useState("text-embedding-3-small");

  const handleCreate = () => {
    if (!newName.trim()) return;
    createMutation.mutate(
      { name: newName.trim(), description: newDescription.trim() || undefined, embedding_model: newEmbeddingModel },
      {
        onSuccess: () => {
          setShowCreate(false);
          setNewName("");
          setNewDescription("");
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-surface-400">{collections?.length ?? 0} collections</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Collection
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-surface-100">Create Collection</h3>
            <button onClick={() => setShowCreate(false)} className="text-surface-400 hover:text-surface-200">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1">Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="my-collection" className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1">Embedding Model</label>
              <select value={newEmbeddingModel} onChange={(e) => setNewEmbeddingModel(e.target.value)} className="input-field">
                <option value="text-embedding-3-small">text-embedding-3-small</option>
                <option value="text-embedding-3-large">text-embedding-3-large</option>
                <option value="text-embedding-ada-002">text-embedding-ada-002</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1">Description (optional)</label>
            <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Describe this collection..." rows={2} className="input-field resize-none" />
          </div>
          <div className="flex justify-end">
            <button onClick={handleCreate} disabled={!newName.trim() || createMutation.isPending} className="btn-primary">
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create
            </button>
          </div>
        </motion.div>
      )}

      {/* Collections grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
        </div>
      ) : !collections || collections.length === 0 ? (
        <div className="text-center py-20">
          <FolderOpen className="w-12 h-12 text-surface-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-surface-400">No collections yet</h3>
          <p className="text-sm text-surface-500 mt-1">Create a collection to start organizing your documents.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((col, idx) => (
            <motion.div
              key={col.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="card-hover p-5 flex flex-col"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-brand-600/10">
                    <Database className="w-5 h-5 text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-surface-100">{col.name}</h3>
                    {col.description && (
                      <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">{col.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1 rounded text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(col.id)}
                    className="p-1 rounded text-surface-400 hover:text-red-400 hover:bg-surface-800 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-surface-700/50 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-surface-500">Documents</p>
                  <p className="text-lg font-bold text-surface-200 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-surface-400" />
                    {col.document_count.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-surface-500">Dimensions</p>
                  <p className="text-lg font-bold text-surface-200">{col.vector_dimension}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="badge-brand text-[10px]">{col.embedding_model}</span>
                <span className="text-[10px] text-surface-500">
                  Updated {formatDistanceToNow(new Date(col.updated_at), { addSuffix: true })}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
