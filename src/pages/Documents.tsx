import PageHeader from "@/components/PageHeader";

export default function Documents() {
  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="BOLs, invoices and proof-of-delivery uploads"
        action={
          <button className="bg-brand hover:bg-brand-dark text-white text-sm font-medium px-4 py-2 rounded-md">
            New
          </button>
        }
      />
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 shadow-sm">
        Documents list — connect to Supabase `documents` table to populate.
      </div>
    </div>
  );
}
