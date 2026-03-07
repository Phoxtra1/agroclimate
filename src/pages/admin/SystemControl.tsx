import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Ban, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProfileRow {
  id: string;
  user_id: string;
  display_name: string | null;
  region: string | null;
  country: string | null;
  farmer_type: string | null;
  created_at: string;
}

export default function SystemControl() {
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, user_id, display_name, region, country, farmer_type, created_at")
      .order("created_at", { ascending: false });
    if (data) setUsers(data);
    setLoading(false);
  };

  const removeUser = async (id: string) => {
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "User profile removed" });
      fetchUsers();
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">System Control — User Management</h2>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{users.length}</p>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">
              {users.filter((u) => {
                const d = new Date(u.created_at);
                return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
              }).length}
            </p>
            <p className="text-xs text-muted-foreground">New This Week</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>All Users</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found.</p>
          ) : (
            users.map((user) => (
              <div key={user.id} className="p-3 border rounded flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{user.display_name || "Unnamed User"}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.region || user.country || "No location"} · {user.farmer_type || "N/A"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Joined: {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button size="sm" variant="destructive" onClick={() => removeUser(user.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
