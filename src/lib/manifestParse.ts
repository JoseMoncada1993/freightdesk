// Parse a manifest file (CSV / Excel / PDF) into a plain grid of strings.
// SheetJS and pdf.js are dynamically imported so they stay out of the main
// bundle until a file is actually parsed.

export async function parseManifestFile(name: string, data: ArrayBuffer): Promise<string[][]> {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return parsePdf(data);
  return parseSpreadsheet(data);
}

// Full-precision plain text for a number — never scientific notation (Excel's
// General format shows long UPCs/IDs as 8.12346E+11; we keep every digit).
const plainNumber = (n: number): string => {
  const s = String(n);
  if (!/e/i.test(s)) return s;
  return n.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 });
};

const cellText = (c: unknown): string => {
  if (c == null) return "";
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? "" : c.toLocaleDateString("en-US");
  if (typeof c === "number") return plainNumber(c);
  if (typeof c === "boolean") return c ? "TRUE" : "FALSE";
  return String(c);
};

// CSV, XLSX, XLS, XLSM — SheetJS handles format detection from the bytes.
// Raw cell values are read (not Excel's display text) so numbers keep their
// original digits instead of General-format scientific notation.
async function parseSpreadsheet(data: ArrayBuffer): Promise<string[][]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  // Pick the sheet with the most content (templates often have empty Sheet1).
  let best: string[][] = [];
  let bestCells = 0;
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const grid = XLSX.utils
      .sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" })
      .map((r) => r.map(cellText));
    const cells = grid.reduce((n, r) => n + r.filter((c) => c.trim() !== "").length, 0);
    if (cells > bestCells) { best = grid; bestCells = cells; }
  }
  return best;
}

// Best-effort table reconstruction from PDF text: group text items into lines
// by Y position, then split each line into cells on horizontal gaps.
async function parsePdf(data: ArrayBuffer): Promise<string[][]> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data }).promise;
  const grid: string[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .filter((it) => "str" in it && it.str.trim() !== "")
      .map((raw) => {
        const it = raw as { str: string; transform: number[]; width: number };
        return { str: it.str, x: it.transform[4], y: it.transform[5], w: it.width };
      });

    // Group into lines by Y (2pt tolerance), top of page first.
    const lines = new Map<number, { str: string; x: number; w: number }[]>();
    for (const it of items) {
      let key: number | null = null;
      for (const y of lines.keys()) if (Math.abs(y - it.y) <= 2) { key = y; break; }
      const bucket = lines.get(key ?? it.y) ?? [];
      bucket.push(it);
      lines.set(key ?? it.y, bucket);
    }
    const sorted = [...lines.entries()].sort((a, b) => b[0] - a[0]);
    for (const [, cellsRaw] of sorted) {
      cellsRaw.sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let cur = "";
      let curEnd = -Infinity;
      for (const it of cellsRaw) {
        // New cell when there's a visible horizontal gap; otherwise same cell.
        if (cur !== "" && it.x - curEnd > 8) {
          cells.push(cur.trim());
          cur = it.str;
        } else {
          cur = cur === "" ? it.str : `${cur} ${it.str}`;
        }
        curEnd = it.x + it.w;
      }
      if (cur.trim() !== "") cells.push(cur.trim());
      if (cells.length > 0) grid.push(cells);
    }
  }
  await doc.destroy();
  return grid;
}

/** Best guess for the header row: densest row among the first 15. */
export function guessHeaderRow(grid: string[][]): number {
  let best = 0;
  let bestCount = 0;
  const limit = Math.min(grid.length, 15);
  for (let i = 0; i < limit; i++) {
    const count = (grid[i] ?? []).filter((c) => (c ?? "").trim() !== "").length;
    if (count > bestCount) { bestCount = count; best = i; }
  }
  return best;
}
