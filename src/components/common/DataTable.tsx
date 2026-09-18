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
    <div className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white/95 shadow-[0_20px_50px_-25px_rgba(15,23,42,0.1)] backdrop-blur-md transition-all duration-300">
      <div className="flex flex-col gap-4 border-b border-slate-100/80 px-6 py-4.5 md:flex-row md:items-center md:justify-between bg-slate-50/50">
        <div>
          <p className="text-sm font-bold text-slate-900">{filtered.length} résultat(s)</p>
          <p className="text-xs text-slate-500 mt-0.5">Recherche et navigation simplifiée dans vos données.</p>
        </div>

        <div className="relative w-full md:max-w-sm">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={event => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 !pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition-all duration-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 shadow-2xs"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-100/60 font-bold">
              {columns.map(column => (
                <th key={column.key} className="px-6 py-3.5 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-600">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                  Aucune donnée trouvée
                </td>
              </tr>
            ) : (
              paged.map((item, index) => (
                <tr
                  key={index}
                  onClick={() => onRowClick?.(item)}
                  className={`transition-colors duration-150 hover:bg-slate-50/80 ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map(column => (
                    <td key={column.key} className="px-6 py-4 text-slate-700 font-medium">
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
        <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 text-sm font-medium text-slate-500 md:flex-row md:items-center md:justify-between bg-slate-50/30">
          <p className="text-xs font-semibold text-slate-500">
            Page <strong className="text-slate-900">{page}</strong> sur <strong className="text-slate-900">{totalPages}</strong>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(currentPage => Math.max(1, currentPage - 1))}
              disabled={page === 1}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 shadow-2xs font-semibold text-xs flex items-center gap-1"
            >
              <ChevronLeft size={14} /> Précédent
            </button>
            <button
              onClick={() => setPage(currentPage => Math.min(totalPages, currentPage + 1))}
              disabled={page === totalPages}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 shadow-2xs font-semibold text-xs flex items-center gap-1"
            >
              Suivant <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
