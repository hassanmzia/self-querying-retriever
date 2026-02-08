import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Check, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import Modal from '@/components/common/Modal';

interface UploadFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  progress: number;
  error?: string;
}

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[], metadata: DocumentMetadata) => Promise<void>;
  collections: string[];
}

interface DocumentMetadata {
  title: string;
  year: number;
  topics: string[];
  subtopic: string;
  collection: string;
}

export default function DocumentUploadModal({
  isOpen,
  onClose,
  onUpload,
  collections,
}: DocumentUploadModalProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [metadata, setMetadata] = useState<DocumentMetadata>({
    title: '',
    year: 2025,
    topics: [],
    subtopic: '',
    collection: collections[0] ?? '',
  });
  const [topicInput, setTopicInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      file,
      id: `${file.name}-${Date.now()}`,
      status: 'pending' as const,
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'text/markdown': ['.md'],
      'text/csv': ['.csv'],
      'application/json': ['.json'],
    },
    maxSize: 50 * 1024 * 1024,
  });

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const addTopic = () => {
    const topic = topicInput.trim();
    if (topic && !metadata.topics.includes(topic)) {
      setMetadata((prev) => ({ ...prev, topics: [...prev.topics, topic] }));
      setTopicInput('');
    }
  };

  const removeTopic = (topic: string) => {
    setMetadata((prev) => ({
      ...prev,
      topics: prev.topics.filter((t) => t !== topic),
    }));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      setFiles((prev) => prev.map((f) => ({ ...f, status: 'uploading' as const, progress: 50 })));
      await onUpload(
        files.map((f) => f.file),
        metadata
      );
      setFiles((prev) => prev.map((f) => ({ ...f, status: 'complete' as const, progress: 100 })));
      setTimeout(() => {
        onClose();
        setFiles([]);
        setMetadata({ title: '', year: 2025, topics: [], subtopic: '', collection: collections[0] ?? '' });
      }, 1000);
    } catch {
      setFiles((prev) =>
        prev.map((f) => ({ ...f, status: 'error' as const, error: 'Upload failed' }))
      );
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload Documents" size="lg">
      <div className="space-y-6">
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={clsx(
            'cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all',
            isDragActive
              ? 'border-teal-500/50 bg-teal-500/5'
              : 'border-slate-700 bg-slate-900/30 hover:border-slate-600 hover:bg-slate-900/50'
          )}
        >
          <input {...getInputProps()} />
          <Upload
            className={clsx(
              'mx-auto mb-3 h-10 w-10',
              isDragActive ? 'text-teal-400' : 'text-slate-500'
            )}
          />
          {isDragActive ? (
            <p className="text-sm text-teal-400">Drop files here...</p>
          ) : (
            <>
              <p className="text-sm text-slate-300">
                Drag and drop files here, or click to browse
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Supports TXT, PDF, MD, CSV, JSON (max 50MB)
              </p>
            </>
          )}
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2">
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">
              Files ({files.length})
            </label>
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-900/30 px-3 py-2"
                >
                  <FileText className="h-4 w-4 flex-shrink-0 text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-300">{f.file.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{formatFileSize(f.file.size)}</span>
                      {f.status === 'uploading' && (
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-700">
                          <div
                            className="h-full rounded-full bg-teal-500 transition-all"
                            style={{ width: `${f.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  {f.status === 'complete' ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : f.status === 'error' ? (
                    <AlertCircle className="h-4 w-4 text-red-400" />
                  ) : (
                    <button
                      onClick={() => removeFile(f.id)}
                      className="rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-slate-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata form */}
        <div className="space-y-4">
          <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">
            Metadata
          </label>

          {/* Title */}
          <div>
            <label className="mb-1 block text-sm text-slate-300">Title</label>
            <input
              type="text"
              value={metadata.title}
              onChange={(e) => setMetadata((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Document title"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
            />
          </div>

          {/* Year and Collection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Year</label>
              <select
                value={metadata.year}
                onChange={(e) => setMetadata((prev) => ({ ...prev, year: parseInt(e.target.value) }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
              >
                <option value={2023}>2023</option>
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Collection</label>
              <select
                value={metadata.collection}
                onChange={(e) => setMetadata((prev) => ({ ...prev, collection: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
              >
                {collections.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Topics */}
          <div>
            <label className="mb-1 block text-sm text-slate-300">Topics</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTopic();
                  }
                }}
                placeholder="Add topic..."
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
              />
              <button
                onClick={addTopic}
                className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-600 transition-colors"
              >
                Add
              </button>
            </div>
            {metadata.topics.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {metadata.topics.map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-xs text-blue-400"
                  >
                    {topic}
                    <button
                      onClick={() => removeTopic(topic)}
                      className="rounded-full hover:bg-blue-500/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Subtopic */}
          <div>
            <label className="mb-1 block text-sm text-slate-300">Subtopic</label>
            <input
              type="text"
              value={metadata.subtopic}
              onChange={(e) => setMetadata((prev) => ({ ...prev, subtopic: e.target.value }))}
              placeholder="Subtopic"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-700/30 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || isUploading}
            className={clsx(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              files.length > 0 && !isUploading
                ? 'bg-teal-500 text-white hover:bg-teal-400'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            )}
          >
            {isUploading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload {files.length > 0 ? `(${files.length})` : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
