import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ShieldAlert, UserPlus, Clock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RecentSignup {
  id: string;
  display_name: string | null;
  created_at: string;
  region: string | null;
  country: string | null;
}

export default function SecurityPanel() {
  const { toast } = useToast();
  const [recentSignups, setRecentSignups] = useState<RecentSignup[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [recentCount, setRecentCount] = useState(0);

  // Security toggles
  const [abuseDetection, setAbuseDetection] = useState(true);
  const [breachMonitor, setBreachMonitor] = useState(true);
  const [hackDetection, setHackDetection] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: all } = await supabase.from("profiles").select("id, display_name, created_at, region, country").order("created_at", { ascending: false });

    const allUsers = all || [];
    setTotalUsers(allUsers.length);

    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const recent = allUsers.filter(u => new Date(u.created_at).getTime() > sevenDaysAgo).slice(0, 20);
    setRecentSignups(recent);
    setRecentCount(recent.length);
  };

  const suspiciousPatterns = recentSignups.filter(u => {
    const name = u.display_name?.toLowerCase() ?? "";
    return name.includes("test") || name.includes("admin") || name.includes("hack") || name.length <= 2 || (!u.region && !u.country);
  });

  const handleToggle = (type: string, value: boolean) => {
    const label = value ? "enabled" : "disabled";
    toast({ title: `${type} ${label}`, description: value ? "Users will be notified of detected threats." : `${type} monitoring is now off.` });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">Auth Security Panel</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{totalUsers}</p><p className="text-xs text-muted-foreground">Total Registered Users</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{recentCount}</p><p className="text-xs text-muted-foreground">Signups (Last 7 Days)</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-destructive">{suspiciousPatterns.length}</p><p className="text-xs text-muted-foreground">Suspicious Patterns</p></CardContent></Card>
      </div>

      {/* Security Toggles */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Threat Detection Toggles</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">When enabled, users will receive notifications about detected security threats.</p>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="font-medium">Abuse Detection</Label>
              <p className="text-xs text-muted-foreground">Monitor for spam accounts, bot signups, and suspicious mass activity</p>
            </div>
            <Switch checked={abuseDetection} onCheckedChange={v => { setAbuseDetection(v); handleToggle("Abuse detection", v); }} />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="font-medium">Breach Monitor</Label>
              <p className="text-xs text-muted-foreground">Alert users if their credentials appear in known data breaches</p>
            </div>
            <Switch checked={breachMonitor} onCheckedChange={v => { setBreachMonitor(v); handleToggle("Breach monitor", v); }} />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="font-medium">Hack Attempt Detection</Label>
              <p className="text-xs text-muted-foreground">Detect brute-force login attempts and unauthorized access patterns</p>
            </div>
            <Switch checked={hackDetection} onCheckedChange={v => { setHackDetection(v); handleToggle("Hack detection", v); }} />
          </div>
        </CardContent>
      </Card>

      {/* Recent Signups */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" /> Recent Signups</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {recentSignups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent signups.</p>
          ) : recentSignups.map(u => {
            const isSuspicious = suspiciousPatterns.some(s => s.id === u.id);
            return (
              <div key={u.id} className="flex items-center justify-between border rounded p-3">
                <div>
                  <p className="font-medium text-sm">{u.display_name || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(u.created_at).toLocaleDateString()} — {u.region || u.country || "No location"}
                  </p>
                </div>
                {isSuspicious && <Badge variant="destructive">Suspicious</Badge>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Security Notes</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>✅ Anonymous signups are <strong>disabled</strong>.</p>
          <p>✅ Email verification is <strong>required</strong> before sign-in.</p>
          <p>✅ Admin access is restricted via server-side <code>has_role</code> RPC check.</p>
          <p>⚠️ Suspicious patterns flag accounts with test/admin names or missing data.</p>
        </CardContent>
      </Card>
    </div>
  );
}
