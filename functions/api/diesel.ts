// Cloudflare Pages Function: server-side proxy for EIA weekly on-highway diesel
// prices — U.S. average plus a PADD-region breakdown. Keeps the EIA API key off
// the client (runtime secret EIA_API_KEY, set via
// `wrangler pages secret put EIA_API_KEY --project-name=freightdesk-app`).
//
// GET /api/diesel -> {
//   period, units, price (national),
//   regions: [{ name, price }]   // national first, then PADD 1-5, California
// }

interface Env {
  EIA_API_KEY?: string;
}

const EIA_BASE = "https://api.eia.gov/v2/petroleum/pri/gnd/data/";

// EIA on-highway No. 2 Diesel retail series (EMD_EPD2D_PTE_<area>_DPG), in the
// order we want to display them. First entry is the national average.
const SERIES: { series: string; name: string }[] = [
  { series: "EMD_EPD2D_PTE_NUS_DPG", name: "U.S. average" },
  { series: "EMD_EPD2D_PTE_R10_DPG", name: "East Coast (PADD 1)" },
  { series: "EMD_EPD2D_PTE_R20_DPG", name: "Midwest (PADD 2)" },
  { series: "EMD_EPD2D_PTE_R30_DPG", name: "Gulf Coast (PADD 3)" },
  { series: "EMD_EPD2D_PTE_R40_DPG", name: "Rocky Mountain (PADD 4)" },
  { series: "EMD_EPD2D_PTE_R50_DPG", name: "West Coast (PADD 5)" },
  { series: "EMD_EPD2D_PTE_SCA_DPG", name: "California" },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Short window: EIA data is weekly, but keep it small so a response-shape
      // change (new fields) can't sit stale in a browser cache for long.
      "cache-control": "public, max-age=300",
    },
  });

export const onRequestGet = async (context: { env: Env }): Promise<Response> => {
  const apiKey = context.env.EIA_API_KEY;
  if (!apiKey) {
    return json({ error: "Diesel price is unavailable: EIA_API_KEY is not configured on the server." }, 500);
  }

  const url = new URL(EIA_BASE);
  url.searchParams.set("frequency", "weekly");
  url.searchParams.append("data[0]", "value");
  for (const s of SERIES) url.searchParams.append("facets[series][]", s.series);
  url.searchParams.set("sort[0][column]", "period");
  url.searchParams.set("sort[0][direction]", "desc");
  url.searchParams.set("offset", "0");
  // A few weeks × 7 series, so the newest complete week is always covered.
  url.searchParams.set("length", "35");
  url.searchParams.set("api_key", apiKey);

  try {
    const res = await fetch(url.toString());
    const data: any = await res.json();

    if (!res.ok) {
      const msg = data?.error?.message || data?.error?.code || `HTTP ${res.status}`;
      return json({ error: String(msg) }, 502);
    }

    const rows: any[] = Array.isArray(data?.response?.data) ? data.response.data : [];
    if (rows.length === 0) {
      return json({ error: "No diesel price data returned." }, 502);
    }

    // Use the most recent period present in the response.
    const period = rows.reduce((m, r) => (String(r.period) > m ? String(r.period) : m), "");
    const units = String(rows[0].units || "$/GAL");

    const bySeries = new Map<string, number>();
    for (const r of rows) {
      if (String(r.period) !== period) continue;
      const v = Number(r.value);
      if (!Number.isNaN(v)) bySeries.set(String(r.series), v);
    }

    const regions = SERIES
      .map(({ series, name }) => ({ name, price: bySeries.get(series) }))
      .filter((r): r is { name: string; price: number } => typeof r.price === "number");

    const national = bySeries.get(SERIES[0].series);
    if (national == null || regions.length === 0) {
      return json({ error: "No diesel price data returned." }, 502);
    }

    return json({ period, units, price: national, regions });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Failed to load diesel price." }, 502);
  }
};
