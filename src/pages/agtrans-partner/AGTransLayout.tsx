import { Outlet, Link, useLocation } from "react-router-dom";
import { Truck, User, MapPin, Activity } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import aminevaLogo from "@/assets/amineva-logo.png";

export default function AGTransLayout() {
  const { signOut, user } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: "Dashboard", path: "/agtrans-partner/dashboard", icon: Activity },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r flex flex-col fixed h-full z-30">
        <div className="h-16 flex items-center gap-2 px-6 border-b">
          <img src={aminevaLogo} alt="Logo" className="h-8 w-8 rounded-full" />
          <span className="font-bold text-lg">AGTrans Partner</span>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.name} to={item.path}>
                <Button variant={isActive ? "secondary" : "ghost"} className="w-full justify-start gap-3">
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            );
          })}
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

      {/* Main Content */}
      <main className="flex-1 ml-64 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
