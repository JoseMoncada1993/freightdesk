// Cloudflare Pages Function: admin user management for the Team module.
// Creating users and resetting passwords needs the Supabase service-role key,
// which must never ship to the browser — so those two operations run here.
//
// Setup (one time):
//   wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY --project-name=freightdesk-app
//   (value: Supabase dashboard -> Project Settings -> API -> service_role key)
//
// POST /api/admin-users
//   { action: "create", email, password, full_name? }  -> creates a confirmed user
//   { action: "reset",  user_id, password }            -> sets a new password
// The caller must be signed in as an admin (their JWT is verified server-side).

interface Env {
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_URL?: string;
}

const DEFAULT_URL = "https://pscoehsbcpxnmdgtplon.supabase.co";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const base = env.SUPABASE_URL ?? DEFAULT_URL;
  if (!key) {
    return json(
      { error: "Not configured: set the SUPABASE_SERVICE_ROLE_KEY secret on the freightdesk-app Pages project." },
      503,
    );
  }

  // 1. Identify the caller from their Supabase JWT.
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return json({ error: "Missing auth token" }, 401);
  const userRes = await fetch(`${base}/auth/v1/user`, {
    headers: { apikey: key, authorization: auth },
  });
  if (!userRes.ok) return json({ error: "Invalid session" }, 401);
  const caller = (await userRes.json()) as { id?: string };
  if (!caller.id) return json({ error: "Invalid session" }, 401);

  // 2. The caller must be an admin.
  const profRes = await fetch(
    `${base}/rest/v1/profiles?id=eq.${caller.id}&select=role`,
    { headers: { apikey: key, authorization: `Bearer ${key}` } },
  );
  const prof = (await profRes.json()) as { role?: string }[];
  if (prof[0]?.role !== "admin") return json({ error: "Admins only" }, 403);

  let body: { action?: string; email?: string; password?: string; user_id?: string; full_name?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const admin = (path: string, method: string, payload: unknown) =>
    fetch(`${base}/auth/v1/admin/${path}`, {
      method,
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

  if (body.action === "create") {
    if (!body.email?.trim() || !body.password || body.password.length < 6) {
      return json({ error: "Email and a password of at least 6 characters are required" }, 400);
    }
    const res = await admin("users", "POST", {
      email: body.email.trim(),
      password: body.password,
      email_confirm: true,
    });
    const data = (await res.json()) as { id?: string; msg?: string; message?: string; error_description?: string };
    if (!res.ok || !data.id) {
      return json({ error: data.msg ?? data.message ?? data.error_description ?? `Create failed (${res.status})` }, 400);
    }
    // Fill in the display name on the auto-created profile row.
    if (body.full_name?.trim()) {
      await fetch(`${base}/rest/v1/profiles?id=eq.${data.id}`, {
        method: "PATCH",
        headers: {
          apikey: key,
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
          prefer: "return=minimal",
        },
        body: JSON.stringify({ full_name: body.full_name.trim(), email: body.email.trim() }),
      });
    }
    return json({ ok: true, user_id: data.id });
  }

  if (body.action === "reset") {
    if (!body.user_id || !body.password || body.password.length < 6) {
      return json({ error: "user_id and a password of at least 6 characters are required" }, 400);
    }
    if (body.user_id === caller.id) {
      // Admins can still reset their own password; allowed intentionally.
    }
    const res = await admin(`users/${body.user_id}`, "PUT", { password: body.password });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { msg?: string; message?: string };
      return json({ error: data.msg ?? data.message ?? `Reset failed (${res.status})` }, 400);
    }
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
};
