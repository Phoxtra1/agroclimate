import { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Home, Cloud, Bell, User, Menu, LogOut, Bug, Plane, Leaf, BookOpen, Package, Users, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNewTag } from "@/hooks/useNewTag";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import agyenkwaIcon from "@/assets/agyenkwa-icon.png";
import { APP_NAME, APP_VERSION_LABEL } from "@/config/version";
import AppFooter from "@/components/AppFooter";
import { NotificationsButton } from "./NotificationsButton";
import { usePresence } from "@/hooks/useMarketChat";
import { TestModeBanner } from "@/components/system/TestModeBanner";

const navItems = [
  { to: "/dashboard", icon: Home, label: "Overview", id: "overview" },
  { to: "/weather", icon: Cloud, label: "Agro Forecast", id: "weather" },
  { to: "/environment", icon: Leaf, label: "Agro & Climate Risk", id: "environment" },
  { to: "/produce-safety", icon: ShieldCheck, label: "Produce & Safety", id: "produce-safety", isNew: true },
  { to: "/livestock", icon: Bug, label: "Livestock", id: "livestock" },
  { to: "/inventory", icon: Package, label: "Agro Inventory", id: "inventory" },
  { to: "/flight-advisory", icon: Plane, label: "Flight Advisory", id: "flight-advisory" },
  { to: "/alerts", icon: Bell, label: "Alerts", id: "alerts" },
  { to: "/handler-management", icon: Users, label: "Handler", id: "handler-management" },
  { to: "/profile", icon: User, label: "Profile", id: "profile" },
];

const bottomNavItems = [
  { to: "/dashboard", icon: Home, label: "Home" },
  { to: "/weather", icon: Cloud, label: "Forecast" },
  { to: "/produce-safety", icon: ShieldCheck, label: "Safety" },
  { to: "/learning", icon: BookOpen, label: "Learn" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
];

function NavItems({ onClick }: { onClick?: () => void }) {
  const { isNew, markVisited } = useNewTag();
  return (
    <>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={() => {
            markVisited(`nav-${item.id}`);
            onClick?.();
          }}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
              isActive
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            }`
          }
        >
          <item.icon className="h-5 w-5" />
          <span className="flex-1">{item.label}</span>
          {item.isNew && isNew(`nav-${item.id}`) && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0">New</Badge>
          )}
        </NavLink>
      ))}
    </>
  );
}

export function AppLayout({ children, hideSidebar }: { children: ReactNode; hideSidebar?: boolean }) {
  const { signOut, user } = useAuth();
  usePresence();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-card border-b border-border px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={agyenkwaIcon} alt={APP_NAME} className="h-8 w-8" />
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-sm">{APP_NAME}</span>
              <span className="text-[9px] font-semibold text-primary">{APP_VERSION_LABEL}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationsButton />
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-sidebar w-64 p-4">
              <div className="flex items-center gap-2 mb-6">
                <img src={agyenkwaIcon} alt={APP_NAME} className="h-8 w-8" />
                <div className="flex flex-col">
                  <span className="font-bold text-sidebar-foreground">{APP_NAME}</span>
                  <span className="text-[9px] text-sidebar-foreground/60">Intelligence Platform</span>
                </div>
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
          </div>
        </header>

        <main className="pb-20">
          <TestModeBanner />
          {children}
          <AppFooter compact />
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
          <div className="flex items-center justify-around h-16">
            {bottomNavItems.map((item) => (
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

  return (
    <div className="flex min-h-screen bg-background">
      {!hideSidebar && (
        <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col fixed h-full z-30">
          <div className="flex items-center justify-between px-5 h-16 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <img src={agyenkwaIcon} alt={APP_NAME} className="h-9 w-9" />
              <div className="flex flex-col leading-tight">
                <span className="font-bold text-lg text-sidebar-foreground">{APP_NAME}</span>
                <span className="text-[10px] font-semibold text-primary">{APP_VERSION_LABEL}</span>
              </div>
            </div>
            <NotificationsButton />
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            <NavItems />
          </nav>
          <div className="px-3 py-4 border-t border-sidebar-border">
            <p className="text-xs text-sidebar-foreground/50 mb-2 px-3 truncate">{user?.email}</p>
            <Button variant="ghost" onClick={signOut} className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground">
              <LogOut className="h-4 w-4 mr-2" /> Sign Out
            </Button>
          </div>
        </aside>
      )}
      <main className={`flex-1 flex flex-col ${!hideSidebar ? "ml-64" : ""}`}>
        <TestModeBanner />
        <div className="flex-1">{children}</div>

        <AppFooter />
      </main>
    </div>
  );
}
