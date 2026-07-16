// Manifest Import: pull manifest files in from an upload, Gmail, or a shared
// Google Drive folder (nested folders included), map the source headers onto
// the 22-column manifest template, link each manifest to a generated SKU, and
// auto-price the load from the Supplier/Location/Program pricing rules.
import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import Modal, { Field, ModalActions, inputCls, ErrorText } from "@/components/ui/Modal";
import { useAuth } from "@/lib/AuthContext";
import { useSkus, useSkuConventions, useUpdateSku } from "@/hooks/useSkus";
import {
  useManifests, useAddManifest, useUpdateManifest, useDeleteManifest,
  useManifestMappings, useSaveManifestMapping,
  usePricingRules, useSavePricingRule, useDeletePricingRule,
  useAppSetting, useSetAppSetting,
} from "@/hooks/useManifests";
import { parseManifestFile, guessHeaderRow } from "@/lib/manifestParse";
import {
  MANIFEST_HEADERS, MAPPABLE_HEADERS, guessMapping, normalizeManifest,
  autoPricePct, buildManifestExportRows, fileBaseName, conventionStore,
} from "@/lib/manifestTemplate";
import {
  getGoogleToken, gmailSearchAttachments, gmailDownloadAttachment,
  driveListRecursive, driveDownload, parseDriveFolderId,
  type GmailAttachment, type DriveFile,
} from "@/lib/googleImport";
import { exportCsv } from "@/lib/csv";
import { downloadXlsx } from "@/lib/xlsx";
import type { Manifest, PricingRule, Sku, SkuConvention } from "@/lib/types";

const money = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

interface PendingFile {
  name: string;
  source: "upload" | "gmail" | "drive";
  sourceRef: string | null;
  grid: string[][];
}

const convFor = (convs: SkuConvention[], sku: Sku | undefined) =>
  sku?.supplier
    ? convs.find((c) => c.supplier.toLowerCase() === sku.supplier!.toLowerCase())
    : undefined;

// Mapping is stored source→template (matches saved mappings); the wizard edits
// it as template→source so the template columns stay fixed on screen.
const toTargetMap = (srcMap: Record<string, string>): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [src, tgt] of Object.entries(srcMap)) out[tgt] = src;
  return out;
};
const toSourceMap = (targetMap: Record<string, string>): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [tgt, src] of Object.entries(targetMap)) if (src) out[src] = tgt;
  return out;
};

// ---- Google client-ID settings (admin) --------------------------------------
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
      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-500 space-y-1">
        <p className="font-medium text-slate-600">One-time setup (free):</p>
        <p>1. console.cloud.google.com → create/select a project</p>
        <p>2. APIs &amp; Services → Library → enable <b>Gmail API</b> and <b>Google Drive API</b></p>
        <p>3. APIs &amp; Services → OAuth consent screen → External → add yourself (and teammates) as test users</p>
        <p>4. Credentials → Create credentials → OAuth client ID → <b>Web application</b> → add authorized JavaScript origin <b>https://freightdesk-app.pages.dev</b></p>
        <p>5. Paste the Client ID above. Access is read-only (Gmail + Drive) and each user signs into their own Google account.</p>
      </div>
      <ErrorText error={save.error} />
    </Modal>
  );
}

// ---- Pricing rules manager ---------------------------------------------------
function PricingRulesModal({ onClose }: { onClose: () => void }) {
  const { data: rules } = usePricingRules();
  const { data: conventions } = useSkuConventions();
  const save = useSavePricingRule();
  const del = useDeletePricingRule();
  const [editing, setEditing] = useState<PricingRule | null>(null);
  const [supplier, setSupplier] = useState("");
  const [location, setLocation] = useState("");
  const [program, setProgram] = useState("");
  const [pct, setPct] = useState("");

  const startEdit = (r: PricingRule) => {
    setEditing(r);
    setSupplier(r.supplier);
    setLocation(r.location ?? "");
    setProgram(r.program ?? "");
    setPct(String(r.pct));
  };
  const reset = () => { setEditing(null); setSupplier(""); setLocation(""); setProgram(""); setPct(""); };
  const canSave = supplier.trim() !== "" && pct.trim() !== "" && !Number.isNaN(Number(pct)) && !save.isPending;

  const submit = () => {
    if (!canSave) return;
    save.mutate(
      {
        id: editing?.id,
        supplier: supplier.trim(),
        location: location.trim() || null,
        program: program.trim() || null,
        pct: Number(pct),
      },
      { onSuccess: reset },
    );
  };

  return (
    <Modal title="Auto-pricing rules" onClose={onClose} wide
      footer={<button onClick={onClose} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Done</button>}
    >
      <p className="text-xs text-slate-400">
        Price = EXT retail × %. Leave Location / Program blank to apply the rule to every load from that supplier;
        the most specific matching rule wins. SKUs with no rule fall back to the convention&apos;s &quot;% of Retail&quot;.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="col-span-2">
          <Field label="Supplier *">
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} list="pr-suppliers" className={inputCls} />
            <datalist id="pr-suppliers">{(conventions ?? []).map((c) => <option key={c.id} value={c.supplier} />)}</datalist>
          </Field>
        </div>
        <Field label="Location"><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="any" className={inputCls} /></Field>
        <Field label="Program"><input value={program} onChange={(e) => setProgram(e.target.value)} placeholder="any" className={inputCls} /></Field>
        <Field label="Price % *"><input value={pct} onChange={(e) => setPct(e.target.value)} inputMode="decimal" placeholder="11.5" className={inputCls} /></Field>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={!canSave}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
          {editing ? "Update rule" : "Add rule"}
        </button>
        {editing && <button onClick={reset} className="text-sm text-slate-500 hover:underline">Cancel edit</button>}
      </div>
      <ErrorText error={save.error} />
      <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Supplier</th>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Program</th>
              <th className="px-3 py-2 font-medium">Price %</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(rules ?? []).map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{r.supplier}</td>
                <td className="px-3 py-2">{r.location ?? <span className="text-slate-400">any</span>}</td>
                <td className="px-3 py-2">{r.program ?? <span className="text-slate-400">any</span>}</td>
                <td className="px-3 py-2 font-medium">{r.pct}%</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-3">
                    <button onClick={() => startEdit(r)} className="text-blue-600 hover:underline text-xs font-medium">Edit</button>
                    <button onClick={() => { if (confirm(`Delete rule for "${r.supplier}"?`)) del.mutate(r.id); }}
                      className="text-red-600 hover:underline text-xs font-medium">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {(rules ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No pricing rules yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

// ---- Import wizard: preview → map headers → link SKU → price → import --------
function ImportWizard({ file, onClose }: { file: PendingFile; onClose: () => void }) {
  const { data: skus } = useSkus();
  const { data: conventions } = useSkuConventions();
  const { data: savedMappings } = useManifestMappings();
  const { data: rules } = usePricingRules();
  const addManifest = useAddManifest();
  const updateSku = useUpdateSku();
  const saveMapping = useSaveManifestMapping();

  const [headerRow, setHeaderRow] = useState(() => guessHeaderRow(file.grid));
  const headers = useMemo(
    () => (file.grid[headerRow] ?? []).map((h) => (h ?? "").trim()),
    [file.grid, headerRow],
  );
  // template header → source header (template side is fixed in the UI).
  const [targetMap, setTargetMap] = useState<Record<string, string>>(() =>
    toTargetMap(guessMapping((file.grid[guessHeaderRow(file.grid)] ?? []).map((h) => (h ?? "").trim()))),
  );
  const [skuQuery, setSkuQuery] = useState("");
  const [pct, setPct] = useState("");
  const pctTouched = useRef(false);
  const [store, setStore] = useState("");
  const storeTouched = useRef(false);
  const [mappingName, setMappingName] = useState("");

  const skuList = useMemo(() => (skus ?? []).filter((s) => !s.archived), [skus]);
  const selectedSku = skuList.find((s) => s.sku.toLowerCase() === skuQuery.trim().toLowerCase());
  const convention = convFor(conventions ?? [], selectedSku);

  // Suggest a SKU: exact match on the file's base name first (files are named
  // after the SKU, e.g. WYFLTXLQ51182.xlsx), then a load # in the name.
  useEffect(() => {
    if (skuQuery !== "") return;
    const base = fileBaseName(file.name).toLowerCase();
    const hay = `${file.name} ${file.sourceRef ?? ""}`.toLowerCase();
    const match =
      skuList.find((s) => s.sku.toLowerCase() === base) ??
      skuList.find((s) => s.load_ref && s.load_ref.length >= 3 && hay.includes(s.load_ref.toLowerCase()));
    if (match) setSkuQuery(match.sku);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skuList.length]);

  // Auto-price + auto-store when the SKU resolves, until the user edits them.
  useEffect(() => {
    if (!pctTouched.current) {
      const auto = autoPricePct(selectedSku, rules ?? [], convention);
      if (auto != null) setPct(String(auto));
    }
    if (!storeTouched.current) {
      const s = conventionStore(convention);
      if (s) setStore(s);
    }
  }, [selectedSku, rules, convention]);

  const normalized = useMemo(
    () => normalizeManifest(file.grid, headerRow, toSourceMap(targetMap)),
    [file.grid, headerRow, targetMap],
  );
  const pctNum = pct.trim() === "" || Number.isNaN(Number(pct)) ? null : Number(pct);
  const extPrice = pctNum != null ? Math.round(normalized.extRetail * (pctNum / 100) * 100) / 100 : null;

  const mappedTargets = MANIFEST_HEADERS.filter((h) => targetMap[h]);

  const applySaved = (name: string) => {
    const m = (savedMappings ?? []).find((x) => x.name === name);
    if (!m || typeof m.mapping !== "object" || m.mapping == null) return;
    const saved = m.mapping as Record<string, string>; // source → template
    const next: Record<string, string> = {};
    for (const h of headers) if (saved[h]) next[saved[h]] = h;
    setTargetMap(next);
  };

  const changeHeaderRow = (idx: number) => {
    setHeaderRow(idx);
    setTargetMap(toTargetMap(guessMapping((file.grid[idx] ?? []).map((h) => (h ?? "").trim()))));
  };

  const canImport = normalized.rows.length > 0 && !addManifest.isPending;

  const doImport = () => {
    if (!canImport) return;
    addManifest.mutate(
      {
        sku_id: selectedSku?.id ?? null,
        source: file.source,
        source_ref: file.sourceRef,
        file_name: file.name,
        store: store.trim() || null,
        mapping: toSourceMap(targetMap) as never,
        rows: normalized.rows as never,
        item_count: normalized.itemCount,
        total_qty: normalized.totalQty,
        ext_retail: normalized.extRetail,
        price_pct: pctNum,
        ext_price: extPrice,
        status: "imported",
      },
      {
        onSuccess: () => {
          // Push pricing onto the linked SKU's product-template export fields.
          if (selectedSku && (extPrice != null || normalized.extRetail > 0)) {
            const fields = {
              ...((selectedSku.export_fields as Record<string, unknown>) ?? {}),
            } as Record<string, unknown>;
            if (extPrice != null) fields.price = String(extPrice);
            if (normalized.extRetail > 0) fields.retail_price = String(normalized.extRetail);
            updateSku.mutate({ id: selectedSku.id, export_fields: fields as never });
          }
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      title={`Import manifest — ${file.name}`}
      onClose={onClose}
      wide
      footer={
        <ModalActions
          onCancel={onClose}
          onSubmit={doImport}
          submitLabel={`Import ${normalized.itemCount} item${normalized.itemCount === 1 ? "" : "s"}`}
          pending={addManifest.isPending}
          disabled={!canImport}
        />
      }
    >
      {/* Header row + saved mappings */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Header row">
          <select value={headerRow} onChange={(e) => changeHeaderRow(Number(e.target.value))} className={inputCls}>
            {file.grid.slice(0, 15).map((r, i) => (
              <option key={i} value={i}>
                Row {i + 1}: {r.filter(Boolean).slice(0, 4).join(", ").slice(0, 40)}…
              </option>
            ))}
          </select>
        </Field>
        <Field label="Apply saved mapping">
          <select value="" onChange={(e) => e.target.value && applySaved(e.target.value)} className={inputCls}>
            <option value="">Choose…</option>
            {(savedMappings ?? []).map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Save current mapping as">
          <div className="flex gap-2">
            <input value={mappingName} onChange={(e) => setMappingName(e.target.value)} placeholder="e.g. Wayfair" className={inputCls} />
            <button
              onClick={() => mappingName.trim() && saveMapping.mutate({ name: mappingName.trim(), mapping: toSourceMap(targetMap) as never }, { onSuccess: () => setMappingName("") })}
              disabled={!mappingName.trim() || saveMapping.isPending}
              className="shrink-0 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </Field>
      </div>

      {/* Header mapping: template columns fixed, pick the source column for each */}
      <div className="max-h-[30vh] overflow-y-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Template column</th>
              <th className="px-3 py-2 font-medium">← Source column from file</th>
            </tr>
          </thead>
          <tbody>
            {MAPPABLE_HEADERS.map((t) => (
              <tr key={t} className="border-t border-slate-100">
                <td className="px-3 py-1.5 text-xs font-medium text-blue-800">{t}</td>
                <td className="px-3 py-1.5">
                  <select
                    value={targetMap[t] ?? ""}
                    onChange={(e) =>
                      setTargetMap((prev) => {
                        const next = { ...prev };
                        const src = e.target.value;
                        if (src) {
                          // A source column feeds one template column at a time.
                          for (const k of Object.keys(next)) if (next[k] === src) delete next[k];
                          next[t] = src;
                        } else {
                          delete next[t];
                        }
                        return next;
                      })
                    }
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                  >
                    <option value="">— not in this file —</option>
                    {headers.map((h, i) =>
                      h === "" ? null : <option key={`${h}-${i}`} value={h}>{h}</option>,
                    )}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Link SKU + pricing */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Field label="Link to SKU">
          <input value={skuQuery} onChange={(e) => setSkuQuery(e.target.value)} list="wiz-skus" placeholder="Search SKU / load #…" className={inputCls} />
          <datalist id="wiz-skus">
            {skuList.map((s) => <option key={s.id} value={s.sku}>{`${s.load_ref ?? ""} ${s.supplier ?? ""}`}</option>)}
          </datalist>
          <p className="mt-1 text-xs text-slate-400">
            {selectedSku
              ? `${selectedSku.supplier ?? "?"}${selectedSku.location ? ` · ${selectedSku.location}` : ""}${selectedSku.program ? ` · ${selectedSku.program}` : ""}`
              : "Type or pick a generated SKU (optional)"}
          </p>
        </Field>
        <Field label="Your Price % (of EXT retail)">
          <input value={pct} onChange={(e) => { pctTouched.current = true; setPct(e.target.value); }} inputMode="decimal" placeholder="auto from pricing rules" className={inputCls} />
        </Field>
        <Field label="Store (template column)">
          <input value={store} onChange={(e) => { storeTouched.current = true; setStore(e.target.value); }} placeholder="e.g. WYF" className={inputCls} />
        </Field>
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2 text-sm self-end">
          <div className="flex justify-between gap-3"><span className="text-slate-500">SKU column</span><span className="font-mono text-xs font-medium">{fileBaseName(file.name) || "—"}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Items / Qty</span><span className="font-medium">{normalized.itemCount} / {normalized.totalQty.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">EXT retail</span><span className="font-medium">{money(normalized.extRetail)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Your EXT price</span><span className="font-semibold text-emerald-700">{money(extPrice)}</span></div>
        </div>
      </div>

      {/* Preview */}
      {normalized.rows.length > 0 && mappedTargets.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-blue-50 text-left text-blue-800">
              <tr>{mappedTargets.map((t) => <th key={t} className="px-2 py-1.5 font-medium whitespace-nowrap">{t}</th>)}</tr>
            </thead>
            <tbody>
              {normalized.rows.slice(0, 5).map((r, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {mappedTargets.map((t) => <td key={t} className="px-2 py-1 whitespace-nowrap max-w-[16rem] truncate">{r[t] ?? ""}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {normalized.rows.length > 5 && (
            <p className="px-3 py-1.5 text-xs text-slate-400">…and {normalized.rows.length - 5} more rows</p>
          )}
        </div>
      )}
      <ErrorText error={addManifest.error} />
    </Modal>
  );
}

// ---- Main page ---------------------------------------------------------------
export default function ManifestImport() {
  const { can, isAdmin } = useAuth();
  const canWrite = can("manifests");
  const { data: manifests, isLoading, error } = useManifests();
  const { data: skus } = useSkus();
  const { data: conventions } = useSkuConventions();
  const updateManifest = useUpdateManifest();
  const updateSku = useUpdateSku();
  const delManifest = useDeleteManifest();
  const { data: clientId } = useAppSetting("google_client_id");

  const [tab, setTab] = useState<"upload" | "gmail" | "drive">("upload");
  const [queue, setQueue] = useState<PendingFile[]>([]);
  const [busy, setBusy] = useState("");
  const [srcError, setSrcError] = useState("");
  const [showPricing, setShowPricing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkPct, setBulkPct] = useState("");

  // Gmail search state
  const [gFrom, setGFrom] = useState("");
  const [gQuery, setGQuery] = useState("");
  const [gDays, setGDays] = useState("30");
  const [gResults, setGResults] = useState<GmailAttachment[] | null>(null);

  // Drive browse state
  const [dFolder, setDFolder] = useState("");
  const [dFilter, setDFilter] = useState("");
  const [dResults, setDResults] = useState<DriveFile[] | null>(null);

  const skuById = useMemo(() => new Map((skus ?? []).map((s) => [s.id, s])), [skus]);

  const enqueue = async (name: string, source: PendingFile["source"], sourceRef: string | null, data: ArrayBuffer) => {
    const grid = await parseManifestFile(name, data);
    if (grid.length === 0) throw new Error(`No readable rows found in ${name}`);
    setQueue((q) => [...q, { name, source, sourceRef, grid }]);
  };

  const onUpload = async (files: FileList | null) => {
    if (!files) return;
    setSrcError("");
    const usable = Array.from(files).filter((f) => /\.(csv|xlsx|xls|xlsm|pdf)$/i.test(f.name));
    if (usable.length === 0) {
      setSrcError("No manifest files (CSV / Excel / PDF) in the selection.");
      return;
    }
    let i = 0;
    for (const f of usable) {
      try {
        i++;
        setBusy(`Parsing ${f.name} (${i}/${usable.length})…`);
        await enqueue(f.name, "upload", null, await f.arrayBuffer());
      } catch (e) {
        setSrcError(errMsg(e));
      }
    }
    setBusy("");
  };

  const needsClientId = !clientId;

  const searchGmail = async () => {
    setSrcError("");
    setGResults(null);
    try {
      setBusy("Searching Gmail…");
      const token = await getGoogleToken(clientId!);
      setGResults(await gmailSearchAttachments(token, { from: gFrom, query: gQuery, days: Number(gDays) || undefined }));
    } catch (e) {
      setSrcError(errMsg(e));
    }
    setBusy("");
  };

  const importGmail = async (a: GmailAttachment) => {
    setSrcError("");
    try {
      setBusy(`Downloading ${a.filename}…`);
      const token = await getGoogleToken(clientId!);
      const data = await gmailDownloadAttachment(token, a.messageId, a.attachmentId);
      await enqueue(a.filename, "gmail", `${a.from} — ${a.subject}`, data);
    } catch (e) {
      setSrcError(errMsg(e));
    }
    setBusy("");
  };

  const browseDrive = async () => {
    setSrcError("");
    setDResults(null);
    try {
      setBusy("Listing Drive folder…");
      const token = await getGoogleToken(clientId!);
      setDResults(await driveListRecursive(token, parseDriveFolderId(dFolder), dFilter.trim() || undefined));
    } catch (e) {
      setSrcError(errMsg(e));
    }
    setBusy("");
  };

  const importDrive = async (f: DriveFile) => {
    setSrcError("");
    try {
      setBusy(`Downloading ${f.name}…`);
      const token = await getGoogleToken(clientId!);
      const { name, data } = await driveDownload(token, f);
      await enqueue(name, "drive", f.path ? `Drive: ${f.path}` : "Drive", data);
    } catch (e) {
      setSrcError(errMsg(e));
    }
    setBusy("");
  };

  const exportManifest = (m: Manifest, kind: "csv" | "xlsx") => {
    const sku = m.sku_id != null ? skuById.get(m.sku_id) : undefined;
    const aoa = buildManifestExportRows(m, sku, convFor(conventions ?? [], sku));
    const base = `manifest_${sku?.sku ?? m.file_name ?? m.id}`.replace(/[^\w.-]+/g, "_");
    if (kind === "xlsx") {
      downloadXlsx(aoa, base, "Manifest");
    } else {
      const [hdr, ...body] = aoa;
      const objs = body.map((r) => Object.fromEntries(hdr!.map((h, i) => [String(h), r[i]])));
      exportCsv(objs, base, hdr!.map((h) => ({ key: String(h) })), { bom: false });
    }
  };

  const repriceManifest = (m: Manifest, pctRaw: string) => {
    const pct = pctRaw.trim() === "" ? null : Number(pctRaw);
    if (pct != null && Number.isNaN(pct)) return;
    const extPrice = pct != null && m.ext_retail != null
      ? Math.round(m.ext_retail * (pct / 100) * 100) / 100
      : null;
    updateManifest.mutate({ id: m.id, price_pct: pct, ext_price: extPrice });
    const sku = m.sku_id != null ? skuById.get(m.sku_id) : undefined;
    if (sku && extPrice != null) {
      const fields = { ...((sku.export_fields as Record<string, unknown>) ?? {}) } as Record<string, unknown>;
      fields.price = String(extPrice);
      updateSku.mutate({ id: sku.id, export_fields: fields as never });
    }
  };

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = (manifests ?? []).length > 0 && (manifests ?? []).every((m) => selected.has(m.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set((manifests ?? []).map((m) => m.id)));

  // One merged CSV: header row once, then every selected manifest's rows (each
  // block keeps its own SKU = file base name, Store and pricing columns).
  const exportMerged = () => {
    const chosen = (manifests ?? []).filter((m) => selected.has(m.id));
    if (chosen.length === 0) return;
    const aoa: (string | number | null)[][] = [MANIFEST_HEADERS.slice()];
    for (const m of chosen) {
      const sku = m.sku_id != null ? skuById.get(m.sku_id) : undefined;
      aoa.push(...buildManifestExportRows(m, sku, convFor(conventions ?? [], sku)).slice(1));
    }
    const [hdr, ...body] = aoa;
    const objs = body.map((r) => Object.fromEntries(hdr!.map((h, i) => [String(h), r[i]])));
    exportCsv(objs, `manifests_merged_${new Date().toISOString().slice(0, 10)}`, hdr!.map((h) => ({ key: String(h) })), { bom: false });
  };

  const applyBulkPct = () => {
    if (bulkPct.trim() === "" || Number.isNaN(Number(bulkPct))) return;
    for (const m of (manifests ?? []).filter((x) => selected.has(x.id))) {
      repriceManifest(m, bulkPct);
    }
    setBulkPct("");
  };

  const tabBtn = (t: typeof tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === t ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Manifest Import"
        subtitle="Fetch manifests from an upload, Gmail, or a shared Drive folder; map the headers to the manifest template; link to a SKU and auto-price the load."
        action={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {canWrite && (
              <button onClick={() => setShowPricing(true)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Pricing rules
              </button>
            )}
            {isAdmin && (
              <button onClick={() => setShowSettings(true)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Google settings
              </button>
            )}
          </div>
        }
      />

      {canWrite && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            {tabBtn("upload", "Upload file")}
            {tabBtn("gmail", "Gmail")}
            {tabBtn("drive", "Google Drive")}
            {busy && <span className="ml-2 text-sm text-slate-500">{busy}</span>}
          </div>

          {tab === "upload" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Select files</label>
                  <input
                    type="file"
                    multiple
                    accept=".csv,.xlsx,.xls,.xlsm,.pdf"
                    onChange={(e) => { void onUpload(e.target.files); e.target.value = ""; }}
                    className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">…or select a whole folder</label>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => { void onUpload(e.target.files); e.target.value = ""; }}
                    className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-600 hover:file:bg-slate-50"
                    {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400">
                CSV, Excel (.xlsx/.xls/.xlsm) or PDF — other file types in a folder are skipped. Each file opens the mapping wizard in turn.
              </p>
            </div>
          )}

          {(tab === "gmail" || tab === "drive") && needsClientId && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              Google isn&apos;t connected yet. {isAdmin
                ? <>Open <button onClick={() => setShowSettings(true)} className="font-medium underline">Google settings</button> to add your OAuth Client ID (free, ~2 min).</>
                : "Ask an admin to add the Google Client ID under Google settings."}
            </div>
          )}

          {tab === "gmail" && !needsClientId && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <Field label="From (sender email)">
                  <input value={gFrom} onChange={(e) => setGFrom(e.target.value)} placeholder="manifests@wayfair.com" className={inputCls} />
                </Field>
                <Field label="Search text (load #, subject…)">
                  <input value={gQuery} onChange={(e) => setGQuery(e.target.value)} placeholder="LD-2105" className={inputCls} />
                </Field>
                <Field label="Look back (days)">
                  <input value={gDays} onChange={(e) => setGDays(e.target.value)} inputMode="numeric" className={inputCls} />
                </Field>
                <div className="flex items-end">
                  <button onClick={() => void searchGmail()} disabled={!!busy}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
                    Search Gmail
                  </button>
                </div>
              </div>
              {gResults && (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {gResults.length === 0 && <li className="px-4 py-4 text-sm text-slate-400">No matching attachments found.</li>}
                  {gResults.map((a) => (
                    <li key={`${a.messageId}-${a.attachmentId}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-700">{a.filename}</div>
                        <div className="truncate text-xs text-slate-400">{a.from} — {a.subject}</div>
                      </div>
                      <button onClick={() => void importGmail(a)} disabled={!!busy}
                        className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                        Import
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "drive" && !needsClientId && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <Field label="Shared folder link or ID">
                    <input value={dFolder} onChange={(e) => setDFolder(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" className={inputCls} />
                  </Field>
                </div>
                <Field label="File name contains (load #…)">
                  <input value={dFilter} onChange={(e) => setDFilter(e.target.value)} placeholder="optional" className={inputCls} />
                </Field>
                <div className="flex items-end">
                  <button onClick={() => void browseDrive()} disabled={!dFolder.trim() || !!busy}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
                    Browse folder
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400">Nested folders are searched automatically (CSV, Excel, PDF and Google Sheets).</p>
              {dResults && (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {dResults.length === 0 && <li className="px-4 py-4 text-sm text-slate-400">No manifest files found in that folder.</li>}
                  {dResults.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-700">{f.name}</div>
                        <div className="truncate text-xs text-slate-400">{f.path || "(folder root)"} · {fmtDate(f.modifiedTime)}</div>
                      </div>
                      <button onClick={() => void importDrive(f)} disabled={!!busy}
                        className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                        Import
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {srcError && <p className="text-sm text-red-600">{srcError}</p>}
        </div>
      )}

      {/* Selection toolbar: merged export + bulk price % */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button onClick={toggleAll}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          {allSelected ? "Clear selection" : "Select all"}
        </button>
        <button onClick={exportMerged} disabled={selected.size === 0}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
          Export merged CSV ({selected.size})
        </button>
        {canWrite && selected.size > 0 && (
          <div className="flex items-center gap-2">
            <input
              value={bulkPct}
              onChange={(e) => setBulkPct(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyBulkPct()}
              inputMode="decimal"
              placeholder="Price %"
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={applyBulkPct}
              disabled={bulkPct.trim() === "" || Number.isNaN(Number(bulkPct))}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
              Apply % to {selected.size}
            </button>
          </div>
        )}
      </div>

      <DataTable<Manifest>
        rows={manifests ?? []}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        empty="No manifests imported yet."
        columns={[
          {
            header: "",
            cell: (r) => (
              <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="rounded border-slate-300" />
            ),
          },
          { header: "File", cell: (r) => <span className="font-medium">{r.file_name ?? "—"}</span>, sort: (r) => r.file_name },
          {
            header: "SKU (export)",
            cell: (r) => <span className="font-mono text-xs">{fileBaseName(r.file_name) || (r.sku_id != null ? skuById.get(r.sku_id)?.sku ?? "—" : "—")}</span>,
            sort: (r) => fileBaseName(r.file_name),
          },
          {
            header: "Linked SKU",
            cell: (r) => {
              const s = r.sku_id != null ? skuById.get(r.sku_id) : undefined;
              return s ? <span className="font-mono text-xs">{s.sku}</span> : <span className="text-slate-400">—</span>;
            },
            sort: (r) => (r.sku_id != null ? skuById.get(r.sku_id)?.sku ?? null : null),
          },
          {
            header: "Store",
            cell: (r) => {
              const s = r.sku_id != null ? skuById.get(r.sku_id) : undefined;
              const fallback = conventionStore(convFor(conventions ?? [], s));
              return canWrite ? (
                <input
                  key={`${r.id}:${r.store ?? ""}`}
                  defaultValue={r.store ?? ""}
                  placeholder={fallback || "—"}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v !== (r.store ?? "")) updateManifest.mutate({ id: r.id, store: v || null }); }}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  className="w-20 rounded-md border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Store column for the template export — saves on blur"
                />
              ) : (
                r.store ?? fallback ?? "—"
              );
            },
            sort: (r) => r.store,
          },
          { header: "Items", cell: (r) => r.item_count ?? "—", sort: (r) => r.item_count },
          { header: "Qty", cell: (r) => r.total_qty?.toLocaleString() ?? "—", sort: (r) => r.total_qty },
          { header: "EXT Retail", cell: (r) => money(r.ext_retail), sort: (r) => r.ext_retail },
          {
            header: "Price %",
            cell: (r) =>
              canWrite ? (
                <input
                  key={`${r.id}:${r.price_pct ?? ""}`}
                  defaultValue={r.price_pct ?? ""}
                  onBlur={(e) => { if (e.target.value !== String(r.price_pct ?? "")) repriceManifest(r, e.target.value); }}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  inputMode="decimal"
                  className="w-16 rounded-md border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Your price % of EXT retail — saves on blur"
                />
              ) : (
                r.price_pct != null ? `${r.price_pct}%` : "—"
              ),
            sort: (r) => r.price_pct,
          },
          {
            header: "Your EXT Price",
            cell: (r) => <span className="font-medium text-emerald-700">{money(r.ext_price)}</span>,
            sort: (r) => r.ext_price,
          },
          { header: "Created", cell: (r) => fmtDate(r.created_at), sort: (r) => r.created_at },
          {
            header: "",
            cell: (r) => (
              <div className="flex justify-end gap-3 whitespace-nowrap">
                <button onClick={() => exportManifest(r, "csv")} className="text-slate-500 hover:underline text-xs font-medium">CSV</button>
                <button onClick={() => exportManifest(r, "xlsx")} className="text-slate-500 hover:underline text-xs font-medium">Excel</button>
                {canWrite && (
                  <button
                    onClick={() => { if (confirm(`Delete manifest "${r.file_name ?? r.id}"?`)) delManifest.mutate(r.id); }}
                    className="text-red-600 hover:underline text-xs font-medium"
                  >
                    Delete
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />

      {queue.length > 0 && (
        <ImportWizard
          key={`${queue[0].name}-${queue.length}`}
          file={queue[0]}
          onClose={() => setQueue((q) => q.slice(1))}
        />
      )}
      {showPricing && <PricingRulesModal onClose={() => setShowPricing(false)} />}
      {showSettings && <GoogleSettingsModal current={clientId ?? null} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
