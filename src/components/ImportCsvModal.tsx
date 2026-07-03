// Generic CSV import modal: pick a file, preview what will be imported,
// see per-row problems, then import. Used by Customers, Carriers, Inventory.
import { useState } from "react";
import Modal, { Field, ErrorText } from "@/components/ui/Modal";
import { parseCsvWithSchema } from "@/lib/csvParse";
import type { CsvField, CsvParseResult } from "@/lib/csvParse";

interface ImportCsvModalProps {
  title: string;
  fields: CsvField[];
  exampleHeader: string;
  /** Convert parsed string records into insert payloads. */
  toPayload: (row: Record<string, string>) => Record<string, unknown>;
  /** Perform the bulk insert; throw on failure. */
  onImport: (payloads: Record<string, unknown>[]) => Promise<void>;
  onClose: () => void;
}

export default function ImportCsvModal({
  title, fields, exampleHeader, toPayload, onImport, onClose,
}: ImportCsvModalProps) {
  const [parsed, setParsed] = useState<CsvParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);

  const handleFile = async (file: File | null) => {
    setDone(null);
    setError(null);
    setParsed(null);
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setParsed(parseCsvWithSchema(text, fields));
  };

  const handleImport = async () => {
    if (!parsed || parsed.rows.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await onImport(parsed.rows.map(toPayload));
      setDone(parsed.rows.length);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      wide
      footer={
        done != null ? (
          <button onClick={onClose} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Close
          </button>
        ) : (
          <>
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={busy || !parsed || parsed.rows.length === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "Importing…" : `Import ${parsed?.rows.length ?? 0} rows`}
            </button>
          </>
        )
      }
    >
      <p className="text-sm text-slate-500">
        Upload a .csv file (exported from Excel or Google Sheets). The first row must be column
        names. Recognized columns: <span className="font-mono text-xs">{exampleHeader}</span>.
        Extra columns are ignored.
      </p>
      <Field label="CSV file">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
        />
      </Field>

      {parsed && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm space-y-2">
          <p>
            <span className="font-medium">{fileName}</span>: {parsed.rows.length} rows ready to import
            {parsed.errors.length > 0 && <span className="text-amber-600">, {parsed.errors.length} problem(s)</span>}.
          </p>
          {parsed.errors.slice(0, 5).map((e, i) => (
            <p key={i} className="text-xs text-amber-600">{e}</p>
          ))}
          {parsed.errors.length > 5 && (
            <p className="text-xs text-amber-600">…and {parsed.errors.length - 5} more.</p>
          )}
        </div>
      )}

      {done != null && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Imported {done} rows successfully.
        </div>
      )}
      <ErrorText error={error} />
    </Modal>
  );
}
