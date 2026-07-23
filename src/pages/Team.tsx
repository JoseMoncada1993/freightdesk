// Team (admin only): create user accounts, reset passwords, assign roles, and
// grant per-user module access (write or view-only) beyond the role defaults.
// User creation / password resets run through the /api/admin-users Pages
// Function, which holds the Supabase service-role key server-side.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import Modal, { Field, ModalActions, inputCls, ErrorText } from "@/components/ui/Modal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import {
  ASSIGNABLE_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, MODULE_LABELS, ALL_MODULES, canWrite,
} from "@/lib/permissions";
import type { Role, WriteModule } from "@/lib/permissions";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ModuleAccess = Database["public"]["Tables"]["user_module_access"]["Row"];

const ROLE_STYLES: Record<string, string> = {
  admin: "bg-indigo-100 text-indigo-700",
  dispatcher: "bg-blue-100 text-blue-700",
  warehouse: "bg-emerald-100 text-emerald-700",
  viewer: "bg-slate-200 text-slate-600",
  accounting: "bg-amber-100 text-amber-700",
};

async function adminApi(body: Record<string, string>) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch("/api/admin-users", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !out.ok) throw new Error(out.error ?? `Request failed (${res.status})`);
  return out;
}

// ---- Create a user ---------------------------------------------------------
function AddUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const create = useMutation({
    mutationFn: () => adminApi({ action: "create", email, password, full_name: fullName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      onClose();
    },
  });
  const canSave = email.trim() !== "" && password.length >= 6 && !create.isPending;
  return (
    <Modal
      title="Add user"
      onClose={onClose}
      footer={<ModalActions onCancel={onClose} onSubmit={() => create.mutate()} submitLabel="Create user" pending={create.isPending} disabled={!canSave} />}
    >
      <Field label="Email *">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Full name">
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Temporary password * (share it with the user)">
        <input value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} placeholder="At least 6 characters" className={inputCls} />
      </Field>
      <p className="text-xs text-slate-400">
        The account is created ready to sign in (no email confirmation needed). New users start as read-only
        Viewers — set their role or module access below after creating.
      </p>
      <ErrorText error={create.error} />
    </Modal>
  );
}

// ---- Reset a password ------------------------------------------------------
function ResetPasswordModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const reset = useMutation({
    mutationFn: () => adminApi({ action: "reset", user_id: profile.id, password }),
    onSuccess: onClose,
  });
  return (
    <Modal
      title={`Reset password — ${profile.email ?? profile.id}`}
      onClose={onClose}
      footer={<ModalActions onCancel={onClose} onSubmit={() => reset.mutate()} submitLabel="Set password" pending={reset.isPending} disabled={password.length < 6 || reset.isPending} />}
    >
      <Field label="New password * (share it with the user)">
        <input value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} placeholder="At least 6 characters" className={inputCls} />
      </Field>
      <ErrorText error={reset.error} />
    </Modal>
  );
}

// ---- Per-user module access -------------------------------------------------
function ModuleAccessModal({
  profile, grants, onClose,
}: {
  profile: Profile;
  grants: ModuleAccess[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [levels, setLevels] = useState<Record<string, string>>(() =>
    Object.fromEntries(grants.map((g) => [g.module, g.level])),
  );
  const save = useMutation({
    mutationFn: async () => {
      const { error: delError } = await supabase
        .from("user_module_access")
        .delete()
        .eq("user_id", profile.id);
      if (delError) throw delError;
      const rows = Object.entries(levels)
        .filter(([, lvl]) => lvl === "write" || lvl === "view" || lvl === "hidden")
        .map(([module, level]) => ({ user_id: profile.id, module, level }));
      if (rows.length > 0) {
        const { error } = await supabase.from("user_module_access").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["module_access"] });
      onClose();
    },
  });

  const role = (profile.role as Role) ?? "viewer";

  return (
    <Modal
      title={`Module access — ${profile.full_name ?? profile.email ?? profile.id}`}
      onClose={onClose}
      wide
      footer={<ModalActions onCancel={onClose} onSubmit={() => save.mutate()} submitLabel="Save access" pending={save.isPending} />}
    >
      <p className="text-xs text-slate-400">
        The <b>{ROLE_LABELS[role] ?? role}</b> role already grants the access marked &quot;from role&quot;.
        Per-module override: <b>Write</b> allows add/edit (enforced by the database), <b>View only</b> marks it
        read-only, and <b>Hidden</b> removes the module from this user&apos;s sidebar and blocks its page.
        Changes apply the next time they load the app.
      </p>
      <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Module</th>
              <th className="px-3 py-2 font-medium">From role</th>
              <th className="px-3 py-2 font-medium">Extra grant</th>
            </tr>
          </thead>
          <tbody>
            {ALL_MODULES.map((m) => {
              const roleHasWrite = canWrite(role, m);
              return (
                <tr key={m} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-700">{MODULE_LABELS[m]}</td>
                  <td className="px-3 py-2 text-xs">
                    {roleHasWrite
                      ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">write</span>
                      : <span className="text-slate-400">view</span>}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={levels[m] ?? ""}
                      onChange={(e) => setLevels((prev) => ({ ...prev, [m]: e.target.value }))}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                    >
                      <option value="">— {roleHasWrite ? "role default (write)" : "role default"} —</option>
                      {!roleHasWrite && <option value="view">View only</option>}
                      {!roleHasWrite && <option value="write">Write</option>}
                      <option value="hidden">Hidden</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ErrorText error={save.error} />
    </Modal>
  );
}

// ---- Page -------------------------------------------------------------------
export default function Team() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [resetting, setResetting] = useState<Profile | null>(null);
  const [accessFor, setAccessFor] = useState<Profile | null>(null);

  const profilesQ = useQuery({
    queryKey: ["profiles"],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase.from("profiles").select("*").order("email");
      if (error) throw error;
      return data ?? [];
    },
  });

  const accessQ = useQuery({
    queryKey: ["module_access"],
    queryFn: async (): Promise<ModuleAccess[]> => {
      const { data, error } = await supabase.from("user_module_access").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: Role }) => {
      const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }),
    onError: (e: unknown) =>
      alert("Could not update role. " + (e instanceof Error ? e.message : "")),
  });

  const profiles = profilesQ.data ?? [];
  const grantsByUser = new Map<string, ModuleAccess[]>();
  for (const g of accessQ.data ?? []) {
    const list = grantsByUser.get(g.user_id) ?? [];
    list.push(g);
    grantsByUser.set(g.user_id, list);
  }
  const myId = session?.user.id;

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Create accounts, reset passwords, assign roles, and grant extra module access"
        action={
          <button onClick={() => setShowAdd(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + Add user
          </button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ASSIGNABLE_ROLES.map((r) => (
          <div key={r} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_STYLES[r]}`}>
              {ROLE_LABELS[r]}
            </span>
            <p className="mt-2 text-xs text-slate-500">{ROLE_DESCRIPTIONS[r]}</p>
          </div>
        ))}
      </div>

      {profilesQ.isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">Loading…</div>
      ) : profilesQ.error ? (
        <div className="bg-white rounded-xl border border-red-200 p-6 text-sm text-red-600">
          {profilesQ.error instanceof Error ? profilesQ.error.message : "Failed to load team"}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Extra module access</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const isSelf = p.id === myId;
                const grants = grantsByUser.get(p.id) ?? [];
                return (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      {p.email ?? "—"}
                      {isSelf && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                    </td>
                    <td className="px-4 py-3">{p.full_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {isSelf ? (
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_STYLES[p.role] ?? ROLE_STYLES.viewer}`}>
                          {ROLE_LABELS[p.role as Role] ?? p.role}
                        </span>
                      ) : (
                        <select
                          value={p.role}
                          disabled={setRole.isPending}
                          onChange={(e) => setRole.mutate({ id: p.id, role: e.target.value as Role })}
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {grants.length === 0 ? (
                        <span className="text-xs text-slate-400">role defaults</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {grants.map((g) => (
                            <span key={g.module}
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                g.level === "write"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : g.level === "hidden"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-slate-200 text-slate-600"
                              }`}>
                              {MODULE_LABELS[g.module as WriteModule] ?? g.module}
                              {g.level === "view" ? " (view)" : g.level === "hidden" ? " (hidden)" : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-3 whitespace-nowrap">
                        <button onClick={() => setAccessFor(p)} className="text-blue-600 hover:underline text-xs font-medium">
                          Modules
                        </button>
                        <button onClick={() => setResetting(p)} className="text-slate-500 hover:underline text-xs font-medium">
                          Reset password
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} />}
      {resetting && <ResetPasswordModal profile={resetting} onClose={() => setResetting(null)} />}
      {accessFor && (
        <ModuleAccessModal
          profile={accessFor}
          grants={grantsByUser.get(accessFor.id) ?? []}
          onClose={() => setAccessFor(null)}
        />
      )}
    </div>
  );
}
