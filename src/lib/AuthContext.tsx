import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { canWrite, canDelete, isAdmin } from "@/lib/permissions";
import type { Role, WriteModule } from "@/lib/permissions";

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  /** Current user's role (null until loaded). */
  role: Role | null;
  /** True while the role is being fetched — UI hides write actions until known. */
  roleLoading: boolean;
  /** Display name for the signed-in user (full name, else email). */
  profileName: string | null;
  /** Can the current user write (add/edit) in this module? Role OR admin-granted override. */
  can: (module: WriteModule) => boolean;
  /** Admin has hidden this module from the current user (nav-level). */
  isHidden: (module: WriteModule) => boolean;
  /** Hard deletes are admin-only. */
  canDelete: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [profileName, setProfileName] = useState<string | null>(null);
  // Admin-granted per-module overrides for this user (module -> 'write'|'view').
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setRole(null);
      setRoleLoading(false);
      setProfileName(null);
      setOverrides({});
      return;
    }
    setRoleLoading(true);
    supabase
      .from("profiles")
      .select("role, full_name, email")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setRole(((data?.role as Role) ?? "viewer") satisfies Role);
        setProfileName(data?.full_name ?? data?.email ?? null);
        setRoleLoading(false);
      });
    supabase
      .from("user_module_access")
      .select("module, level")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (cancelled) return;
        setOverrides(Object.fromEntries((data ?? []).map((r) => [r.module, r.level])));
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        role,
        roleLoading,
        profileName,
        // Admins always keep full visibility/access to every module.
        can: (module) =>
          overrides[module] !== "hidden" && (canWrite(role, module) || overrides[module] === "write"),
        isHidden: (module) => !isAdmin(role) && overrides[module] === "hidden",
        canDelete: canDelete(role),
        isAdmin: isAdmin(role),
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
