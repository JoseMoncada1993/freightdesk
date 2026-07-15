// Forms module: build data-collection forms (shipping quote request, pickup
// request, …), share them by public link or email, and review the responses.
// The public fill page lives at /f/:slug and needs no sign-in.
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import Modal, { Field, ModalActions, inputCls, ErrorText } from "@/components/ui/Modal";
import { useAuth } from "@/lib/AuthContext";
import {
  useFormTemplates, useSaveFormTemplate, useDeleteFormTemplate,
  useFormResponses, useDeleteFormResponse,
} from "@/hooks/useForms";
import { exportCsv } from "@/lib/csv";
import { FORM_FIELD_TYPES } from "@/lib/types";
import type { FormFieldDef, FormResponse, FormTemplate } from "@/lib/types";

const fmtDateTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

const slugify = (name: string) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-${Math.random().toString(36).slice(2, 8)}`;

const keyFromLabel = (label: string) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const fieldsOf = (t: FormTemplate): FormFieldDef[] =>
  Array.isArray(t.fields) ? (t.fields as unknown as FormFieldDef[]) : [];

const publicUrl = (t: FormTemplate) => `${window.location.origin}/f/${t.slug}`;

// ---- Quick-start templates ---------------------------------------------------
const f = (label: string, type: FormFieldDef["type"], required = false, options?: string[]): FormFieldDef => ({
  key: keyFromLabel(label), label, type, required, ...(options ? { options } : {}),
});

const QUICK_STARTS: { name: string; description: string; fields: FormFieldDef[] }[] = [
  {
    name: "Shipping Quote Request",
    description: "Tell us about your freight and we'll get back to you with a quote.",
    fields: [
      f("Contact name", "text", true),
      f("Company", "text", true),
      f("Email", "email", true),
      f("Phone", "phone"),
      f("Pickup city & state", "text", true),
      f("Pickup zip", "text"),
      f("Delivery city & state", "text", true),
      f("Delivery zip", "text"),
      f("Equipment type", "select", true, ["Dry van 53'", "Reefer", "Flatbed", "Box truck", "Sprinter", "Other"]),
      f("Pallet count", "number"),
      f("Total weight (lbs)", "number"),
      f("Freight ready date", "date"),
      f("Commodity / description", "text"),
      f("Notes", "textarea"),
    ],
  },
  {
    name: "Pickup Request",
    description: "Schedule a pickup — give us the where and when.",
    fields: [
      f("Contact name", "text", true),
      f("Company", "text", true),
      f("Email", "email", true),
      f("Phone", "phone"),
      f("PO / reference #", "text"),
      f("Pickup address", "text", true),
      f("Pickup city, state, zip", "text", true),
      f("Requested pickup date", "date", true),
      f("Pickup hours", "text"),
      f("Pallet count", "number"),
      f("Total weight (lbs)", "number"),
      f("Delivery location", "text"),
      f("Special instructions", "textarea"),
    ],
  },
];

// ---- Form builder (add / edit template) ---------------------------------------
function FormBuilderModal({
  existing,
  preset,
  onClose,
}: {
  existing: FormTemplate | null;
  preset?: { name: string; description: string; fields: FormFieldDef[] };
  onClose: () => void;
}) {
  const save = useSaveFormTemplate();
  const [name, setName] = useState(existing?.name ?? preset?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? preset?.description ?? "");
  const [active, setActive] = useState(existing?.active ?? true);
  const [fields, setFields] = useState<FormFieldDef[]>(
    existing ? fieldsOf(existing) : (preset?.fields ?? []),
  );

  const setField = (i: number, patch: Partial<FormFieldDef>) =>
    setFields((prev) => prev.map((fl, j) => (j === i ? { ...fl, ...patch } : fl)));
  const move = (i: number, dir: -1 | 1) =>
    setFields((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const remove = (i: number) => setFields((prev) => prev.filter((_, j) => j !== i));
  const addField = () => setFields((prev) => [...prev, { key: "", label: "", type: "text" }]);

  const canSave =
    name.trim() !== "" &&
    fields.length > 0 &&
    fields.every((fl) => fl.label.trim() !== "") &&
    !save.isPending;

  const submit = () => {
    if (!canSave) return;
    // Keys come from labels; keep existing keys stable so old responses still line up.
    const seen = new Set<string>();
    const normalized = fields.map((fl) => {
      let key = fl.key || keyFromLabel(fl.label);
      while (seen.has(key)) key = `${key}_2`;
      seen.add(key);
      return { ...fl, key, label: fl.label.trim() };
    });
    save.mutate(
      {
        id: existing?.id,
        slug: existing?.slug ?? slugify(name),
        name: name.trim(),
        description: description.trim() || null,
        active,
        fields: normalized as never,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      title={existing ? `Edit form — ${existing.name}` : "New form"}
      onClose={onClose}
      wide
      footer={<ModalActions onCancel={onClose} onSubmit={submit} submitLabel="Save form" pending={save.isPending} disabled={!canSave} />}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Form name *">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shipping Quote Request" className={inputCls} />
        </Field>
        <Field label="Status">
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-slate-300" />
            Active — the public link works
          </label>
        </Field>
      </div>
      <Field label="Intro text (shown at the top of the form)">
        <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
      </Field>

      <div className="rounded-lg border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <span className="text-sm font-medium text-slate-700">Fields ({fields.length})</span>
          <button onClick={addField} className="text-sm font-medium text-blue-600 hover:underline">+ Add field</button>
        </div>
        <div className="max-h-[45vh] space-y-2 overflow-y-auto p-3">
          {fields.map((fl, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-2 py-2">
              <input
                value={fl.label}
                onChange={(e) => setField(i, { label: e.target.value })}
                placeholder="Field label"
                className="w-48 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
              <select
                value={fl.type}
                onChange={(e) => setField(i, { type: e.target.value as FormFieldDef["type"] })}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              >
                {FORM_FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {fl.type === "select" && (
                <input
                  value={(fl.options ?? []).join(", ")}
                  onChange={(e) => setField(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  placeholder="Options, comma separated"
                  className="w-52 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
              )}
              <label className="flex items-center gap-1 text-xs text-slate-500">
                <input type="checkbox" checked={!!fl.required} onChange={(e) => setField(i, { required: e.target.checked })} className="rounded border-slate-300" />
                req.
              </label>
              <div className="flex gap-1 text-xs">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded border border-slate-300 px-1.5 py-0.5 text-slate-500 disabled:opacity-30">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === fields.length - 1} className="rounded border border-slate-300 px-1.5 py-0.5 text-slate-500 disabled:opacity-30">↓</button>
                <button onClick={() => remove(i)} className="rounded border border-red-200 px-1.5 py-0.5 text-red-500">×</button>
              </div>
            </div>
          ))}
          {fields.length === 0 && <p className="py-4 text-center text-sm text-slate-400">No fields yet — add one or start from a template.</p>}
        </div>
      </div>
      <ErrorText error={save.error} />
    </Modal>
  );
}

// ---- Share by email ------------------------------------------------------------
function ShareModal({ template, onClose }: { template: FormTemplate; onClose: () => void }) {
  const url = publicUrl(template);
  const [to, setTo] = useState("");
  const [copied, setCopied] = useState(false);

  const subject = `${template.name} — please fill out this form`;
  const body = `Hello,\n\nPlease fill out this quick form: ${template.name}\n\n${url}\n\nThank you!`;
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal title={`Share — ${template.name}`} onClose={onClose}
      footer={<button onClick={onClose} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Done</button>}
    >
      <Field label="Public link (no sign-in needed)">
        <div className="flex gap-2">
          <input readOnly value={url} className={`${inputCls} font-mono text-xs`} onFocus={(e) => e.target.select()} />
          <button onClick={copy} className="shrink-0 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </Field>
      <Field label="Send by email">
        <div className="flex gap-2">
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@example.com (optional)" className={inputCls} />
          <a href={mailto} className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Open email
          </a>
        </div>
        <p className="mt-1 text-xs text-slate-400">Opens your mail app with the link and a short message pre-filled.</p>
      </Field>
      {!template.active && (
        <p className="text-sm text-amber-600">This form is inactive — the link shows &quot;form not available&quot; until you activate it.</p>
      )}
    </Modal>
  );
}

// ---- Responses viewer ------------------------------------------------------------
function ResponsesModal({
  template,
  responses,
  onClose,
}: {
  template: FormTemplate;
  responses: FormResponse[];
  onClose: () => void;
}) {
  const del = useDeleteFormResponse();
  const { can } = useAuth();
  const fields = fieldsOf(template);

  const valueOf = (r: FormResponse, key: string): string => {
    const d = r.data as Record<string, unknown> | null;
    const v = d?.[key];
    return v == null || v === "" ? "" : String(v);
  };

  const doExport = () =>
    exportCsv(
      responses.map((r) => ({
        submitted: fmtDateTime(r.created_at),
        ...Object.fromEntries(fields.map((fl) => [fl.key, valueOf(r, fl.key)])),
      })),
      `${template.slug}_responses`,
    );

  return (
    <Modal title={`Responses — ${template.name} (${responses.length})`} onClose={onClose} wide
      footer={
        <>
          <button onClick={doExport} disabled={responses.length === 0}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            Export CSV
          </button>
          <button onClick={onClose} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Done</button>
        </>
      }
    >
      {responses.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No responses yet — share the link to start collecting.</p>
      ) : (
        <div className="max-h-[55vh] overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Submitted</th>
                {fields.map((fl) => (
                  <th key={fl.key} className="whitespace-nowrap px-3 py-2 font-medium">{fl.label}</th>
                ))}
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {responses.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{fmtDateTime(r.created_at)}</td>
                  {fields.map((fl) => (
                    <td key={fl.key} className="px-3 py-2">{valueOf(r, fl.key) || "—"}</td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    {can("forms") && (
                      <button
                        onClick={() => { if (confirm("Delete this response?")) del.mutate(r.id); }}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

export default function Forms() {
  const { can } = useAuth();
  const canWrite = can("forms");
  const { data: templates, isLoading, error } = useFormTemplates();
  const responses = useFormResponses();
  const save = useSaveFormTemplate();
  const del = useDeleteFormTemplate();

  const [building, setBuilding] = useState<FormTemplate | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [preset, setPreset] = useState<(typeof QUICK_STARTS)[number] | undefined>(undefined);
  const [sharing, setSharing] = useState<FormTemplate | null>(null);
  const [viewing, setViewing] = useState<FormTemplate | null>(null);

  const responseCount = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of responses.data ?? []) m.set(r.form_id, (m.get(r.form_id) ?? 0) + 1);
    return m;
  }, [responses.data]);

  const openNew = (p?: (typeof QUICK_STARTS)[number]) => {
    setPreset(p);
    setShowNew(true);
  };

  return (
    <div>
      <PageHeader
        title="Forms"
        subtitle="Build data-collection forms and send the link by email — shipping quote requests, pickup requests, and anything else. Responses land here."
        action={
          canWrite ? (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {QUICK_STARTS.map((q) => (
                <button key={q.name} onClick={() => openNew(q)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  + {q.name}
                </button>
              ))}
              <button onClick={() => openNew(undefined)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                + New form
              </button>
            </div>
          ) : undefined
        }
      />

      <DataTable<FormTemplate>
        rows={templates}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        empty="No forms yet. Start from a quick-start template or build your own."
        columns={[
          { header: "Form", cell: (r) => <span className="font-medium">{r.name}</span>, sort: (r) => r.name },
          { header: "Fields", cell: (r) => fieldsOf(r).length, sort: (r) => fieldsOf(r).length },
          {
            header: "Responses",
            cell: (r) => (
              <button onClick={() => setViewing(r)} className="font-medium text-blue-600 hover:underline">
                {responseCount.get(r.id) ?? 0}
              </button>
            ),
            sort: (r) => responseCount.get(r.id) ?? 0,
          },
          {
            header: "Status",
            cell: (r) =>
              canWrite ? (
                <button
                  onClick={() => save.mutate({ id: r.id, slug: r.slug, name: r.name, fields: r.fields, active: !r.active })}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                  title="Toggle active"
                >
                  {r.active ? "Active" : "Inactive"}
                </button>
              ) : (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {r.active ? "Active" : "Inactive"}
                </span>
              ),
            sort: (r) => (r.active ? 0 : 1),
          },
          { header: "Created", cell: (r) => fmtDateTime(r.created_at).split(",")[0], sort: (r) => r.created_at },
          {
            header: "",
            cell: (r) => (
              <div className="flex justify-end gap-3 whitespace-nowrap text-xs font-medium">
                <button onClick={() => setSharing(r)} className="text-blue-600 hover:underline">Share</button>
                <a href={`/f/${r.slug}`} target="_blank" rel="noreferrer" className="text-slate-500 hover:underline">Preview</a>
                {canWrite && (
                  <>
                    <button onClick={() => setBuilding(r)} className="text-slate-500 hover:underline">Edit</button>
                    <button
                      onClick={() => { if (confirm(`Delete form "${r.name}" and all its responses?`)) del.mutate(r.id); }}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ),
          },
        ]}
      />

      {(showNew || building) && (
        <FormBuilderModal
          existing={building}
          preset={building ? undefined : preset}
          onClose={() => { setShowNew(false); setBuilding(null); setPreset(undefined); }}
        />
      )}
      {sharing && <ShareModal template={sharing} onClose={() => setSharing(null)} />}
      {viewing && (
        <ResponsesModal
          template={viewing}
          responses={(responses.data ?? []).filter((r) => r.form_id === viewing.id)}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
