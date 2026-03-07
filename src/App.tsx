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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const isPreview = isPreviewEnvironment();

  if (loading) return <LoadingScreen />;
  if (!user && !isPreview) return <Navigate to="/" replace />;

  return <AppLayout>{children}</AppLayout>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const isPreview = isPreviewEnvironment();
  const [roleLoading, setRoleLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAdminRole = async () => {
      if (loading) return;

      if (isPreview) {
        if (isMounted) {
          setIsAdmin(true);
          setRoleLoading(false);
        }
        return;
      }

      if (!user) {
        if (isMounted) {
          setIsAdmin(false);
          setRoleLoading(false);
        }
        return;
      }

      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      if (isMounted) {
        setIsAdmin(Boolean(data));
        setRoleLoading(false);
      }
    };

    setRoleLoading(true);
    checkAdminRole();

    return () => {
      isMounted = false;
    };
  }, [isPreview, loading, user]);

  if (loading || roleLoading) return <LoadingScreen />;
  if (!user && !isPreview) return <Navigate to="/" replace />;
  if (!isAdmin && !isPreview) return <Navigate to="/dashboard" replace />;

  return <AppLayout>{children}</AppLayout>;
}

function PublicOrProtectedRoute({
  children,
  publicFallback,
}: {
  children: React.ReactNode;
  publicFallback: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const isPreview = isPreviewEnvironment();

  if (loading) return <LoadingScreen />;
  if (user || isPreview) return <AppLayout>{children}</AppLayout>;

  return <>{publicFallback}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const isPreview = isPreviewEnvironment();

  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/admin/*" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
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
        element={user || isPreview ? <Navigate to="/dashboard" replace /> : <Navigate to="/" replace />}
      />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
