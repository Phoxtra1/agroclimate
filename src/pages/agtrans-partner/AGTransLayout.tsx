import { Outlet, Link, useLocation } from "react-router-dom";
import { User, Activity, FileText, ClipboardList, Map, History, Truck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import agyenkwaIcon from "@/assets/agyenkwa-icon.png";
import { APP_NAME, APP_VERSION_LABEL } from "@/config/version";
import AppFooter from "@/components/AppFooter";
import { useDriverStatus } from "@/hooks/useDriverStatus";

export default function AGTransLayout() {
  const { signOut, user } = useAuth();
  const { approvalStatus, loading } = useDriverStatus();
  const location = useLocation();

  const isApproved = approvalStatus === "approved";

  const approvedNav = [
    { name: "Dashboard", path: "/agtrans-partner/dashboard", icon: Activity },
    { name: "Active Delivery", path: "/agtrans-partner/trip/active", icon: Map },
    { name: "Trip History", path: "/agtrans-partner/dashboard?tab=history", icon: History },
    { name: "Requests", path: "/agtrans-partner/dashboard?tab=requests", icon: ClipboardList },
    { name: "My Offer", path: "/agtrans-partner/dashboard?tab=offer", icon: Truck },
  ];

  const pendingNav = [
    { name: "Approval Status", path: "/agtrans-partner/pending-approval", icon: FileText },
    { name: "Edit Onboarding", path: "/agtrans-partner/onboarding", icon: Activity },
  ];

  const navItems = isApproved ? approvedNav : pendingNav;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 bg-card border-r flex flex-col fixed h-full z-30">
        <div className="h-16 flex items-center gap-2 px-6 border-b">
          <img src={agyenkwaIcon} alt={APP_NAME} className="h-9 w-9" />
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-base">AGTrans Partner</span>
            <span className="text-[9px] text-primary font-semibold">{APP_NAME} · {APP_VERSION_LABEL}</span>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-muted-foreground px-2">Loading driver status…</p>
          ) : (
            navItems.map((item) => {
              const isActive = location.pathname + location.search === item.path || location.pathname === item.path;
              return (
                <Link key={item.name} to={item.path}>
                  <Button variant={isActive ? "secondary" : "ghost"} className="w-full justify-start gap-3">
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{item.name}</span>
                    {!isApproved && item.name === "Approval Status" && (
                      <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                    )}
                  </Button>
                </Link>
              );
            })
          )}
        </nav>
        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="text-sm overflow-hidden">
              <p className="font-medium truncate">{user?.user_metadata?.display_name || "Driver"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={() => signOut()}>Sign Out</Button>
        </div>
      </aside>

      <main className="flex-1 ml-64 flex flex-col">
        <div className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </div>
        <AppFooter />
      </main>
    </div>
  );
}
