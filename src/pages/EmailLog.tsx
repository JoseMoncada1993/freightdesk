// Email Data Log: replaces the "Control Tower Loads" Google Sheet + Apps
// Script. Define a rule per supplier (Gmail search + fields to extract from
// the email body), connect Gmail (read-only, same Google Client ID as
// Manifest Import), fetch & parse matching emails, and import them into a
// log — deduped on the Gmail message id, exactly like the old script's
// "Processed" sheet.
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import Modal, { Field, ModalActions, inputCls, ErrorText } from "@/components/ui/Modal";
import { useAuth } from "@/lib/AuthContext";
import { useAppSetting, useSetAppSetting } from "@/hooks/useManifests";
import {
  useEmailRules, useSaveEmailRule, useDeleteEmailRule,
  useEmailLogs, useUpsertEmailLogs, useDeleteEmailLogs,
} from "@/hooks/useEmailLog";
import { getGoogleToken, gmailSearchMessages, type GmailMessage } from "@/lib/googleImport";
import { extractAll } from "@/lib/emailExtract";
import { exportCsv } from "@/lib/csv";
import type { EmailFieldDef, EmailLog, EmailRule } from "@/lib/types";

const fmtDateTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const keyFromLabel = (label: string) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const ruleFields = (r: EmailRule | undefined | null): EmailFieldDef[] =>
  r && Array.isArray(r.fields) ? (r.fields as unknown as EmailFieldDef[]) : [];

const dataOf = (l: EmailLog): Record<string, string> => {
  const d = l.data as Record<string, unknown> | null;
  const out: Record<string, string> = {};
  if (d) for (const [k, v] of Object.entries(d)) if (v != null) out[k] = String(v);
  return out;
};

// ---- Google client-ID settings (admin) — same key as Manifest Import ---------
function GoogleSettingsModal({ current, onClose }: { current: string | null; onClose: () => void }) {
  const save = useSetAppSetting();
  const [value, setValue] = useState(current ?? "");
  return (
    <Modal
      title="Google connection settings"
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          onSubmit={() => save.mutate({ key: "google_client_id", value: value.trim() }, { onSuccess: onClose })}
          submitLabel="Save"
          pending={save.isPending}
        />
      }
    >
      <Field label="Google OAuth Client ID">
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="1234567890-xxxx.apps.googleusercontent.com" className={inputCls} />
      </Field>
      <p className="text-xs text-slate-400">
        Shared with the Manifest Import module — if Gmail already works there, nothing to do here.
      </p>
      <ErrorText error={save.error} />
    </Modal>
  );
}

// ---- Rule editor ---------------------------------------------------------------
function RuleFormModal({ existing, onClose }: { existing: EmailRule | null; onClose: () => void }) {
  const save = useSaveEmailRule();
  const [name, setName] = useState(existing?.name ?? "");
  const [supplier, setSupplier] = useState(existing?.supplier ?? "");
  const [query, setQuery] = useState(existing?.gmail_query ?? "");
  const [fromFilter, setFromFilter] = useState(existing?.from_filter ?? "");
  const [fields, setFields] = useState<EmailFieldDef[]>(ruleFields(existing));

  const setField = (i: number, patch: Partial<EmailFieldDef>) =>
    setFields((prev) => prev.map((fl, j) => (j === i ? { ...fl, ...patch } : fl)));
  const remove = (i: number) => setFields((prev) => prev.filter((_, j) => j !== i));
  const add = () => setFields((prev) => [...prev, { key: "", label: "" }]);

  const canSave =
    name.trim() !== "" && query.trim() !== "" &&
    fields.length > 0 && fields.every((fl) => fl.label.trim() !== "") &&
    !save.isPending;

  const submit = () => {
    if (!canSave) return;
    const seen = new Set<string>();
    const normalized = fields.map((fl) => {
      let key = fl.key || keyFromLabel(fl.label);
      while (seen.has(key)) key = `${key}_2`;
      seen.add(key);
      const out: EmailFieldDef = { key, label: fl.label.trim() };
      if (fl.pattern?.trim()) out.pattern = fl.pattern.trim();
      return out;
    });
    save.mutate(
      {
        id: existing?.id,
        name: name.trim(),
        supplier: supplier.trim() || null,
        gmail_query: query.trim(),
        from_filter: fromFilter.trim() || null,
        fields: normalized as never,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      title={existing ? `Edit rule — ${existing.name}` : "New email rule"}
      onClose={onClose}
      wide
      footer={<ModalActions onCancel={onClose} onSubmit={submit} submitLabel="Save rule" pending={save.isPending} disabled={!canSave} />}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Rule name *">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Control Tower Loads" className={inputCls} />
        </Field>
        <Field label="Supplier">
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Sam's Club Control Tower" className={inputCls} />
        </Field>
        <Field label="Gmail search *">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={'subject:"Control Tower - Load Assigned"'} className={inputCls} />
        </Field>
        <Field label="From (optional)">
          <input value={fromFilter} onChange={(e) => setFromFilter(e.target.value)} placeholder="noreply@supplier.com" className={inputCls} />
        </Field>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <span className="text-sm font-medium text-slate-700">Fields to extract ({fields.length})</span>
          <button onClick={add} className="text-sm font-medium text-blue-600 hover:underline">+ Add field</button>
        </div>
        <p className="px-3 pt-2 text-xs text-slate-400">
          By default a field looks for “Label: value” (or a table cell next to the label) in the email body.
          For anything trickier, add a regex — the first capture group becomes the value.
        </p>
        <div className="max-h-[38vh] space-y-2 overflow-y-auto p-3">
          {fields.map((fl, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-2 py-2">
              <input
                value={fl.label}
                onChange={(e) => setField(i, { label: e.target.value })}
                placeholder="Label in email (e.g. Carrier Name)"
                className="w-52 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
              <input
                value={fl.pattern ?? ""}
                onChange={(e) => setField(i, { pattern: e.target.value })}
                placeholder="Custom regex (optional)"
                className="flex-1 min-w-[10rem] rounded-md border border-slate-300 px-2 py-1 font-mono text-xs"
              />
              <button onClick={() => remove(i)} className="rounded border border-red-200 px-1.5 py-0.5 text-xs text-red-500">×</button>
            </div>
          ))}
          {fields.length === 0 && <p className="py-3 text-center text-sm text-slate-400">No fields yet.</p>}
        </div>
      </div>
      <ErrorText error={save.error} />
    </Modal>
  );
}

// ---- Rules manager ---------------------------------------------------------------
function RulesManagerModal({ onClose }: { onClose: () => void }) {
  const { data: rules } = useEmailRules();
  const del = useDeleteEmailRule();
  const [editing, setEditing] = useState<EmailRule | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <Modal title="Email rules" onClose={onClose} wide
      footer={<button onClick={onClose} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Done</button>}
    >
      <div className="flex justify-end">
        <button onClick={() => setAdding(true)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">+ Add rule</button>
      </div>
      <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Rule</th>
              <th className="px-3 py-2 font-medium">Supplier</th>
              <th className="px-3 py-2 font-medium">Gmail search</th>
              <th className="px-3 py-2 font-medium">Fields</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(rules ?? []).map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2">{r.supplier ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.gmail_query}</td>
                <td className="px-3 py-2">{ruleFields(r).length}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-3 text-xs font-medium">
                    <button onClick={() => setEditing(r)} className="text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => { if (confirm(`Delete rule "${r.name}"? Logged emails stay.`)) del.mutate(r.id); }} className="text-red-600 hover:underline">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {(rules ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No rules yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {adding && <RuleFormModal existing={null} onClose={() => setAdding(false)} />}
      {editing && <RuleFormModal existing={editing} onClose={() => setEditing(null)} />}
    </Modal>
  );
}

// ---- Fetch & import preview -------------------------------------------------------
interface ParsedEmail {
  msg: GmailMessage;
  data: Record<string, string>;
  alreadyLogged: boolean;
}

function ImportPreviewModal({
  rule,
  parsed,
  onClose,
}: {
  rule: EmailRule;
  parsed: ParsedEmail[];
  onClose: () => void;
}) {
  const upsert = useUpsertEmailLogs();
  const fields = ruleFields(rule);
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(parsed.filter((p) => !p.alreadyLogged).map((p) => p.msg.id)),
  );

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const doImport = () => {
    const rows = parsed
      .filter((p) => checked.has(p.msg.id))
      .map((p) => ({
        rule_id: rule.id,
        supplier: rule.supplier,
        gmail_message_id: p.msg.id,
        subject: p.msg.subject || null,
        from_addr: p.msg.from || null,
        received_at: Number.isNaN(new Date(p.msg.date).getTime()) ? null : new Date(p.msg.date).toISOString(),
        data: p.data as never,
      }));
    if (rows.length === 0) return;
    upsert.mutate(rows as never, { onSuccess: onClose });
  };

  const newCount = parsed.filter((p) => !p.alreadyLogged).length;

  return (
    <Modal title={`Fetched ${parsed.length} email${parsed.length === 1 ? "" : "s"} — ${rule.name}`} onClose={onClose} wide
      footer={
        <ModalActions onCancel={onClose} onSubmit={doImport}
          submitLabel={`Import ${checked.size}`} pending={upsert.isPending} disabled={checked.size === 0 || upsert.isPending} />
      }
    >
      <p className="text-xs text-slate-400">
        {newCount} new · {parsed.length - newCount} already logged (skipped by default — duplicates are never re-imported).
        Fields that came back empty may need a custom regex on the rule.
      </p>
      <div className="max-h-[55vh] overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-2 py-2"></th>
              <th className="whitespace-nowrap px-2 py-2 font-medium">Received</th>
              {fields.map((fl) => (
                <th key={fl.key} className="whitespace-nowrap px-2 py-2 font-medium">{fl.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.map((p) => (
              <tr key={p.msg.id} className={`border-t border-slate-100 ${p.alreadyLogged ? "opacity-50" : ""}`}>
                <td className="px-2 py-1.5">
                  {p.alreadyLogged ? (
                    <span className="text-[10px] font-medium text-slate-400">logged</span>
                  ) : (
                    <input type="checkbox" checked={checked.has(p.msg.id)} onChange={() => toggle(p.msg.id)} className="rounded border-slate-300" />
                  )}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-xs text-slate-500">{fmtDateTime(p.msg.date)}</td>
                {fields.map((fl) => (
                  <td key={fl.key} className="whitespace-nowrap px-2 py-1.5">{p.data[fl.key] || <span className="text-red-400">—</span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ErrorText error={upsert.error} />
    </Modal>
  );
}

export default function EmailLogPage() {
  const { can, isAdmin } = useAuth();
  const canWrite = can("emails");
  const { data: rules } = useEmailRules();
  const { data: logs, isLoading, error } = useEmailLogs();
  const delLogs = useDeleteEmailLogs();
  const { data: clientId } = useAppSetting("google_client_id");

  const [ruleFilter, setRuleFilter] = useState<number | "">("");
  const [search, setSearch] = useState("");
  const [days, setDays] = useState("7");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ rule: EmailRule; parsed: ParsedEmail[] } | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const ruleList = useMemo(() => rules ?? [], [rules]);
  const activeRule = ruleList.find((r) => r.id === ruleFilter);
  const ruleById = useMemo(() => new Map(ruleList.map((r) => [r.id, r])), [ruleList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (logs ?? []).filter((l) => {
      if (ruleFilter !== "" && l.rule_id !== ruleFilter) return false;
      if (q) {
        const hay = `${l.subject ?? ""} ${l.supplier ?? ""} ${l.from_addr ?? ""} ${Object.values(dataOf(l)).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, ruleFilter, search]);

  const fetchEmails = async (rule: EmailRule) => {
    setFetching(true);
    setFetchError(null);
    try {
      if (!clientId) throw new Error("Set the Google OAuth Client ID first (gear button, admin only).");
      const token = await getGoogleToken(clientId);
      const msgs = await gmailSearchMessages(token, {
        query: rule.gmail_query,
        from: rule.from_filter ?? undefined,
        days: Number(days) || undefined,
        max: 100,
      });
      const existing = new Set((logs ?? []).map((l) => l.gmail_message_id));
      const fields = ruleFields(rule);
      const parsed: ParsedEmail[] = msgs.map((m) => ({
        msg: m,
        data: extractAll(m.body, fields),
        alreadyLogged: existing.has(m.id),
      }));
      if (parsed.length === 0) setFetchError("No emails matched this rule in that window.");
      else setPreview({ rule, parsed });
    } catch (e) {
      setFetchError(errMsg(e));
    } finally {
      setFetching(false);
    }
  };

  // Columns: with a rule selected, one column per extracted field; otherwise a
  // generic view across all rules.
  const dynamicFields = activeRule ? ruleFields(activeRule) : [];

  const doExport = () => {
    const rows = filtered.map((l) => ({
      received: fmtDateTime(l.received_at),
      rule: l.rule_id != null ? (ruleById.get(l.rule_id)?.name ?? "") : "",
      supplier: l.supplier ?? "",
      subject: l.subject ?? "",
      from: l.from_addr ?? "",
      ...dataOf(l),
    }));
    exportCsv(rows, activeRule ? `email_log_${keyFromLabel(activeRule.name)}` : "email_log");
  };

  return (
    <div>
      <PageHeader
        title="Email Data Log"
        subtitle="Collect and log data from supplier emails — pick a rule, fetch matching Gmail messages, and import the extracted fields. Duplicates are skipped automatically."
        action={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button onClick={doExport} disabled={filtered.length === 0}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              Export CSV
            </button>
            {canWrite && (
              <button onClick={() => setShowRules(true)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Manage rules
              </button>
            )}
            {isAdmin && (
              <button onClick={() => setShowSettings(true)} title="Google connection settings"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                ⚙
              </button>
            )}
          </div>
        }
      />

      {/* Fetch bar */}
      {canWrite && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">Rule / supplier</label>
              <select
                value={ruleFilter}
                onChange={(e) => setRuleFilter(e.target.value === "" ? "" : Number(e.target.value))}
                className={inputCls}
              >
                <option value="">All rules (view only)</option>
                {ruleList.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}{r.supplier ? ` — ${r.supplier}` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Look back</label>
              <select value={days} onChange={(e) => setDays(e.target.value)} className={inputCls}>
                <option value="1">1 day</option>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </select>
            </div>
            <button
              onClick={() => activeRule && fetchEmails(activeRule)}
              disabled={!activeRule || fetching}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {fetching ? "Fetching…" : "Fetch from Gmail"}
            </button>
            <span className="pb-2 text-xs text-slate-400">
              {activeRule ? `Search: ${activeRule.gmail_query}` : "Select a rule to fetch"}
            </span>
          </div>
          {fetchError && <p className="mt-2 text-sm text-red-600">{fetchError}</p>}
        </div>
      )}

      {/* Search + count */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search subject, supplier or extracted data…"
          className="w-80 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-xs text-slate-400">{filtered.length} email{filtered.length === 1 ? "" : "s"} logged</span>
      </div>

      <DataTable<EmailLog>
        rows={filtered}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        empty="Nothing logged yet. Pick a rule and fetch from Gmail."
        columns={[
          { header: "Received", cell: (r) => <span className="whitespace-nowrap text-xs">{fmtDateTime(r.received_at)}</span>, sort: (r) => r.received_at },
          ...(activeRule
            ? dynamicFields.map((fl) => ({
                header: fl.label,
                cell: (r: EmailLog) => dataOf(r)[fl.key] ?? "—",
                sort: (r: EmailLog) => dataOf(r)[fl.key],
              }))
            : [
                {
                  header: "Rule",
                  cell: (r: EmailLog) => (r.rule_id != null ? (ruleById.get(r.rule_id)?.name ?? "—") : "—"),
                  sort: (r: EmailLog) => (r.rule_id != null ? ruleById.get(r.rule_id)?.name : null),
                },
                { header: "Supplier", cell: (r: EmailLog) => r.supplier ?? "—", sort: (r: EmailLog) => r.supplier },
                { header: "Subject", cell: (r: EmailLog) => r.subject ?? "—", sort: (r: EmailLog) => r.subject },
                {
                  header: "Data",
                  cell: (r: EmailLog) => {
                    const d = dataOf(r);
                    const n = Object.keys(d).length;
                    const previewText = Object.entries(d).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(" · ");
                    return <span className="text-xs text-slate-500" title={JSON.stringify(d, null, 2)}>{n} field{n === 1 ? "" : "s"}{previewText ? ` — ${previewText}` : ""}</span>;
                  },
                },
              ]),
          {
            header: "",
            cell: (r) =>
              canWrite ? (
                <button
                  onClick={() => { if (confirm("Delete this logged email? It can be re-imported later.")) delLogs.mutate([r.id]); }}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Delete
                </button>
              ) : null,
          },
        ]}
      />

      {preview && <ImportPreviewModal rule={preview.rule} parsed={preview.parsed} onClose={() => setPreview(null)} />}
      {showRules && <RulesManagerModal onClose={() => setShowRules(false)} />}
      {showSettings && <GoogleSettingsModal current={clientId ?? null} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
