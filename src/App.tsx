import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const isPreview = isPreviewEnvironment();

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        Loading...
      </div>
    );

  if (!user && !isPreview) return <Navigate to="/" replace />;

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

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        Loading...
      </div>
    );

  if (user || isPreview) return <AppLayout>{children}</AppLayout>;

  return <>{publicFallback}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const isPreview = isPreviewEnvironment();

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        Loading...
      </div>
    );

  return (
    <Routes>
      {/* Landing page */}
      <Route path="/" element={<Landing />} />

      {/* Email verification */}
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
      />
      <Route
        path="/admin"
        element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>}
      />
      <Route
        path="/weather"
        element={<ProtectedRoute><Weather /></ProtectedRoute>}
      />
      <Route
        path="/calendar"
        element={<ProtectedRoute><CropCalendar /></ProtectedRoute>}
      />
      <Route
        path="/crops"
        element={<ProtectedRoute><CropProduction /></ProtectedRoute>}
      />
      <Route
        path="/livestock"
        element={<ProtectedRoute><Livestock /></ProtectedRoute>}
      />
      <Route
        path="/aquaculture"
        element={<ProtectedRoute><Aquaculture /></ProtectedRoute>}
      />
      <Route
        path="/alerts"
        element={<ProtectedRoute><Alerts /></ProtectedRoute>}
      />
      <Route
        path="/profile"
        element={<ProtectedRoute><Profile /></ProtectedRoute>}
      />
      <Route
        path="/odeneho"
        element={<ProtectedRoute><OdenehoAI /></ProtectedRoute>}
      />
      <Route
        path="/flight-advisory"
        element={<ProtectedRoute><DroneAdvisory /></ProtectedRoute>}
      />
      <Route
        path="/inventory"
        element={<ProtectedRoute><AgroInventory /></ProtectedRoute>}
      />
      <Route
        path="/drone"
        element={<Navigate to="/flight-advisory" replace />}
      />
      <Route
        path="/environment"
        element={<ProtectedRoute><EnvironmentalMonitor /></ProtectedRoute>}
      />
      <Route
        path="/learning"
        element={
          <PublicOrProtectedRoute publicFallback={<AgroLearning />}>
            <AgroLearning />
          </PublicOrProtectedRoute>
        }
      />

      {/* Fallback: logged-in and preview users go to dashboard, otherwise landing */}
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
