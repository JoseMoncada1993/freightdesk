// Public form fill page (/f/:slug) — no sign-in required. Renders an active
// form template and inserts the submission into form_responses (anon RLS
// allows exactly that and nothing more).
import { useState } from "react";
import { useParams } from "react-router-dom";
import { usePublicForm, useSubmitFormResponse } from "@/hooks/useForms";
import { ErrorText, inputCls } from "@/components/ui/Modal";
import type { FormFieldDef } from "@/lib/types";

export default function PublicForm() {
  const { slug } = useParams();
  const { data: form, isLoading, error } = usePublicForm(slug);
  const submit = useSubmitFormResponse();
  const [values, setValues] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [touched, setTouched] = useState(false);

  const fields: FormFieldDef[] =
    form && Array.isArray(form.fields) ? (form.fields as unknown as FormFieldDef[]) : [];

  const setValue = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }));

  const missing = fields.filter(
    (f) => f.required && f.type !== "checkbox" && !(values[f.key] ?? "").trim(),
  );

  const handleSubmit = () => {
    setTouched(true);
    if (!form || missing.length > 0 || submit.isPending) return;
    const data: Record<string, string> = {};
    for (const f of fields) {
      const v = f.type === "checkbox" ? (values[f.key] === "yes" ? "yes" : "no") : (values[f.key] ?? "").trim();
      if (v !== "") data[f.key] = v;
    }
    const submitter = data["email"] ?? data["contact_name"] ?? null;
    submit.mutate(
      { form_id: form.id, data, submitted_by: submitter },
      { onSuccess: () => setDone(true) },
    );
  };

  const shell = (content: React.ReactNode) => (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">{content}</div>
        <p className="mt-4 text-center text-xs text-slate-400">Powered by FreightDesk</p>
      </div>
    </div>
  );

  if (isLoading) return shell(<p className="text-center text-slate-400">Loading…</p>);
  if (error || !form)
    return shell(
      <div className="text-center">
        <h1 className="text-lg font-semibold text-slate-700">Form not available</h1>
        <p className="mt-2 text-sm text-slate-500">
          This form doesn&apos;t exist or is no longer accepting responses. Please contact the person who sent you the link.
        </p>
      </div>,
    );
  if (done)
    return shell(
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</div>
        <h1 className="text-lg font-semibold text-slate-800">Thank you!</h1>
        <p className="mt-2 text-sm text-slate-500">Your response to “{form.name}” has been received.</p>
      </div>,
    );

  return shell(
    <>
      <h1 className="text-xl font-bold text-slate-800">{form.name}</h1>
      {form.description && <p className="mt-1 text-sm text-slate-500">{form.description}</p>}
      <div className="mt-6 space-y-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="mb-1 block text-sm font-medium text-slate-600">
              {f.label} {f.required && <span className="text-red-500">*</span>}
            </label>
            {f.type === "textarea" ? (
              <textarea
                value={values[f.key] ?? ""}
                onChange={(e) => setValue(f.key, e.target.value)}
                rows={3}
                className={inputCls}
              />
            ) : f.type === "select" ? (
              <select value={values[f.key] ?? ""} onChange={(e) => setValue(f.key, e.target.value)} className={inputCls}>
                <option value="">— select —</option>
                {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === "checkbox" ? (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={values[f.key] === "yes"}
                  onChange={(e) => setValue(f.key, e.target.checked ? "yes" : "no")}
                  className="rounded border-slate-300"
                />
                Yes
              </label>
            ) : (
              <input
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"}
                value={values[f.key] ?? ""}
                onChange={(e) => setValue(f.key, e.target.value)}
                className={inputCls}
              />
            )}
          </div>
        ))}
      </div>
      {touched && missing.length > 0 && (
        <p className="mt-4 text-sm text-red-600">
          Please fill in: {missing.map((m) => m.label).join(", ")}
        </p>
      )}
      <ErrorText error={submit.error} />
      <button
        onClick={handleSubmit}
        disabled={submit.isPending}
        className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submit.isPending ? "Submitting…" : "Submit"}
      </button>
    </>,
  );
}
