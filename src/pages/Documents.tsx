import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { useDocuments } from "@/hooks/useTables";
import type { DocumentRecord } from "@/lib/types";

export default function Documents() {
  const { data, isLoading, error } = useDocuments();
  return (
    <div>
      <PageHeader title="Documents" subtitle="BOLs, invoices and proof-of-delivery" />
      <DataTable<DocumentRecord>
        rows={data}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        columns={[
          { header: "Type", cell: (r) => r.doc_type },
          { header: "File", cell: (r) => r.file_path },
          { header: "Load", cell: (r) => (r.load_id == null ? "—" : `#${r.load_id}`) },
          { header: "Uploaded", cell: (r) => new Date(r.uploaded_at).toLocaleDateString() },
        ]}
      />
    </div>
  );
}
