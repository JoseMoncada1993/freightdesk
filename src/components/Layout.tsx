import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "@/lib/AuthContext";

export default function Layout() {
  const { session, signOut } = useAuth();

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-6 py-3">
          {session?.user?.email && (
            <span className="text-sm text-slate-500">{session.user.email}</span>
          )}
          <button
            onClick={signOut}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-md px-3 py-1.5"
          >
            Sign out
          </button>
        </header>
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
