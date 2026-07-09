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
import Team from "./pages/Team";

export default function App() {
  const { session, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Loading...
      </div>
    );
  }

  if (!session) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="shipments" element={<Shipments />} />
        <Route path="billing" element={<Billing />} />
        <Route path="trailers" element={<Trailers />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="customers" element={<Customers />} />
        <Route path="carriers" element={<Carriers />} />
        <Route path="documents" element={<Documents />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="skus" element={<SkuGenerator />} />
        <Route path="sams" element={<SamsClub />} />
        <Route path="routes" element={<RouteOptimizer />} />
        {isAdmin && <Route path="team" element={<Team />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
