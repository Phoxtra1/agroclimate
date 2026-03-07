import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Edit2, Save, X } from "lucide-react";

interface ProfileRow {
  id: string;
  user_id: string;
  display_name: string | null;
  phone: string | null;
  region: string | null;
  district: string | null;
  community: string | null;
  farm_size: string | null;
  farmer_type: string | null;
  preferred_language: string | null;
  country: string | null;
  created_at: string;
}

export default function UserSettings() {
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<ProfileRow>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, user_id, display_name, phone, region, district, community, farm_size, farmer_type, preferred_language, country, created_at")
      .order("created_at", { ascending: false });
    if (data) setUsers(data);
  };

  const startEdit = (user: ProfileRow) => {
    setEditingId(user.id);
    setEditData({
      display_name: user.display_name,
      region: user.region,
      district: user.district,
      farmer_type: user.farmer_type,
      phone: user.phone,
    });
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase.from("profiles").update(editData).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
      setEditingId(null);
      fetchUsers();
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.display_name?.toLowerCase() ?? "").includes(q) ||
      (u.region?.toLowerCase() ?? "").includes(q) ||
      (u.phone ?? "").includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">User Settings & Profile Management</h2>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, region, or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found.</p>
          ) : (
            filtered.map((user) => (
              <div key={user.id} className="border p-3 rounded space-y-2">
                {editingId === user.id ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Display Name"
                      value={editData.display_name ?? ""}
                      onChange={(e) => setEditData({ ...editData, display_name: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Region"
                        value={editData.region ?? ""}
                        onChange={(e) => setEditData({ ...editData, region: e.target.value })}
                      />
                      <Input
                        placeholder="District"
                        value={editData.district ?? ""}
                        onChange={(e) => setEditData({ ...editData, district: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Farmer Type"
                        value={editData.farmer_type ?? ""}
                        onChange={(e) => setEditData({ ...editData, farmer_type: e.target.value })}
                      />
                      <Input
                        placeholder="Phone"
                        value={editData.phone ?? ""}
                        onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveEdit(user.id)}>
                        <Save className="h-3 w-3 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-3 w-3 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="font-semibold">{user.display_name || "Unnamed User"}</p>
                      <p className="text-xs text-muted-foreground">
                        {[user.region, user.district, user.community].filter(Boolean).join(", ") || "No location"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user.farmer_type || "N/A"} · {user.phone || "No phone"} · {user.preferred_language || "en"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Joined: {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => startEdit(user)}>
                      <Edit2 className="h-3 w-3 mr-1" /> Edit
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
