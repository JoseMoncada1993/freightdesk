import type { ReactNode } from "react";

interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  isLoading: boolean;
  error: unknown;
  empty?: string;
  rowKey: (row: T) => string | number;
}

export default function DataTable<T>({
  columns, rows, isLoading, error, empty, rowKey,
}: DataTableProps<T>) {
  if (isLoading) {
    return <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">Loading...</div>;
  }
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6 text-sm text-red-600">
        {error instanceof Error ? error.message : "Failed to load data"}
      </div>
    );
  }
  if (!rows || rows.length === 0) {
    return <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">{empty ?? "No records yet."}</div>;
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-left">
          <tr>
            {columns.map((c) => (
              <th key={c.header} className="px-4 py-3 font-medium">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-t border-slate-100 hover:bg-slate-50">
              {columns.map((c) => (
                <td key={c.header} className="px-4 py-3">{c.cell(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
