import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Cloud, CalendarDays, Bell, User, Fish, Menu, LogOut, Sprout } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const navItems = [
  { to: "/dashboard", icon: Home, label: "Dashboard" },
  { to: "/weather", icon: Cloud, label: "Weather" },
  { to: "/calendar", icon: CalendarDays, label: "Crops" },
  { to: "/aquaculture", icon: Fish, label: "Aquaculture" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
  { to: "/profile", icon: User, label: "Profile" },
];

function NavItems({ onClick }: { onClick?: () => void }) {
  return (
    <>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onClick}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
              isActive
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            }`
          }
        >
          <item.icon className="h-5 w-5" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 bg-card border-b border-border px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sprout className="h-5 w-5 text-primary" />
            <span className="font-bold text-sm">AgroClimate</span>
          </div>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-sidebar w-64 p-4">
              <div className="flex items-center gap-2 mb-6">
                <Sprout className="h-6 w-6 text-sidebar-primary" />
                <span className="font-bold text-sidebar-foreground">AgroClimate</span>
              </div>
              <nav className="space-y-1">
                <NavItems onClick={() => setSheetOpen(false)} />
              </nav>
              <div className="mt-auto pt-6">
                <Button variant="ghost" onClick={signOut} className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground">
                  <LogOut className="h-4 w-4 mr-2" /> Sign Out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className="pb-20">{children}</main>

        {/* Bottom nav for mobile */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
          <div className="flex items-center justify-around h-16">
            {navItems.slice(0, 5).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    );
  }

  // Desktop: sidebar layout
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col fixed h-full z-30">
        <div className="flex items-center gap-2 px-5 h-16 border-b border-sidebar-border">
          <Sprout className="h-6 w-6 text-sidebar-primary" />
          <span className="font-bold text-lg text-sidebar-foreground">AgroClimate</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavItems />
        </nav>
        <div className="px-3 py-4 border-t border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/50 mb-2 px-3 truncate">{user?.email}</p>
          <Button variant="ghost" onClick={signOut} className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground">
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        </div>
      </aside>
      <main className="flex-1 ml-64">{children}</main>
    </div>
  );
}
