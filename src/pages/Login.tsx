// Sign-in only: self-service sign-up is disabled. Accounts are created by an
// admin from the Team module, which also resets passwords.
import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-sm p-8">
        <div className="text-2xl font-bold text-brand mb-1">FreightDesk</div>
        <p className="text-slate-500 text-sm mb-6">Sign in to your desk</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password" required minLength={6} value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            type="submit" disabled={busy}
            className="w-full bg-brand hover:bg-brand-dark disabled:opacity-60 text-white font-medium py-2 rounded-md text-sm"
          >
            {busy ? "Please wait..." : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-xs text-slate-400 text-center">
          Need an account or forgot your password? Ask your admin — accounts are managed in the Team module.
        </p>
      </div>
    </div>
  );
}
