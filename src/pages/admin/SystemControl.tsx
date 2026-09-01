import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, Ban, CheckCircle, Settings, UserPlus, Search, Activity, Rocket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePilotMode } from "@/hooks/usePilotMode";

interface ProfileRow {
  id: string;
  user_id: string;
  display_name: string | null;
  region: string | null;
  country: string | null;
  farmer_type: string | null;
  created_at: string;
  suspended?: boolean;
}

interface ActivityLog {
  id: string;
  action: string;
  target: string;
  timestamp: string;
}

export default function SystemControl() {
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const { toast } = useToast();

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, user_id, display_name, region, country, farmer_type, created_at")
      .order("created_at", { ascending: false });
    if (data) setUsers(data.map(u => ({ ...u, suspended: false })));
    setLoading(false);
  };

  const addLog = (action: string, target: string) => {
    setLogs(prev => [{ id: crypto.randomUUID(), action, target, timestamp: new Date().toISOString() }, ...prev].slice(0, 50));
  };

  const removeUser = async (user: ProfileRow) => {
    const { error } = await supabase.from("profiles").delete().eq("id", user.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "User removed", description: `${user.display_name || "User"} has been removed.` });
      addLog("Deleted user", user.display_name || user.id);
      fetchUsers();
    }
  };

  const toggleSuspend = (user: ProfileRow) => {
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, suspended: !u.suspended } : u));
    const action = user.suspended ? "Activated" : "Suspended";
    addLog(`${action} user`, user.display_name || user.id);
    toast({ title: `User ${action.toLowerCase()}`, description: `${user.display_name || "User"} has been ${action.toLowerCase()}.` });
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || (u.display_name?.toLowerCase().includes(q)) || (u.region?.toLowerCase().includes(q)) || (u.country?.toLowerCase().includes(q));
  });

  const newThisWeek = users.filter(u => Date.now() - new Date(u.created_at).getTime() < 7 * 86400000).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">System Control — User Management</h2>
      </div>

      <PilotModeCard />


      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{users.length}</p><p className="text-xs text-muted-foreground">Total Users</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{newThisWeek}</p><p className="text-xs text-muted-foreground">New This Week</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{users.filter(u => u.suspended).length}</p><p className="text-xs text-muted-foreground">Suspended</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{logs.length}</p><p className="text-xs text-muted-foreground">Actions Logged</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" /> All Users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search users…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found.</p>
          ) : (
            filtered.map(user => (
              <div key={user.id} className="p-3 border rounded-lg flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{user.display_name || "Unnamed User"}</p>
                    {user.suspended && <Badge variant="destructive">Suspended</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {user.region || user.country || "No location"} · {user.farmer_type || "N/A"}
                  </p>
                  <p className="text-xs text-muted-foreground">Joined: {new Date(user.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant={user.suspended ? "outline" : "secondary"} onClick={() => toggleSuspend(user)} title={user.suspended ? "Activate" : "Suspend"}>
                    {user.suspended ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => removeUser(user)} title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Activity Log</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activities yet.</p>
          ) : logs.map(log => (
            <div key={log.id} className="flex items-center justify-between text-sm border-b pb-2">
              <span><strong>{log.action}</strong> — {log.target}</span>
              <span className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}


