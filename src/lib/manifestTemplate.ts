// Manifest import template ("Manifest Import Template 4.2.26"). A manifest is
// the item-level detail of a load: source files (Wayfair exports, supplier
// manifests…) are mapped column-by-column onto these 22 headers. SKU / Store /
// pricing columns are filled from the linked SKU and the manifest's price %.
import type { Manifest, Sku, SkuConvention } from "@/lib/types";

export const MANIFEST_HEADERS = [
  "SKU", "Store", "Pallet ID", "Item ID", "UPC", "Description", "Category",
  "Subcategory", "Subcategory II", "Manufacturer", "Model", "Size", "Color",
  "Quantity", "Appx. EXT Retail", "Appx. Unit Retail",
  "Approx. EXT Wholesale Value", "Approx. Unit Wholesale Value",
  "Your Price %", "Your EXT Price", "Your Unit Price $", "Notes",
] as const;

export type ManifestHeader = (typeof MANIFEST_HEADERS)[number];

/** Columns a source file can map onto (the rest are computed at export). */
export const MAPPABLE_HEADERS: ManifestHeader[] = [
  "Pallet ID", "Item ID", "UPC", "Description", "Category", "Subcategory",
  "Subcategory II", "Manufacturer", "Model", "Size", "Color", "Quantity",
  "Appx. EXT Retail", "Appx. Unit Retail", "Approx. EXT Wholesale Value",
  "Approx. Unit Wholesale Value", "Notes",
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Known source-header spellings per template column, used to auto-guess the
// mapping (normalized: lowercase, alphanumerics only).
const ALIASES: Record<string, string[]> = {
  "Pallet ID": ["palletid", "pallet", "palletnumber"],
  "Item ID": ["itemid", "wayfairid", "itemnumber", "item", "asin", "lpn"],
  "UPC": ["upc", "productupcorean", "upcean", "ean", "gtin", "barcode"],
  "Description": ["description", "productname", "itemdescription", "title", "productdescription", "itemname"],
  "Category": ["category", "productcategory", "department"],
  "Subcategory": ["subcategory", "producttype", "subcat"],
  "Subcategory II": ["subcategoryii", "subcategory2", "subcatii"],
  "Manufacturer": ["manufacturer", "productmanufacturer", "brand", "vendor", "make"],
  "Model": ["model", "productpartnumber", "partnumber", "modelnumber", "mpn", "sku"],
  "Size": ["size", "dimensions"],
  "Color": ["color", "productstyle", "colour", "style"],
  "Quantity": ["quantity", "qty", "units", "unitcount", "itemqty", "pieces"],
  "Appx. EXT Retail": ["appxextretail", "extretail", "extendedretail", "totalretail", "retailtotal", "extretailvalue", "totalmsrp"],
  "Appx. Unit Retail": ["appxunitretail", "unitretail", "retailprice", "retail", "msrp", "pricepercarton", "unitprice", "listprice"],
  "Approx. EXT Wholesale Value": ["approxextwholesalevalue", "extwholesale", "totalwholesale", "wholesaletotal"],
  "Approx. Unit Wholesale Value": ["approxunitwholesalevalue", "unitwholesale", "wholesale", "wholesaleprice", "cost", "unitcost"],
  "Notes": ["notes", "comments", "remarks", "productimageurl", "imageurl"],
};

/** Guess a source→template mapping from the source header names. */
export function guessMapping(sourceHeaders: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const taken = new Set<string>();
  for (const src of sourceHeaders) {
    const n = norm(src);
    if (!n) continue;
    for (const [target, aliases] of Object.entries(ALIASES)) {
      if (taken.has(target)) continue;
      if (aliases.includes(n) || norm(target) === n) {
        out[src] = target;
        taken.add(target);
        break;
      }
    }
  }
  return out;
}

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(String(v).replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export interface NormalizedManifest {
  rows: Record<string, string>[];
  itemCount: number;
  totalQty: number;
  extRetail: number;
}

/**
 * Apply a source→template mapping to a parsed grid. Rows become objects keyed
 * by template header; totals are derived (EXT retail falls back to qty × unit
 * retail when the file has no EXT column).
 */
export function normalizeManifest(
  grid: string[][],
  headerRowIdx: number,
  mapping: Record<string, string>,
): NormalizedManifest {
  const headers = grid[headerRowIdx] ?? [];
  const rows: Record<string, string>[] = [];
  let totalQty = 0;
  let extRetail = 0;

  for (let r = headerRowIdx + 1; r < grid.length; r++) {
    const line = grid[r] ?? [];
    if (line.every((c) => (c ?? "").trim() === "")) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      const target = mapping[h];
      if (!target) return;
      const v = (line[i] ?? "").trim();
      if (v !== "") row[target] = v;
    });
    if (Object.keys(row).length === 0) continue;

    // "Appx. Unit Retail" only ever holds a number — values with other
    // characters ("N/A", "call for price") are dropped, not imported.
    if (row["Appx. Unit Retail"] != null) {
      const clean = num(row["Appx. Unit Retail"]);
      if (clean == null) delete row["Appx. Unit Retail"];
      else row["Appx. Unit Retail"] = String(clean);
    }

    const qty = num(row["Quantity"]) ?? 1;
    const unitRetail = num(row["Appx. Unit Retail"]);
    let ext = num(row["Appx. EXT Retail"]);
    if (ext == null && unitRetail != null) {
      ext = qty * unitRetail;
      row["Appx. EXT Retail"] = ext.toFixed(2);
    }
    totalQty += qty;
    extRetail += ext ?? 0;
    rows.push(row);
  }
  return { rows, itemCount: rows.length, totalQty, extRetail: Math.round(extRetail * 100) / 100 };
}

/**
 * Pick the most specific pricing rule for a SKU:
 * supplier+location+program → supplier+program → supplier+location → supplier.
 * Falls back to the convention's price_highlight ("% of Retail") if present.
 */
export function autoPricePct(
  sku: Sku | undefined,
  rules: { supplier: string; location: string | null; program: string | null; pct: number }[],
  convention?: SkuConvention,
): number | null {
  if (sku?.supplier) {
    const s = sku.supplier.toLowerCase();
    const l = (sku.location ?? "").toLowerCase();
    const p = (sku.program ?? "").toLowerCase();
    const candidates = rules.filter((r) => r.supplier.toLowerCase() === s);
    const score = (r: { location: string | null; program: string | null }) => {
      const rl = (r.location ?? "").toLowerCase();
      const rp = (r.program ?? "").toLowerCase();
      if (rl && rl !== l) return -1;
      if (rp && rp !== p) return -1;
      return (rl ? 2 : 0) + (rp ? 1 : 0);
    };
    let best: { pct: number } | null = null;
    let bestScore = -1;
    for (const r of candidates) {
      const sc = score(r);
      if (sc > bestScore) { bestScore = sc; best = r; }
    }
    if (best) return best.pct;
  }
  const tpl = convention?.product_template;
  if (tpl && typeof tpl === "object" && !Array.isArray(tpl)) {
    const hl = num((tpl as Record<string, unknown>)["price_highlight"]);
    const isPct = String((tpl as Record<string, unknown>)["price_highlight_id"] ?? "") === "% of Retail";
    if (hl != null && isPct) return hl;
  }
  return null;
}

/** Source file name without folders or extension (WYFLTXLQ51182.xlsx → WYFLTXLQ51182). */
export function fileBaseName(name: string | null): string {
  if (!name) return "";
  const base = name.split(/[\\/]/).pop() ?? "";
  return base.replace(/\.(csv|xlsx|xls|xlsm|pdf)$/i, "");
}

export function conventionStore(convention?: SkuConvention): string {
  const tpl = convention?.product_template;
  return tpl && typeof tpl === "object" && !Array.isArray(tpl)
    ? String((tpl as Record<string, unknown>)["store"] ?? "")
    : "";
}

/**
 * Build [headers, ...rows] in the 22-column template for export.
 * SKU column = the source file name without its extension (falls back to the
 * linked SKU); Store = the manifest's store (falls back to the convention's).
 */
export function buildManifestExportRows(
  manifest: Manifest,
  sku: Sku | undefined,
  convention?: SkuConvention,
): (string | number | null)[][] {
  const rows = Array.isArray(manifest.rows) ? (manifest.rows as Record<string, string>[]) : [];
  const skuLabel = fileBaseName(manifest.file_name) || (sku?.sku ?? "");
  const store = manifest.store ?? conventionStore(convention);
  const pct = manifest.price_pct;

  const out: (string | number | null)[][] = [MANIFEST_HEADERS.slice()];
  for (const row of rows) {
    const qty = num(row["Quantity"]) ?? 1;
    const ext = num(row["Appx. EXT Retail"]);
    const extPrice = pct != null && ext != null ? Math.round(ext * (pct / 100) * 100) / 100 : null;
    const unitPrice = extPrice != null && extPrice !== 0 && qty > 0 ? Math.round((extPrice / qty) * 100) / 100 : null;
    // A row with no (or zero) EXT price gets no Price % either.
    const rowPct = extPrice != null && extPrice !== 0 ? pct : null;
    out.push(
      MANIFEST_HEADERS.map((h): string | number | null => {
        if (h === "SKU") return skuLabel;
        if (h === "Store") return store;
        if (h === "Your Price %") return rowPct ?? "";
        if (h === "Your EXT Price") return extPrice != null && extPrice !== 0 ? extPrice : "";
        if (h === "Your Unit Price $") return unitPrice ?? "";
        if (h === "Appx. Unit Retail") return num(row[h]) ?? "";
        return row[h] ?? "";
      }),
    );
  }
  return out;
}

// ---- SKU Generator hand-off ---------------------------------------------------

/** Column sums for a stored manifest (Your EXT Price derived from price %). */
export function manifestSums(manifest: Manifest): { qty: number; extRetail: number; extPrice: number } {
  const rows = Array.isArray(manifest.rows) ? (manifest.rows as Record<string, string>[]) : [];
  const pct = manifest.price_pct;
  let qty = 0;
  let extRetail = 0;
  let extPrice = 0;
  for (const row of rows) {
    qty += num(row["Quantity"]) ?? 1;
    const ext = num(row["Appx. EXT Retail"]) ?? 0;
    extRetail += ext;
    if (pct != null) extPrice += Math.round(ext * (pct / 100) * 100) / 100;
  }
  return {
    qty,
    extRetail: Math.round(extRetail * 100) / 100,
    extPrice: Math.round(extPrice * 100) / 100,
  };
}

const r2 = (n: number) => String(Math.round(n * 100) / 100);

/**
 * Product-template export fields derived from a manifest, used to update or
 * create the load's SKU on the SKU Generator dashboard:
 * qty=ΣQuantity, retail_price=ΣEXT retail, retail_price_per_unit=retail/qty,
 * price=ΣYour EXT Price, price_per_unit=price/qty,
 * price_highlight=price/retail×100 (2dp), price_highlight_id="% of Retail".
 */
export function skuFieldsFromManifest(manifest: Manifest): Record<string, string> {
  const { qty, extRetail, extPrice } = manifestSums(manifest);
  const out: Record<string, string> = {};
  if (qty > 0) out.qty = r2(qty);
  if (extRetail > 0) out.retail_price = r2(extRetail);
  if (extRetail > 0 && qty > 0) out.retail_price_per_unit = r2(extRetail / qty);
  if (extPrice > 0) {
    out.price = r2(extPrice);
    if (qty > 0) out.price_per_unit = r2(extPrice / qty);
    if (extRetail > 0) {
      out.price_highlight = r2((extPrice / extRetail) * 100);
      out.price_highlight_id = "% of Retail";
    }
  }
  return out;
}
