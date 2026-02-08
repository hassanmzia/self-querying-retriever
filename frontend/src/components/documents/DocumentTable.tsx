import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Eye, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import Badge from '@/components/common/Badge';

export interface DocumentRow {
  id: string;
  title: string;
  topics: string[];
  year: number;
  collection: string;
  created: string;
  content?: string;
}

type SortField = 'title' | 'year' | 'collection' | 'created';
type SortDirection = 'asc' | 'desc';

interface DocumentTableProps {
  documents: DocumentRow[];
  onViewDocument: (doc: DocumentRow) => void;
  onDeleteDocument: (doc: DocumentRow) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  className?: string;
}

export default function DocumentTable({
  documents,
  onViewDocument,
  onDeleteDocument,
  selectedIds,
  onSelectionChange,
  className,
}: DocumentTableProps) {
  const [sortField, setSortField] = useState<SortField>('created');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sorted = [...documents].sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal) * multiplier;
    }
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * multiplier;
    }
    return 0;
  });

  const allSelected = documents.length > 0 && selectedIds.length === documents.length;

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(documents.map((d) => d.id));
    }
  };

  const toggleOne = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ChevronsUpDown className="h-3.5 w-3.5 text-slate-600" />;
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-3.5 w-3.5 text-teal-400" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 text-teal-400" />
    );
  };

  return (
    <div className={clsx('overflow-hidden rounded-xl border border-slate-700/50', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50 bg-slate-800/80">
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500/20 focus:ring-offset-0"
                />
              </th>
              {(['title', 'year', 'collection', 'created'] as SortField[]).map((field) => (
                <th key={field} className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort(field)}
                    className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {field === 'created' ? 'Created' : field.charAt(0).toUpperCase() + field.slice(1)}
                    <SortIcon field={field} />
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Topics
                </span>
              </th>
              <th className="w-24 px-4 py-3">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Actions
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {sorted.map((doc) => (
              <tr
                key={doc.id}
                className={clsx(
                  'group transition-colors',
                  selectedIds.includes(doc.id)
                    ? 'bg-teal-500/5'
                    : 'bg-slate-800/40 hover:bg-slate-800/60'
                )}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(doc.id)}
                    onChange={() => toggleOne(doc.id)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500/20 focus:ring-offset-0"
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onViewDocument(doc)}
                    className="text-sm font-medium text-slate-200 hover:text-teal-400 transition-colors text-left"
                  >
                    {doc.title}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="cyan" size="sm">
                    {doc.year}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-400">{doc.collection}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-500">
                    {new Date(doc.created).toLocaleDateString()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {doc.topics.slice(0, 3).map((topic) => (
                      <Badge key={topic} variant="blue" size="sm">
                        {topic}
                      </Badge>
                    ))}
                    {doc.topics.length > 3 && (
                      <Badge variant="default" size="sm">
                        +{doc.topics.length - 3}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onViewDocument(doc)}
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDeleteDocument(doc)}
                      className="rounded p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {documents.length === 0 && (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-slate-500">No documents found</p>
        </div>
      )}
    </div>
  );
}
