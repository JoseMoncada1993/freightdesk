// CSV export helper: turns rows into a spreadsheet file download.
// Opens directly in Excel / Google Sheets.

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsv<T extends Record<string, unknown>>(
  rows: T[],
  filename: string,
  columns?: { key: keyof T & string; header?: string }[],
  opts?: { bom?: boolean },
) {
  if (rows.length === 0) return;
  const cols =
    columns ?? (Object.keys(rows[0]) as (keyof T & string)[]).map((key) => ({ key, header: key }));
  const header = cols.map((c) => csvEscape(("header" in c && c.header) || c.key)).join(",");
  const lines = rows.map((r) => cols.map((c) => csvEscape(r[c.key])).join(","));
  const csv = [header, ...lines].join("\r\n");
  // BOM helps Excel detect UTF-8, but strict importers read it as part of the
  // first header ("﻿sku"), so callers feeding other systems disable it.
  const bom = opts?.bom === false ? "" : "﻿";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Small standard "Export CSV" button used across modules. */
export function exportButtonProps(count: number) {
  return {
    disabled: count === 0,
    className:
      "rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40",
  };
}
