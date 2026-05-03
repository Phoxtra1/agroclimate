// @ts-nocheck
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import Landing from "./pages/Landing";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import Dashboard from "./pages/Dashboard";
import Weather from "./pages/Weather";
import CropCalendar from "./pages/CropCalendar";
import CropProduction from "./pages/CropProduction";
import Livestock from "./pages/Livestock";
import Alerts from "./pages/Alerts";
import Profile from "./pages/Profile";
import Aquaculture from "./pages/Aquaculture";
import OdenehoAI from "./pages/OdenehoAI";
import DroneAdvisory from "./pages/DroneAdvisory";
import AgroInventory from "./pages/AgroInventory";
import EnvironmentalMonitor from "./pages/EnvironmentalMonitor";
import AgroLearning from "./pages/AgroLearning";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";
import FarmBusinessHub from "./pages/FarmBusinessHub";
import HandlerManagement from "./pages/HandlerManagement";
import HandlerWorkspace from "./pages/HandlerWorkspace";
import PostHarvestTracker from "./pages/PostHarvestTracker";
import MarketLink from "./pages/MarketLink";
import { installOfflineSync } from "@/lib/offlineQueue";

const queryClient = new QueryClient();

const isPreviewEnvironment = () => {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  return (
    hostname.includes("preview--") ||
    hostname.endsWith(".lovableproject.com") ||
    window.location.search.includes("__lovable_token=")
  );
};

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen text-muted-foreground">
      Loading...
    </div>
  );
}

// Hook to check if user has handler role
function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<"user" | "handler" | "admin" | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setRole(null); setRoleLoading(false); return; }

    const checkRole = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const roles = (data || []).map((r: any) => r.role);
      if (roles.includes("admin")) setRole("admin");
      else if (roles.includes("handler")) setRole("handler");
      else setRole("user");
      setRoleLoading(false);
    };
    checkRole();
  }, [user, authLoading]);

  return { role, roleLoading };
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { role, roleLoading } = useUserRole();
  const isPreview = isPreviewEnvironment();

  if (loading || roleLoading) return <LoadingScreen />;
  if (!user && !isPreview) return <Navigate to="/" replace />;
  // Handlers cannot access farmer dashboard pages
  if (role === "handler" && !isPreview) return <Navigate to="/handlers" replace />;

  return <AppLayout>{children}</AppLayout>;
}

function HandlerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { role, roleLoading } = useUserRole();
  const isPreview = isPreviewEnvironment();

  if (loading || roleLoading) return <LoadingScreen />;
  if (!user && !isPreview) return <Navigate to="/" replace />;
  // Only handlers (or preview) can access handler workspace
  if (role !== "handler" && !isPreview) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { role, roleLoading } = useUserRole();
  const isPreview = isPreviewEnvironment();

  if (loading || roleLoading) return <LoadingScreen />;

  // Unauthenticated → landing page (NOT /admin → caused blank-page redirect loop)
  if (!user && !isPreview) {
    return <Navigate to="/" replace />;
  }

  // Authenticated non-admins → user dashboard
  if (role !== "admin" && !isPreview) {
    return <Navigate to={role === "handler" ? "/handlers" : "/dashboard"} replace />;
  }

  return <AppLayout hideSidebar>{children}</AppLayout>;
}

function PublicOrProtectedRoute({ children, publicFallback }: { children: React.ReactNode; publicFallback: React.ReactNode }) {
  const { user, loading } = useAuth();
  const isPreview = isPreviewEnvironment();
  if (loading) return <LoadingScreen />;
  if (user || isPreview) return <AppLayout>{children}</AppLayout>;
  return <>{publicFallback}</>;
}

// Extra guard: wait for Supabase to fully restore the session from storage
function useSessionReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // getSession() resolves only after the persisted session is restored
    supabase.auth.getSession().then(() => setReady(true));
  }, []);

  return ready;
}

function AppRoutes() {
  const sessionReady = useSessionReady();
  const { user, loading } = useAuth();
  const { role, roleLoading } = useUserRole();
  const isPreview = isPreviewEnvironment();

  // Wait for BOTH the session storage restore AND the auth provider
  if (!sessionReady || loading || (user && roleLoading)) return <LoadingScreen />;

  // Determine post-login redirect
  const getHomeRoute = () => {
    if (role === "admin") return "/admin";
    if (role === "handler") return "/handlers";
    return "/dashboard";
  };

  return (
    <Routes>
      <Route
        path="/"
        element={user || isPreview ? <Navigate to={getHomeRoute()} replace /> : <Landing />}
      />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Handler workspace */}
      <Route path="/handlers" element={<HandlerRoute><HandlerWorkspace /></HandlerRoute>} />

      {/* Farmer/user routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/weather" element={<ProtectedRoute><Weather /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><CropCalendar /></ProtectedRoute>} />
      <Route path="/crops" element={<ProtectedRoute><CropProduction /></ProtectedRoute>} />
      <Route path="/livestock" element={<ProtectedRoute><Livestock /></ProtectedRoute>} />
      <Route path="/aquaculture" element={<ProtectedRoute><Aquaculture /></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/odeneho" element={<ProtectedRoute><OdenehoAI /></ProtectedRoute>} />
      <Route path="/flight-advisory" element={<ProtectedRoute><DroneAdvisory /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><AgroInventory /></ProtectedRoute>} />
      <Route path="/drone" element={<Navigate to="/flight-advisory" replace />} />
      <Route path="/environment" element={<ProtectedRoute><EnvironmentalMonitor /></ProtectedRoute>} />
      <Route path="/farm-business" element={<ProtectedRoute><FarmBusinessHub /></ProtectedRoute>} />
      <Route path="/handler-management" element={<ProtectedRoute><HandlerManagement /></ProtectedRoute>} />
      <Route path="/post-harvest" element={<ProtectedRoute><PostHarvestTracker /></ProtectedRoute>} />
      <Route path="/market-link" element={<ProtectedRoute><MarketLink /></ProtectedRoute>} />
      <Route
        path="/learning"
        element={
          <PublicOrProtectedRoute publicFallback={<AgroLearning />}>
            <AgroLearning />
          </PublicOrProtectedRoute>
        }
      />

      <Route
        path="*"
        element={user || isPreview ? <Navigate to={getHomeRoute()} replace /> : <Navigate to="/" replace />}
      />
    </Routes>
  );
}

import { ThemeProvider } from "@/components/ThemeProvider";

const App = () => {
  useEffect(() => { installOfflineSync(); }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
