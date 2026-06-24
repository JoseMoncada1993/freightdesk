import PageHeader from "@/components/PageHeader";

export default function Customers() {
  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Manage customer records, contacts and rates"
        action={
          <button className="bg-brand hover:bg-brand-dark text-white text-sm font-medium px-4 py-2 rounded-md">
            New
          </button>
        }
      />
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 shadow-sm">
        Customers list — connect to Supabase `customers` table to populate.
      </div>
    </div>
  );
}
