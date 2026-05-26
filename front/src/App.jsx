import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import { useAuth } from "./context/AuthContext";

import SiteLayout from "./layouts/SiteLayout";
import AdminLayout from "./layouts/AdminLayout";

import Home from "./pages/Home";
import ComplexList from "./pages/ComplexList";
import ComplexDetails from "./pages/ComplexDetails";
import Reservation from "./pages/Reservation";
import MyReservations from "./pages/MyReservations";
import Login from "./pages/Login";

import AdminLogin from "./pages/admin/AdminLogin";
import Dashboard from "./pages/admin/Dashboard";
import AdminComplexes from "./pages/admin/AdminComplexes";
import AdminHalls from "./pages/admin/AdminHalls";
import AdminSlots from "./pages/admin/AdminSlots";
import AdminReservations from "./pages/admin/AdminReservations";

function RequireAdmin({ children }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* User website */}
        <Route element={<SiteLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/complexes" element={<ComplexList />} />
          <Route path="/complexes/:id" element={<ComplexDetails />} />
          <Route path="/reservation" element={<Reservation />} />
          <Route path="/my-reservations" element={<MyReservations />} />
        </Route>

        <Route path="/login" element={<Login />} />

        {/* Admin panel */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="complexes" element={<AdminComplexes />} />
          <Route path="halls" element={<AdminHalls />} />
          <Route path="slots" element={<AdminSlots />} />
          <Route path="reservations" element={<AdminReservations />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}
