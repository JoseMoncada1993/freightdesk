import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { ASSIGNABLE_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const ROLE_STYLES: Record<string, string> = {
  admin: "bg-indigo-100 text-indigo-700",
  dispatcher: "bg-blue-100 text-blue-700",
  warehouse: "bg-emerald-100 text-emerald-700",
  viewer: "bg-slate-200 text-slate-600",
  accounting: "bg-amber-100 text-amber-700",
};

export default function Team() {
  const { session } = useAuth();
  const qc = useQueryClient();

  const profilesQ = useQuery({
    queryKey: ["profiles"],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase.from("profiles").select("*").order("email");
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
  const myId = session?.user.id;

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Assign roles to control what each teammate can do"
      />

      <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <p className="font-medium mb-1">How to add a teammate</p>
        <p>
          Invite them from the Supabase dashboard: <span className="font-medium">Authentication → Users → Invite user</span> (enter their email).
          Once they sign in, they appear here as a read-only <span className="font-medium">Viewer</span> — then pick their role below.
          Role changes take effect the next time they load the app.
        </p>
      </div>

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
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const isSelf = p.id === myId;
                return (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      {p.email ?? "—"}
                      {isSelf && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                    </td>
                    <td className="px-4 py-3">{p.full_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_STYLES[p.role] ?? ROLE_STYLES.viewer}`}>
                        {ROLE_LABELS[p.role as Role] ?? p.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isSelf ? (
                        <span className="text-xs text-slate-400" title="You can't change your own role — this prevents locking yourself out.">
                          locked
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
