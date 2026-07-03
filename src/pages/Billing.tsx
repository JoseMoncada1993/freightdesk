// Billing / accounts receivable: invoice delivered loads, track payment,
// and watch the aging buckets. One invoice per load.
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import StatCard from "@/components/ui/StatCard";
import Modal, { Field, ModalActions, ErrorText, inputCls } from "@/components/ui/Modal";
import { useLoads } from "@/hooks/useLoads";
import { useUpdateLoad } from "@/hooks/useMutations";
import { exportCsv, exportButtonProps } from "@/lib/csv";
import type { LoadEnriched } from "@/lib/types";

const money = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

type ArStatus = "not_invoiced" | "outstanding" | "overdue" | "paid";

function arStatus(l: LoadEnriched): ArStatus {
  if (l.paid_at) return "paid";
  if (!l.invoiced_at) return "not_invoiced";
  if (l.invoice_due_date && new Date(l.invoice_due_date + "T23:59:59") < new Date()) return "overdue";
  return "outstanding";
}

const AR_LABELS: Record<ArStatus, string> = {
  not_invoiced: "Not invoiced",
  outstanding: "Outstanding",
  overdue: "Overdue",
  paid: "Paid",
};

const AR_COLORS: Record<ArStatus, string> = {
  not_invoiced: "bg-slate-100 text-slate-700",
  outstanding: "bg-blue-100 text-blue-700",
  overdue: "bg-red-100 text-red-700",
  paid: "bg-emerald-100 text-emerald-700",
};

const daysOut = (l: LoadEnriched) =>
  l.invoiced_at && !l.paid_at
    ? Math.max(0, Math.floor((Date.now() - new Date(l.invoiced_at).getTime()) / 864e5))
    : null;

function InvoiceModal({ load, onClose }: { load: LoadEnriched; onClose: () => void }) {
  const update = useUpdateLoad();
  const today = new Date();
  const defaultDue = new Date(today.getTime() + 30 * 864e5); // Net 30
  const [invoiceNumber, setInvoiceNumber] = useState(
    load.invoice_number ?? `INV-${load.ref ?? load.id}`,
  );
  const [invoicedDate, setInvoicedDate] = useState(
    (load.invoiced_at ?? today.toISOString()).slice(0, 10),
  );
  const [dueDate, setDueDate] = useState(load.invoice_due_date ?? defaultDue.toISOString().slice(0, 10));

  const canSubmit = invoiceNumber.trim() !== "" && invoicedDate !== "" && !update.isPending;

  const handleSubmit = () => {
    if (load.id == null) return;
    update.mutate(
      {
        id: load.id,
        invoice_number: invoiceNumber.trim(),
        invoiced_at: new Date(invoicedDate + "T12:00:00").toISOString(),
        invoice_due_date: dueDate || null,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      title={`Invoice load ${load.ref ?? ""}`}
      onClose={onClose}
      footer={
        <ModalActions onCancel={onClose} onSubmit={handleSubmit} submitLabel="Save invoice" pending={update.isPending} disabled={!canSubmit} />
      }
    >
      <p className="text-sm text-slate-500">
        {load.customer_name ?? "No customer"} · {money(load.rate_usd)}
      </p>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Invoice # *">
          <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Invoice date *">
          <input value={invoicedDate} onChange={(e) => setInvoicedDate(e.target.value)} type="date" className={inputCls} />
        </Field>
        <Field label="Due date (Net 30 default)">
          <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" className={inputCls} />
        </Field>
      </div>
      <ErrorText error={update.error} />
    </Modal>
  );
}

export default function Billing() {
  const { data, isLoading, error } = useLoads();
  const update = useUpdateLoad();
  const [invoicing, setInvoicing] = useState<LoadEnriched | null>(null);
  const [filter, setFilter] = useState<"all" | ArStatus>("all");

  // Billable = delivered or already invoiced, with a rate, not cancelled.
  const billable = useMemo(
    () =>
      (data ?? []).filter(
        (l) =>
          l.rate_usd != null &&
          l.status !== "cancelled" &&
          (l.status === "delivered" || l.invoiced_at != null),
      ),
    [data],
  );

  const rows = useMemo(
    () => (filter === "all" ? billable : billable.filter((l) => arStatus(l) === filter)),
    [billable, filter],
  );

  const sum = (list: LoadEnriched[]) => list.reduce((s, l) => s + (l.rate_usd ?? 0), 0);
  const notInvoiced = billable.filter((l) => arStatus(l) === "not_invoiced");
  const outstanding = billable.filter((l) => arStatus(l) === "outstanding");
  const overdue = billable.filter((l) => arStatus(l) === "overdue");
  const paid = billable.filter((l) => arStatus(l) === "paid");

  // Aging buckets for unpaid invoices
  const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const l of [...outstanding, ...overdue]) {
    const d = daysOut(l) ?? 0;
    const key = d <= 30 ? "0-30" : d <= 60 ? "31-60" : d <= 90 ? "61-90" : "90+";
    buckets[key] += l.rate_usd ?? 0;
  }

  const markPaid = (l: LoadEnriched) => {
    if (l.id == null) return;
    update.mutate({ id: l.id, paid_at: new Date().toISOString() });
  };
  const undoPaid = (l: LoadEnriched) => {
    if (l.id == null) return;
    update.mutate({ id: l.id, paid_at: null });
  };

  const doExport = () =>
    exportCsv(
      rows.map((l) => ({
        ref: l.ref, customer: l.customer_name, delivered: l.delivered_at,
        amount: l.rate_usd, margin: l.margin_usd, invoice_number: l.invoice_number,
        invoiced_at: l.invoiced_at, due_date: l.invoice_due_date, paid_at: l.paid_at,
        ar_status: AR_LABELS[arStatus(l)], days_outstanding: daysOut(l),
      })),
      "billing_ar",
    );

  return (
    <div>
      <PageHeader
        title="Billing"
        subtitle="Invoice delivered loads and track receivables — invoice the same day you deliver"
        action={<button onClick={doExport} {...exportButtonProps(rows.length)}>Export CSV</button>}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <StatCard label="Ready to invoice" value={isLoading ? "…" : money(sum(notInvoiced))} hint={`${notInvoiced.length} delivered loads`} />
        <StatCard label="Outstanding" value={isLoading ? "…" : money(sum(outstanding))} hint={`${outstanding.length} invoices`} />
        <StatCard label="Overdue" value={isLoading ? "…" : money(sum(overdue))} hint={`${overdue.length} invoices past due`} />
        <StatCard label="Collected" value={isLoading ? "…" : money(sum(paid))} hint={`${paid.length} paid invoices`} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap items-center gap-6">
        <span className="text-sm font-medium text-slate-600">Unpaid aging:</span>
        {Object.entries(buckets).map(([label, amt]) => (
          <span key={label} className="text-sm">
            <span className={`font-semibold ${label === "90+" && amt > 0 ? "text-red-600" : "text-slate-800"}`}>{money(amt)}</span>
            <span className="text-slate-400"> {label} days</span>
          </span>
        ))}
        <div className="ml-auto">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">All billable</option>
            <option value="not_invoiced">Not invoiced</option>
            <option value="outstanding">Outstanding</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>

      <DataTable<LoadEnriched>
        rows={rows}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id ?? Math.random()}
        empty="Nothing to bill yet — loads appear here once delivered."
        columns={[
          { header: "Ref", cell: (r) => <span className="font-medium">{r.ref ?? "—"}</span>, sort: (r) => r.ref },
          { header: "Customer", cell: (r) => r.customer_name ?? "—", sort: (r) => r.customer_name },
          { header: "Delivered", cell: (r) => fmtDate(r.delivered_at), sort: (r) => r.delivered_at },
          { header: "Amount", cell: (r) => money(r.rate_usd), sort: (r) => r.rate_usd },
          {
            header: "Margin",
            cell: (r) =>
              r.margin_usd == null ? "—" : (
                <span className={r.margin_usd >= 0 ? "text-emerald-600" : "text-red-600"}>{money(r.margin_usd)}</span>
              ),
            sort: (r) => r.margin_usd,
          },
          { header: "Invoice #", cell: (r) => r.invoice_number ?? "—", sort: (r) => r.invoice_number },
          { header: "Invoiced", cell: (r) => fmtDate(r.invoiced_at), sort: (r) => r.invoiced_at },
          { header: "Due", cell: (r) => (r.invoice_due_date ? new Date(r.invoice_due_date + "T00:00:00").toLocaleDateString() : "—"), sort: (r) => r.invoice_due_date },
          {
            header: "Days out",
            cell: (r) => {
              const d = daysOut(r);
              if (d == null) return "—";
              return <span className={d > 30 ? "text-red-600 font-medium" : ""}>{d}d</span>;
            },
            sort: (r) => daysOut(r),
          },
          {
            header: "AR status",
            cell: (r) => {
              const st = arStatus(r);
              return (
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${AR_COLORS[st]}`}>
                  {AR_LABELS[st]}
                </span>
              );
            },
            sort: (r) => arStatus(r),
          },
          {
            header: "",
            cell: (r) => {
              const st = arStatus(r);
              return (
                <div className="flex gap-2 justify-end whitespace-nowrap">
                  {st === "not_invoiced" && (
                    <button onClick={() => setInvoicing(r)} className="text-blue-600 hover:underline text-xs font-medium">
                      Create invoice
                    </button>
                  )}
                  {(st === "outstanding" || st === "overdue") && (
                    <>
                      <button onClick={() => setInvoicing(r)} className="text-slate-500 hover:underline text-xs font-medium">
                        Edit
                      </button>
                      <button onClick={() => markPaid(r)} className="text-emerald-600 hover:underline text-xs font-medium">
                        Mark paid
                      </button>
                    </>
                  )}
                  {st === "paid" && (
                    <button onClick={() => undoPaid(r)} className="text-slate-400 hover:underline text-xs font-medium">
                      Undo paid
                    </button>
                  )}
                </div>
              );
            },
          },
        ]}
      />
      {invoicing && <InvoiceModal load={invoicing} onClose={() => setInvoicing(null)} />}
    </div>
  );
}
