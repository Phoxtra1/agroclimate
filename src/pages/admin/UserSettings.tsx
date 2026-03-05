import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  email: string;
  subscription_status: string | null;
}

export default function UserSettings() {
  const [users, setUsers] = useState<Profile[]>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, subscription_status");

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
        {users.map((user) => (
          <div
            key={user.id}
            className="border p-3 rounded flex justify-between items-center"
          >
            <div>
              <p className="font-semibold">{user.email}</p>
              <p className="text-sm text-muted-foreground">
                Subscription: {user.subscription_status || "Free"}
              </p>
            </div>

            <button
              onClick={() => deleteUser(user.id)}
              className="text-red-500 text-sm"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
