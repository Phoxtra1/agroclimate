/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { supabase } from "@/integrations/supabase/client";
const Landing = lazy(() => import("./pages/Landing"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Satellite = lazy(() => import("./pages/Satellite"));
const Livestock = lazy(() => import("./pages/Livestock"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Profile = lazy(() => import("./pages/Profile"));
const DroneAdvisory = lazy(() => import("./pages/DroneAdvisory"));
const AgroInventory = lazy(() => import("./pages/AgroInventory"));
const EnvironmentalMonitor = lazy(() => import("./pages/EnvironmentalMonitor"));
const AgroLearning = lazy(() => import("./pages/AgroLearning"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ProduceSafetyPage = lazy(() => import("./pages/ProduceSafety"));
const HandlerManagement = lazy(() => import("./pages/HandlerManagement"));
const HandlerWorkspace = lazy(() => import("./pages/HandlerWorkspace"));
const PostHarvestTracker = lazy(() => import("./pages/PostHarvestTracker"));
const MarketLink = lazy(() => import("./pages/MarketLink"));

const MarketplaceHome = lazy(() => import("./pages/marketplace/MarketplaceHome"));
const MarketplaceSupplyPage = lazy(() => import("./pages/marketplace/MarketplaceSupplyPage"));
const MarketplaceOrderForm = lazy(() => import("./pages/marketplace/MarketplaceOrderForm"));
const MarketplaceOrderListing = lazy(() => import("./pages/marketplace/MarketplaceOrderListing"));
const MarketplaceAuth = lazy(() => import("./pages/marketplace/MarketplaceAuth"));
const MarketplaceInbox = lazy(() => import("./pages/marketplace/MarketplaceInbox"));
const AGTransLayout = lazy(() => import("./pages/agtrans-partner/AGTransLayout"));
const DriverOnboarding = lazy(() => import("./pages/agtrans-partner/Onboarding"));
const DriverDashboard = lazy(() => import("./pages/agtrans-partner/DriverDashboard"));
const TripPage = lazy(() => import("./pages/agtrans-partner/TripPage"));
const PendingApproval = lazy(() => import("./pages/agtrans-partner/PendingApproval"));
const LiveTracking = lazy(() => import("./pages/LiveTracking"));
const Subscription = lazy(() => import("./pages/Subscription"));
const SubscriptionVerify = lazy(() => import("./pages/SubscriptionVerify"));
const Sikasem = lazy(() => import("./pages/Sikasem"));
import { useDriverStatus } from "@/hooks/useDriverStatus";
import { PremiumGate } from "@/components/subscription/PremiumGate";
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

import { LoadingScreen } from "@/components/LoadingScreen";

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
    let active = true;
    let timedOut = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    if (authLoading) return;
    if (!user) {
      setRole(null);
      setRoleLoading(false);
      return;
    }
    if (role) {
      setRoleLoading(false);
      return;
    }

    setRoleLoading(true);
    timeout = setTimeout(() => {
      timedOut = true;
      if (active) {
        console.warn("Role lookup timed out; continuing with the standard user role.");
        setRole("user");
        setRoleLoading(false);
      }
    }, 8000);

    const resolveRole = async () => {
      try {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        const roles = (data || []).map((r: { role: string }) => r.role);
        const metaRole = user.user_metadata?.role || user.user_metadata?.account_type;

        const { data: driverData } = await supabase
          .from("agtrans_drivers")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        const resolvedRole = roles.includes("admin") ? "admin"
          : roles.includes("handler") ? "handler"
          : roles.includes("buyer") || metaRole === "buyer" ? "buyer"
          : roles.includes("driver") || metaRole === "driver" || driverData ? "driver"
          : "user";

        if (active && !timedOut) setRole(resolvedRole);
      } catch (error) {
        console.error("Error fetching user role:", error);
        if (active && !timedOut) setRole("user");
      } finally {
        if (active) {
          if (timeout) clearTimeout(timeout);
          setRoleLoading(false);
        }
      }
    };

    void resolveRole();
    return () => {
      active = false;
      if (timeout) clearTimeout(timeout);
    };
  }, [user, authLoading, location.pathname, role]);

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

function SharedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const isPreview = isPreviewEnvironment();

  if (loading) return <LoadingScreen />;
  if (!user && !isPreview) return <Navigate to="/" replace />;

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
  const { exists, approvalStatus, loading: driverStatusLoading } = useDriverStatus();
  const isPreview = isPreviewEnvironment();
  const location = useLocation();

  if (loading || roleLoading || driverStatusLoading) return <LoadingScreen />;
  if (!user && !isPreview) return <Navigate to="/" replace />;
  
  // If driver profile exists, we treat them as a driver, regardless of potential role loading/cache delays
  const isDriverOrPending = role === "driver" || exists;

  if (!isDriverOrPending && !isPreview && !location.pathname.includes("onboarding")) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isDriverOrPending && !isPreview && approvalStatus !== "approved") {
    if (!location.pathname.includes("pending-approval") && !location.pathname.includes("onboarding")) {
      return <Navigate to="/agtrans-partner/pending-approval" replace />;
    }
  }

  if (location.pathname.includes("onboarding") && exists && approvalStatus === "approved" && !isPreview) {
    return <Navigate to="/agtrans-partner/dashboard" replace />;
  }

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
  // Admin workspace is reached via the central Admin Console.
  // No local auth gate is applied — the identity layer upstream controls access.
  return <AppLayout hideSidebar>{children}</AppLayout>;
}


function PublicOrProtectedRoute({ children, publicFallback }: { children: React.ReactNode; publicFallback: React.ReactNode }) {
  const { user, loading } = useAuth();
  const isPreview = isPreviewEnvironment();
  if (loading) return <LoadingScreen />;
  if (user || isPreview) return <AppLayout>{children}</AppLayout>;
  return <>{publicFallback}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const { role, roleLoading } = useUserRole();
  const isPreview = isPreviewEnvironment();

  // Wait for BOTH the session storage restore AND the auth provider
  if (loading || (user && roleLoading)) return <LoadingScreen />;

  // Determine post-login redirect
  const getHomeRoute = () => {
    if (role === "admin") return "/admin";
    if (role === "handler") return "/handlers";
    if (role === "buyer") return "/marketplace";
    if (role === "driver") return "/agtrans-partner/dashboard";
    return "/dashboard";
  };

  return (
    <Suspense fallback={<LoadingScreen />}>
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
        <Route path="pending-approval" element={<PendingApproval />} />
        <Route path="dashboard" element={<DriverDashboard />} />
        <Route path="trip/:id" element={<TripPage />} />
        <Route index element={<Navigate to="dashboard" replace />} />
      </Route>

      <Route path="/live-tracking/:id" element={<SharedRoute><LiveTracking /></SharedRoute>} />

      {/* Farmer/user routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/weather" element={<ProtectedRoute><Satellite /></ProtectedRoute>} />
      <Route path="/satellite" element={<ProtectedRoute><Satellite /></ProtectedRoute>} />
      <Route path="/calendar" element={<Navigate to="/dashboard" replace />} />
      <Route path="/crops" element={<Navigate to="/dashboard" replace />} />
      <Route path="/livestock" element={<ProtectedRoute><Livestock /></ProtectedRoute>} />
      <Route path="/aquaculture" element={<Navigate to="/dashboard" replace />} />
      <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/dipa" element={<Navigate to="/dashboard" replace />} />
      <Route path="/produce-safety" element={<ProtectedRoute><ProduceSafetyPage /></ProtectedRoute>} />
      <Route path="/flight-advisory" element={<ProtectedRoute><PremiumGate component="flight_advisory"><DroneAdvisory /></PremiumGate></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><PremiumGate component="agro_inventory"><AgroInventory /></PremiumGate></ProtectedRoute>} />
      <Route path="/drone" element={<Navigate to="/flight-advisory" replace />} />
      <Route path="/environment" element={<ProtectedRoute><EnvironmentalMonitor /></ProtectedRoute>} />
      <Route path="/farm-business" element={<Navigate to="/dashboard" replace />} />
      <Route path="/handler-management" element={<ProtectedRoute><PremiumGate component="handler"><HandlerManagement /></PremiumGate></ProtectedRoute>} />
      <Route path="/post-harvest" element={<ProtectedRoute><PremiumGate component="post_harvest"><PostHarvestTracker /></PremiumGate></ProtectedRoute>} />
      <Route path="/market-link" element={<ProtectedRoute><PremiumGate component="market_link"><MarketLink /></PremiumGate></ProtectedRoute>} />
      <Route path="/agnav" element={<Navigate to="/satellite" replace />} />
      <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
      <Route path="/subscription/pay" element={<ProtectedRoute><Sikasem /></ProtectedRoute>} />
      <Route path="/subscription/verify" element={<SubscriptionVerify />} />
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
    </Suspense>
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
              <ErrorBoundary fallbackTitle="AgroClimate could not open this workspace">
                <AppRoutes />
              </ErrorBoundary>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
