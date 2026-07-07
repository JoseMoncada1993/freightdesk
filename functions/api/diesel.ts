// Cloudflare Pages Function: server-side proxy for the EIA weekly diesel price.
// Keeps the EIA API key off the client — it's a runtime secret (EIA_API_KEY)
// set on the Pages project via `wrangler pages secret put EIA_API_KEY`, never
// shipped to the browser or committed to the repo.
//
// Responds to GET /api/diesel with { price, period, units } or { error }.

interface Env {
  EIA_API_KEY?: string;
}

const EIA_SERIES = "EMD_EPD2D_PTE_NUS_DPG";
const EIA_BASE = "https://api.eia.gov/v2/petroleum/pri/gnd/data/";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Weekly data — cache at the edge for an hour to avoid hammering EIA.
      "cache-control": "public, max-age=3600",
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
  url.searchParams.set("facets[series][]", EIA_SERIES);
  url.searchParams.set("sort[0][column]", "period");
  url.searchParams.set("sort[0][direction]", "desc");
  url.searchParams.set("offset", "0");
  url.searchParams.set("length", "1");
  url.searchParams.set("api_key", apiKey);

  try {
    const res = await fetch(url.toString());
    const data: any = await res.json();

    if (!res.ok) {
      const msg = data?.error?.message || data?.error?.code || `HTTP ${res.status}`;
      return json({ error: String(msg) }, 502);
    }

    const row = Array.isArray(data?.response?.data) ? data.response.data[0] : undefined;
    const value = row ? Number(row.value) : NaN;
    if (!row || Number.isNaN(value)) {
      return json({ error: "No diesel price data returned." }, 502);
    }

    return json({
      price: value,
      period: String(row.period),
      units: String(row.units || "$/GAL"),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Failed to load diesel price." }, 502);
  }
};
