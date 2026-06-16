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
import OwnerRegister from "./pages/owner/OwnerRegister";
import OwnerForgotPassword from "./pages/owner/OwnerForgotPassword";
import OwnerDashboard from "./pages/owner/OwnerDashboard";
import OwnerVenues from "./pages/owner/OwnerVenues";
import OwnerSessions from "./pages/owner/OwnerSessions";
import OwnerReservations from "./pages/owner/OwnerReservations";

import PlatformLogin from "./pages/platform/PlatformLogin";
import PlatformDashboard from "./pages/platform/PlatformDashboard";
import PlatformApprovals from "./pages/platform/PlatformApprovals";
import PlatformVenues from "./pages/platform/PlatformVenues";
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
        <Route path="/owner/register" element={<OwnerRegister />} />
        <Route path="/owner/forgot-password" element={<OwnerForgotPassword />} />
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
          <Route path="venues" element={<OwnerVenues />} />
          {/* Old fragmented pages, now one unified flow */}
          <Route path="complexes" element={<Navigate to="/owner/venues" replace />} />
          <Route path="halls" element={<Navigate to="/owner/venues" replace />} />
          <Route path="slots" element={<OwnerSessions />} />
          <Route path="sessions" element={<Navigate to="/owner/slots" replace />} />
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
          <Route path="venues" element={<PlatformVenues />} />
          <Route path="complexes" element={<Navigate to="/platform/venues" replace />} />
          <Route path="halls" element={<Navigate to="/platform/venues" replace />} />
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
