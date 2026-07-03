// Small CSV parser: handles quoted fields, embedded commas/newlines, CRLF, BOM.

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, "");

/**
 * Parse a CSV file into objects using a header-name mapping.
 * Each field spec lists acceptable header aliases (first alias = canonical name).
 */
export interface CsvField {
  key: string;
  aliases: string[];
  required?: boolean;
}

export interface CsvParseResult {
  rows: Record<string, string>[];
  errors: string[];
  matchedHeaders: string[];
}

export function parseCsvWithSchema(text: string, fields: CsvField[]): CsvParseResult {
  const raw = parseCsv(text);
  if (raw.length < 2) return { rows: [], errors: ["The file needs a header row plus at least one data row."], matchedHeaders: [] };

  const headers = raw[0].map(normalize);
  const colFor = new Map<string, number>();
  for (const f of fields) {
    const idx = headers.findIndex((h) => f.aliases.some((a) => normalize(a) === h));
    if (idx >= 0) colFor.set(f.key, idx);
  }

  const errors: string[] = [];
  for (const f of fields) {
    if (f.required && !colFor.has(f.key)) {
      errors.push(`Missing required column "${f.aliases[0]}".`);
    }
  }
  if (errors.length > 0) return { rows: [], errors, matchedHeaders: [] };

  const rows: Record<string, string>[] = [];
  for (let r = 1; r < raw.length; r++) {
    const obj: Record<string, string> = {};
    let hasValue = false;
    for (const f of fields) {
      const idx = colFor.get(f.key);
      const v = idx != null ? (raw[r][idx] ?? "").trim() : "";
      obj[f.key] = v;
      if (v) hasValue = true;
    }
    if (!hasValue) continue; // skip blank lines
    const missing = fields.filter((f) => f.required && !obj[f.key]);
    if (missing.length > 0) {
      errors.push(`Row ${r + 1}: missing ${missing.map((m) => m.aliases[0]).join(", ")} — skipped.`);
      continue;
    }
    rows.push(obj);
  }
  return { rows, errors, matchedHeaders: Array.from(colFor.keys()) };
}
