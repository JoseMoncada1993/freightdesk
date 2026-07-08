// Product-upload ("blue header") template used by the SKU dashboard export.
// Column order matches SKU Convention Updated.xlsx. Each generated SKU exports
// as one row: the `sku` column holds the generated SKU, the rest come from the
// supplier's stored product_template (sku_conventions.product_template).
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

type Cell = string | number | null;

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
    const tpl = (conv?.product_template ?? {}) as Record<string, unknown>;
    rows.push(
      PRODUCT_TEMPLATE_HEADERS.map((h): Cell => {
        if (h === "sku") return s.sku;
        const v = tpl[h];
        return v == null ? "" : (v as Cell);
      }),
    );
  }
  return rows;
}
