import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Profile {
  id: string;
  display_name: string | null;
  region: string | null;
}

export default function UserSettings() {
  const [users, setUsers] = useState<Profile[]>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, region");
    if (data) setUsers(data);
  };

  const deleteUser = async (id: string) => {
    await supabase.from("profiles").delete().eq("id", id);
    fetchUsers();
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">User Management</h2>
      <div className="space-y-3">
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users found.</p>
        ) : (
          users.map((user) => (
            <div key={user.id} className="border p-3 rounded flex justify-between items-center">
              <div>
                <p className="font-semibold">{user.display_name || "Unnamed User"}</p>
                <p className="text-sm text-muted-foreground">Region: {user.region || "Not set"}</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => deleteUser(user.id)}>Remove</Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
