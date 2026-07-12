import { ReactNode, useMemo, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  onRowClick?: (item: T) => void;
  loading?: boolean;
  pageSize?: number;
  searchKeys?: string[];
}

export default function DataTable<T extends object>({
  columns,
  data,
  searchPlaceholder = 'Rechercher...',
  onRowClick,
  loading,
  pageSize = 10,
  searchKeys,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search) return data;

    const query = search.toLowerCase();
    return data.filter(item => {
      const keys = searchKeys || columns.map(column => column.key);
      return keys.some(key => String((item as Record<string, unknown>)[key] ?? '').toLowerCase().includes(query));
    });
  }, [columns, data, search, searchKeys]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  if (loading) {
    return (
      <div className="surface-card flex items-center justify-center py-14">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{filtered.length} résultat(s)</p>
          <p className="text-xs text-slate-500">Recherche et navigation dans vos données.</p>
        </div>

        <div className="relative w-full md:max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={event => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full rounded-md border border-slate-200 bg-slate-50 py-2.5 !pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              {columns.map(column => (
                <th key={column.key} className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-slate-500">
                  Aucune donnée trouvée
                </td>
              </tr>
            ) : (
              paged.map((item, index) => (
                <tr
                  key={index}
                  onClick={() => onRowClick?.(item)}
                  className={`transition hover:bg-emerald-50/40 ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map(column => (
                    <td key={column.key} className="px-5 py-4 text-sm text-slate-700">
                      {column.render ? column.render(item) : String((item as Record<string, unknown>)[column.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>
            Page {page} sur {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(currentPage => Math.max(1, currentPage - 1))}
              disabled={page === 1}
              className="rounded-md border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage(currentPage => Math.min(totalPages, currentPage + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
