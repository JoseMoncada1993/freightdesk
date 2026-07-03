import { useMemo, useState } from "react";
import type { ReactNode } from "react";

interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  /** Provide a sortable value to make this column's header clickable. */
  sort?: (row: T) => string | number | null | undefined;
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
  const [sortIdx, setSortIdx] = useState<number | null>(null);
  const [asc, setAsc] = useState(true);

  const sorted = useMemo(() => {
    if (!rows || sortIdx == null || !columns[sortIdx]?.sort) return rows;
    const get = columns[sortIdx].sort!;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: "base" });
      return asc ? cmp : -cmp;
    });
  }, [rows, sortIdx, asc, columns]);

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
  if (!sorted || sorted.length === 0) {
    return <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">{empty ?? "No records yet."}</div>;
  }

  const toggleSort = (i: number) => {
    if (!columns[i].sort) return;
    if (sortIdx === i) {
      setAsc(!asc);
    } else {
      setSortIdx(i);
      setAsc(true);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-left">
          <tr>
            {columns.map((c, i) => (
              <th
                key={c.header || i}
                onClick={() => toggleSort(i)}
                className={`px-4 py-3 font-medium whitespace-nowrap ${c.sort ? "cursor-pointer select-none hover:text-slate-700" : ""}`}
                title={c.sort ? "Click to sort" : undefined}
              >
                {c.header}
                {c.sort && sortIdx === i && <span className="ml-1 text-slate-400">{asc ? "▲" : "▼"}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)} className="border-t border-slate-100 hover:bg-slate-50">
              {columns.map((c, i) => (
                <td key={c.header || i} className="px-4 py-3">{c.cell(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
