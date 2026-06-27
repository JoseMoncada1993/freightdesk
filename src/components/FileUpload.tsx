import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const BUCKET = "carrier-docs";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPT = ".pdf,.jpg,.jpeg,.png";
const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];

type FileUploadProps = {
  label: string;
  /** Folder/prefix inside the bucket, e.g. "w9" or "coi". */
  prefix: string;
  /** Current stored path (if any). */
  value: string | null;
  /** Called with the new storage path after a successful upload. */
  onUploaded: (path: string) => void;
};

export default function FileUpload({ label, prefix, value, onUploaded }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!ALLOWED.includes(file.type)) {
      setError("Only PDF, JPG, or PNG files are allowed.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File is too large (max 10 MB).");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "dat";
      const path = prefix + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      onUploaded(path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      setError(msg);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleView() {
    if (!value) return;
    setViewing(true);
    setError(null);
    try {
      const { data, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(value, 60);
      if (signErr) throw signErr;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not open file.";
      setError(msg);
    } finally {
      setViewing(false);
    }
  }

  const fileName = value ? value.split("/").pop() : null;

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleFile}
          disabled={uploading}
          className="text-sm text-slate-600 file:mr-2 file:rounded file:border file:border-slate-300 file:bg-white file:px-2 file:py-1 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-100"
        />
        {uploading && <span className="text-xs text-slate-500">Uploading…</span>}
        {value && !uploading && (
          <button
            type="button"
            onClick={handleView}
            disabled={viewing}
            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {viewing ? "Opening…" : "View"}
          </button>
        )}
      </div>
      {fileName && (
        <p className="mt-1 truncate text-xs text-slate-500" title={fileName}>
          Uploaded: {fileName}
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
