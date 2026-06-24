import PageHeader from "@/components/PageHeader";

export default function Carriers() {
  return (
    <div>
      <PageHeader
        title="Carriers"
        subtitle="Manage carrier records, SCAC/MC numbers and contacts"
        action={
          <button className="bg-brand hover:bg-brand-dark text-white text-sm font-medium px-4 py-2 rounded-md">
            New
          </button>
        }
      />
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 shadow-sm">
        Carriers list — connect to Supabase `carriers` table to populate.
      </div>
    </div>
  );
}
