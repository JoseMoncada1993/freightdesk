import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Shipments from "./pages/Shipments";
import Billing from "./pages/Billing";
import Trailers from "./pages/Trailers";
import Inventory from "./pages/Inventory";
import Customers from "./pages/Customers";
import Carriers from "./pages/Carriers";
import Documents from "./pages/Documents";
import Tasks from "./pages/Tasks";
import SkuGenerator from "./pages/SkuGenerator";
import SamsClub from "./pages/SamsClub";
import RouteOptimizer from "./pages/RouteOptimizer";
import ManifestImport from "./pages/ManifestImport";
import Forms from "./pages/Forms";
import PublicForm from "./pages/PublicForm";
import EmailLog from "./pages/EmailLog";
import Team from "./pages/Team";
import Activity from "./pages/Activity";
import type { ReactElement } from "react";
import type { WriteModule } from "@/lib/permissions";

export default function App() {
  const { session, loading, isAdmin, isHidden } = useAuth();

  // Redirect a hidden module's route to the dashboard (direct-URL guard).
  const guard = (mod: WriteModule, el: ReactElement) =>
    isHidden(mod) ? <Navigate to="/" replace /> : el;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Loading...
      </div>
    );
  }

  // /f/:slug is the public form fill page — reachable without signing in.
  if (!session) {
    return (
      <Routes>
        <Route path="f/:slug" element={<PublicForm />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="f/:slug" element={<PublicForm />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="shipments" element={guard("shipments", <Shipments />)} />
        <Route path="billing" element={guard("billing", <Billing />)} />
        <Route path="trailers" element={guard("trailers", <Trailers />)} />
        <Route path="inventory" element={guard("inventory", <Inventory />)} />
        <Route path="customers" element={guard("customers", <Customers />)} />
        <Route path="carriers" element={guard("carriers", <Carriers />)} />
        <Route path="documents" element={guard("documents", <Documents />)} />
        <Route path="tasks" element={guard("tasks", <Tasks />)} />
        <Route path="skus" element={guard("skus", <SkuGenerator />)} />
        <Route path="manifests" element={guard("manifests", <ManifestImport />)} />
        <Route path="sams" element={guard("sams", <SamsClub />)} />
        <Route path="routes" element={guard("routes", <RouteOptimizer />)} />
        <Route path="forms" element={guard("forms", <Forms />)} />
        <Route path="emails" element={guard("emails", <EmailLog />)} />
        {isAdmin && <Route path="team" element={<Team />} />}
        {isAdmin && <Route path="activity" element={<Activity />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
