import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import { useAuth } from "./context/AuthContext";

import SiteLayout from "./layouts/SiteLayout";
import OwnerLayout from "./layouts/OwnerLayout";
import PlatformLayout from "./layouts/PlatformLayout";

import Home from "./pages/Home";
import ComplexList from "./pages/ComplexList";
import ComplexDetails from "./pages/ComplexDetails";
import Reservation from "./pages/Reservation";
import MyReservations from "./pages/MyReservations";
import Login from "./pages/Login";

import OwnerLogin from "./pages/owner/OwnerLogin";
import OwnerDashboard from "./pages/owner/OwnerDashboard";
import OwnerComplexes from "./pages/owner/OwnerComplexes";
import OwnerHalls from "./pages/owner/OwnerHalls";
import OwnerSlots from "./pages/owner/OwnerSlots";
import OwnerReservations from "./pages/owner/OwnerReservations";

import PlatformLogin from "./pages/platform/PlatformLogin";
import PlatformDashboard from "./pages/platform/PlatformDashboard";
import PlatformApprovals from "./pages/platform/PlatformApprovals";
import PlatformComplexes from "./pages/platform/PlatformComplexes";
import PlatformHalls from "./pages/platform/PlatformHalls";
import PlatformOwners from "./pages/platform/PlatformOwners";
import PlatformCustomers from "./pages/platform/PlatformCustomers";
import PlatformBookings from "./pages/platform/PlatformBookings";
import PlatformFinance from "./pages/platform/PlatformFinance";

function RequireVenueOwner({ children }) {
  const { isVenueOwner } = useAuth();
  if (!isVenueOwner) return <Navigate to="/owner/login" replace />;
  return children;
}

function RequireSuperAdmin({ children }) {
  const { isSuperAdmin } = useAuth();
  if (!isSuperAdmin) return <Navigate to="/platform/login" replace />;
  return children;
}

function LegacyAdminRedirect() {
  const { isSuperAdmin, isVenueOwner } = useAuth();
  if (isSuperAdmin) return <Navigate to="/platform/dashboard" replace />;
  if (isVenueOwner) return <Navigate to="/owner/dashboard" replace />;
  return <Navigate to="/owner/login" replace />;
}

export default function App() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/complexes" element={<ComplexList />} />
          <Route path="/complexes/:id" element={<ComplexDetails />} />
          <Route path="/reservation" element={<Reservation />} />
          <Route path="/my-reservations" element={<MyReservations />} />
        </Route>

        <Route path="/login" element={<Login />} />

        {/* Venue Owner Dashboard */}
        <Route path="/owner/login" element={<OwnerLogin />} />
        <Route
          path="/owner"
          element={
            <RequireVenueOwner>
              <OwnerLayout />
            </RequireVenueOwner>
          }
        >
          <Route index element={<Navigate to="/owner/dashboard" replace />} />
          <Route path="dashboard" element={<OwnerDashboard />} />
          <Route path="complexes" element={<OwnerComplexes />} />
          <Route path="halls" element={<OwnerHalls />} />
          <Route path="slots" element={<OwnerSlots />} />
          <Route path="reservations" element={<OwnerReservations />} />
        </Route>

        {/* Super Admin Platform */}
        <Route path="/platform/login" element={<PlatformLogin />} />
        <Route
          path="/platform"
          element={
            <RequireSuperAdmin>
              <PlatformLayout />
            </RequireSuperAdmin>
          }
        >
          <Route index element={<Navigate to="/platform/dashboard" replace />} />
          <Route path="dashboard" element={<PlatformDashboard />} />
          <Route path="approvals" element={<PlatformApprovals />} />
          <Route path="complexes" element={<PlatformComplexes />} />
          <Route path="halls" element={<PlatformHalls />} />
          <Route path="owners" element={<PlatformOwners />} />
          <Route path="customers" element={<PlatformCustomers />} />
          <Route path="bookings" element={<PlatformBookings />} />
          <Route path="finance" element={<PlatformFinance />} />
        </Route>

        {/* Legacy /admin paths */}
        <Route path="/admin/login" element={<Navigate to="/owner/login" replace />} />
        <Route path="/admin/*" element={<LegacyAdminRedirect />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}
