// Product-upload ("blue header") template used by the SKU dashboard export.
// Column order matches SKU Convention Updated.xlsx. Each generated SKU exports
// as one row: the `sku` column holds the generated SKU, the rest come from the
// supplier's stored product_template (sku_conventions.product_template) with
// any per-SKU overrides (skus.export_fields) merged on top.
import type { Sku, SkuConvention } from "@/lib/types";

export const PRODUCT_TEMPLATE_HEADERS = [
  "sku", "supplier", "name", "name_es", "qty", "retail_price", "retail_price_per_unit",
  "price_per_pallet", "price", "pallets_qty", "active", "cloud", "psku", "weight", "packing",
  "subpacking", "category_1", "category_2", "fob_state", "price_per_unit", "manifest_status",
  "peachtree_code", "peachtree_qty", "product_condition", "program", "store", "unit_type", "upc",
  "has_childs", "slug", "slug_es", "redirect", "price_highlight", "price_highlight_id",
  "price_highlight_display", "fob_zip", "taxable", "make_an_offer", "supplier_cost",
  "supplier_cost_percent", "consignment_note", "product_group", "product_type", "restrict_price_change",
] as const;

/** Export columns that are editable per convention / per SKU (all but `sku`). */
export const EDITABLE_TEMPLATE_HEADERS = PRODUCT_TEMPLATE_HEADERS.filter((h) => h !== "sku");

type Cell = string | number | null;

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Convention template merged with a SKU's own export_fields (SKU wins). */
export function mergedExportFields(sku: Sku, conv: SkuConvention | undefined): Record<string, string> {
  const tpl = asRecord(conv?.product_template);
  const own = asRecord(sku.export_fields);
  const out: Record<string, string> = {};
  for (const h of EDITABLE_TEMPLATE_HEADERS) {
    const v = h in own ? own[h] : tpl[h];
    out[h] = v == null ? "" : String(v);
  }
  return out;
}

/** Build [headers, ...rows] for the given SKUs using each supplier's template. */
export function buildProductTemplateRows(
  skus: Sku[],
  conventions: SkuConvention[],
): Cell[][] {
  const bySupplier = new Map<string, SkuConvention>();
  for (const c of conventions) bySupplier.set(c.supplier.toLowerCase(), c);

  const rows: Cell[][] = [PRODUCT_TEMPLATE_HEADERS.slice()];
  for (const s of skus) {
    const conv = s.supplier ? bySupplier.get(s.supplier.toLowerCase()) : undefined;
    const merged = mergedExportFields(s, conv);
    rows.push(
      PRODUCT_TEMPLATE_HEADERS.map((h): Cell => (h === "sku" ? s.sku : (merged[h] ?? ""))),
    );
  }
  return rows;
}

// ---- SKU building helpers (shared by SKU Generator and Shipments) ----------
export const code = (v: string) => v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 3);
export const buildPrefix = (supplier: string, location: string, program: string) =>
  [supplier, location, program].map(code).filter(Boolean).join("-");
export const cleanLoad = (v: string) => v.replace(/[^a-zA-Z0-9-]/g, "").toUpperCase();
