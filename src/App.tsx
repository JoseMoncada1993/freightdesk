import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Shipments from "./pages/Shipments";
import Customers from "./pages/Customers";
import Carriers from "./pages/Carriers";
import Documents from "./pages/Documents";
import Tasks from "./pages/Tasks";
import Yard from "./pages/Yard";

export default function App() {
  const { session, loading } = useAuth();

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
        <Route path="customers" element={<Customers />} />
        <Route path="carriers" element={<Carriers />} />
        <Route path="documents" element={<Documents />} />
        <Route path="tasks" element={<Tasks />} />
          <Route path="yard" element={<Yard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
