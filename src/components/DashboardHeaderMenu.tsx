import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell, Sun, Moon, Settings, Lightbulb, BellRing, Check, Trash2, Store, Archive, Anchor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/ThemeProvider";
import type { EnrichedAlert } from "@/hooks/useUserAlerts";

interface DashboardHeaderMenuProps {
  unreadCount?: number;
  alerts?: EnrichedAlert[];
  onMarkRead?: (alertId: string) => void;
  onDelete?: (alertId: string) => void;
}

export function DashboardHeaderMenu({ unreadCount = 0, alerts = [], onMarkRead, onDelete }: DashboardHeaderMenuProps) {
  const { setTheme, resolved } = useTheme();
  const [notifEnabled, setNotifEnabled] = useState(false);

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotifEnabled(Notification.permission === "granted");
    }
  }, []);

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotifEnabled(perm === "granted");
  };

  const recentAlerts = [...alerts]
    .sort((a, b) => Number(a.isRead) - Number(b.isRead))
    .slice(0, 6);

  return (
    <div className="flex items-center gap-1">
      <Link to="/post-harvest">
        <Button variant="ghost" size="sm" className="h-9 gap-1.5 px-2" title="Post-Harvest">
          <Archive className="h-4 w-4" />
          <span className="hidden sm:inline text-xs font-medium">Post-Harvest</span>
        </Button>
      </Link>
      <Link to="/market-link">
        <Button variant="ghost" size="sm" className="h-9 gap-1.5 px-2" title="Market Link">
          <Store className="h-4 w-4" />
          <span className="hidden sm:inline text-xs font-medium">Market Link</span>
        </Button>
      </Link>
      <Link to="/agnav">
        <Button variant="ghost" size="sm" className="h-9 gap-1.5 px-2" title="AGNav — Water Transport Navigator">
          <Anchor className="h-4 w-4" />
          <span className="hidden sm:inline text-xs font-medium">AGNav</span>
        </Button>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-9 w-9" title="Alerts">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <Badge className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center px-1 text-[9px]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notifications</span>
            <span className="text-xs font-normal text-muted-foreground">{unreadCount} unread</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {recentAlerts.length === 0 ? (
            <div className="px-2 py-4 text-sm text-muted-foreground">No alerts yet.</div>
          ) : (
            <div className="space-y-1 px-1 py-1">
              {recentAlerts.map((alert) => (
                <div key={alert.id} className="rounded-md border border-border/60 p-2">
                  <button
                    type="button"
                    onClick={() => !alert.isRead && onMarkRead?.(alert.id)}
                    className="w-full text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{alert.title}</p>
                        {!alert.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" />}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{alert.message}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{alert.time}</p>
                    </div>
                  </button>

                  <div className="mt-2 flex gap-2">
                    {!alert.isRead && (
                      <button
                        type="button"
                        onClick={() => onMarkRead?.(alert.id)}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Check className="h-3 w-3" /> Read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDelete?.(alert.id)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9" title="Settings">
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setTheme(resolved === "dark" ? "light" : "dark")} className="cursor-pointer">
            {resolved === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            {resolved === "dark" ? "Light Mode" : "Dark Mode"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {!notifEnabled ? (
            <DropdownMenuItem onClick={requestNotifications} className="cursor-pointer">
              <BellRing className="mr-2 h-4 w-4" />
              Enable Notifications
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled>
              <BellRing className="mr-2 h-4 w-4" />
              Notifications On
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/profile">
              <Settings className="mr-2 h-4 w-4" />
              App Settings
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
