import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import Modal, { Field, ModalActions, ErrorText, inputCls } from "@/components/ui/Modal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useDocuments } from "@/hooks/useTables";
import { useLoads } from "@/hooks/useLoads";
import { useAddDocument } from "@/hooks/useMutations";
import { DOC_TYPES } from "@/lib/types";
import type { DocumentRecord } from "@/lib/types";

const BUCKET = "documents";

function UploadForm({ onClose }: { onClose: () => void }) {
  const addDoc = useAddDocument();
  const loads = useLoads();
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>(DOC_TYPES[0]);
  const [loadId, setLoadId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<Error | null>(null);

  const canSubmit = file != null && !uploading && !addDoc.isPending;

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file);
      if (error) throw error;
      addDoc.mutate(
        { doc_type: docType, file_path: path, load_id: loadId ? Number(loadId) : null },
        { onSuccess: onClose },
      );
    } catch (e) {
      setUploadError(e instanceof Error ? e : new Error("Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      title="Upload document"
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          onSubmit={handleSubmit}
          submitLabel="Upload"
          pending={uploading || addDoc.isPending}
          disabled={!canSubmit}
        />
      }
    >
      <Field label="File *">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Document type">
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className={inputCls}>
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Linked load">
          <select value={loadId} onChange={(e) => setLoadId(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {(loads.data ?? []).map((l) => (
              <option key={l.id ?? undefined} value={l.id ?? ""}>{l.ref}</option>
            ))}
          </select>
        </Field>
      </div>
      <ErrorText error={uploadError ?? addDoc.error} />
    </Modal>
  );
}

export default function Documents() {
  const { data, isLoading, error } = useDocuments();
  const { can } = useAuth();
  const canWrite = can("documents");
  const [showUpload, setShowUpload] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const download = async (doc: DocumentRecord) => {
    setDownloadError(null);
    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.file_path, 300);
    if (signError || !signed?.signedUrl) {
      setDownloadError(
        `Could not open "${doc.file_path}" — the file may not exist in storage (older records were metadata only).`,
      );
      return;
    }
    window.open(signed.signedUrl, "_blank");
  };

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="BOLs, PODs, invoices and carrier paperwork (Supabase Storage)"
        action={
          canWrite ? (
            <button
              onClick={() => setShowUpload(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Upload document
            </button>
          ) : undefined
        }
      />
      {downloadError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {downloadError}
        </div>
      )}
      <DataTable<DocumentRecord>
        rows={data}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        empty="No documents yet — upload a BOL or POD."
        columns={[
          { header: "Type", cell: (r) => <span className="font-medium">{r.doc_type}</span> },
          { header: "File", cell: (r) => r.file_path },
          { header: "Load", cell: (r) => (r.load_id == null ? "—" : `#${r.load_id}`) },
          { header: "Uploaded", cell: (r) => new Date(r.uploaded_at).toLocaleString() },
          {
            header: "",
            cell: (r) => (
              <button onClick={() => download(r)} className="text-blue-600 hover:underline text-xs font-medium">
                Download
              </button>
            ),
          },
        ]}
      />
      {showUpload && <UploadForm onClose={() => setShowUpload(false)} />}
    </div>
  );
}
