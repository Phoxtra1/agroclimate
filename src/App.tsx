// @ts-nocheck
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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
import AGNav from "./pages/AGNav";
import MarketplaceHome from "./pages/marketplace/MarketplaceHome";
import MarketplaceSupplyPage from "./pages/marketplace/MarketplaceSupplyPage";
import MarketplaceOrderForm from "./pages/marketplace/MarketplaceOrderForm";
import MarketplaceOrderListing from "./pages/marketplace/MarketplaceOrderListing";
import MarketplaceAuth from "./pages/marketplace/MarketplaceAuth";
import MarketplaceInbox from "./pages/marketplace/MarketplaceInbox";
import AGTransLayout from "./pages/agtrans-partner/AGTransLayout";
import DriverOnboarding from "./pages/agtrans-partner/Onboarding";
import DriverDashboard from "./pages/agtrans-partner/DriverDashboard";
import TripPage from "./pages/agtrans-partner/TripPage";
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

function AdminAccessFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-lg border bg-card p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold mb-2">Admin Workspace</h1>
        <p className="text-sm text-muted-foreground mb-4">Sign in with an admin account to open this workspace.</p>
        <a href="/" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Go to sign in</a>
      </div>
    </div>
  );
}

// Hook to check if user has handler role
function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<"user" | "handler" | "admin" | "buyer" | "driver" | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setRole(null); setRoleLoading(false); return; }

    // Optimization: If role is already resolved to a specialized role, skip recheck on path change
    if (role && role !== "user") {
      setRoleLoading(false);
      return;
    }

    const checkRole = async () => {
      setRoleLoading(true);
      try {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        const roles = (data || []).map((r: any) => r.role);
        const metaRole = user.user_metadata?.role || user.user_metadata?.account_type;

        // Double check driver registration profile to instantly sync driver role
        const { data: driverData } = await supabase
          .from("agtrans_drivers")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (roles.includes("admin")) setRole("admin");
        else if (roles.includes("handler")) setRole("handler");
        else if (roles.includes("buyer") || metaRole === "buyer") setRole("buyer");
        else if (roles.includes("driver") || metaRole === "driver" || driverData) setRole("driver");
        else setRole("user");
      } catch (error) {
        console.error("Error fetching user role:", error);
      } finally {
        setRoleLoading(false);
      }
    };
    checkRole();
  }, [user, authLoading, location.pathname]);

  return { role, roleLoading };
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { role, roleLoading } = useUserRole();
  const isPreview = isPreviewEnvironment();

  if (loading || roleLoading) return <LoadingScreen />;
  if (!user && !isPreview) return <Navigate to="/" replace />;
  if (role === "handler" && !isPreview) return <Navigate to="/handlers" replace />;
  // Buyers must NOT enter the farmer dashboard
  if (role === "buyer" && !isPreview) return <Navigate to="/marketplace" replace />;
  if (role === "driver" && !isPreview) return <Navigate to="/agtrans-partner/dashboard" replace />;

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

function DriverRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { role, roleLoading } = useUserRole();
  const isPreview = isPreviewEnvironment();

  if (loading || roleLoading) return <LoadingScreen />;
  if (!user && !isPreview) return <Navigate to="/" replace />;
  
  const location = useLocation();
  if (role !== "driver" && !isPreview && !location.pathname.includes("onboarding")) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

function BuyerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { role, roleLoading } = useUserRole();
  const isPreview = isPreviewEnvironment();

  if (loading || roleLoading) return <LoadingScreen />;
  
  if (user && !isPreview) {
    if (role === "user") return <Navigate to="/dashboard" replace />;
    if (role === "driver") return <Navigate to="/agtrans-partner/dashboard" replace />;
    if (role === "handler") return <Navigate to="/handlers" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { role, roleLoading } = useUserRole();
  const isPreview = isPreviewEnvironment();

  if (loading || roleLoading) return <LoadingScreen />;

  // Unauthenticated → landing page (NOT /admin → caused blank-page redirect loop)
  if (!user && !isPreview) {
    return <AdminAccessFallback />;
  }

  // Authenticated non-admins → correct workspace instead of a blank guarded route
  if (role !== "admin" && !isPreview) {
    if (role === "handler") return <Navigate to="/handlers" replace />;
    if (role === "buyer") return <Navigate to="/marketplace" replace />;
    if (role === "driver") return <Navigate to="/agtrans-partner/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
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
    if (role === "buyer") return "/marketplace";
    if (role === "driver") return "/agtrans-partner/dashboard";
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

      {/* Public Marketplace (buyer-facing) — does NOT require auth to browse */}
      <Route path="/marketplace" element={<BuyerRoute><MarketplaceHome /></BuyerRoute>} />
      <Route path="/marketplace/supply" element={<BuyerRoute><MarketplaceSupplyPage /></BuyerRoute>} />
      <Route path="/marketplace/orders" element={<BuyerRoute><MarketplaceOrderForm /></BuyerRoute>} />
      <Route path="/marketplace/order-listing" element={<BuyerRoute><MarketplaceOrderListing /></BuyerRoute>} />
      <Route path="/marketplace/auth" element={<MarketplaceAuth />} />
      <Route path="/marketplace/inbox" element={<BuyerRoute><MarketplaceInbox /></BuyerRoute>} />

      {/* Handler workspace */}
      <Route path="/handlers" element={<HandlerRoute><HandlerWorkspace /></HandlerRoute>} />

      {/* Driver workspace (AGTrans Partner) */}
      <Route path="/agtrans-partner" element={<DriverRoute><AGTransLayout /></DriverRoute>}>
        <Route path="onboarding" element={<DriverOnboarding />} />
        <Route path="dashboard" element={<DriverDashboard />} />
        <Route path="trip/:id" element={<TripPage />} />
        <Route index element={<Navigate to="dashboard" replace />} />
      </Route>

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
      <Route path="/agnav" element={<ProtectedRoute><AGNav /></ProtectedRoute>} />
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
