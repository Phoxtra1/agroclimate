import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell, Sun, Moon, Settings, Lightbulb, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/ThemeProvider";

interface DashboardHeaderMenuProps {
  unreadCount?: number;
}

export function DashboardHeaderMenu({ unreadCount = 0 }: DashboardHeaderMenuProps) {
  const { theme, setTheme, resolved } = useTheme();
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

  return (
    <div className="flex items-center gap-1">
      {/* Farm Business Hub */}
      <Link to="/farm-business">
        <Button variant="ghost" size="icon" className="relative h-9 w-9" title="Farm Business Hub">
          <Lightbulb className="h-4 w-4" />
        </Button>
      </Link>

      {/* Notifications bell */}
      <Link to="/alerts">
        <Button variant="ghost" size="icon" className="relative h-9 w-9" title="Alerts">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[9px] flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </Link>

      {/* Settings dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9" title="Settings">
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setTheme(resolved === "dark" ? "light" : "dark")} className="cursor-pointer">
            {resolved === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
            {resolved === "dark" ? "Light Mode" : "Dark Mode"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {!notifEnabled ? (
            <DropdownMenuItem onClick={requestNotifications} className="cursor-pointer">
              <BellRing className="h-4 w-4 mr-2" />
              Enable Notifications
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled>
              <BellRing className="h-4 w-4 mr-2" />
              Notifications On
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/profile">
              <Settings className="h-4 w-4 mr-2" />
              App Settings
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
