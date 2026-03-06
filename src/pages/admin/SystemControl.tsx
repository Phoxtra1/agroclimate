import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus } from "lucide-react";

interface UserItem {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  subscriptionStatus: "active" | "inactive" | "trial";
  createdAt: string;
}

export default function SystemControl() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [newUser, setNewUser] = useState({ name: "", email: "" });

  useEffect(() => {
    setUsers([
      { id: "u1", name: "Alice Johnson", email: "alice@example.com", isActive: true, subscriptionStatus: "active", createdAt: "2026-03-01" },
      { id: "u2", name: "Bob Smith", email: "bob@example.com", isActive: false, subscriptionStatus: "trial", createdAt: "2026-03-02" },
    ]);
  }, []);

  const addUser = () => {
    if (!newUser.name || !newUser.email) return;
    setUsers([...users, { id: `u${Date.now()}`, ...newUser, isActive: true, subscriptionStatus: "trial", createdAt: new Date().toISOString().slice(0, 10) }]);
    setNewUser({ name: "", email: "" });
  };

  const toggleActive = (id: string) => setUsers(prev => prev.map(u => u.id === id ? { ...u, isActive: !u.isActive } : u));
  const removeUser = (id: string) => setUsers(prev => prev.filter(u => u.id !== id));

  const activeVariant = (active: boolean): "default" | "destructive" => active ? "default" : "destructive";
  const subVariant = (s: string): "default" | "secondary" | "outline" => {
    if (s === "active") return "default";
    if (s === "trial") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader><CardTitle>Add New User</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
          <Input placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
          <Button onClick={addUser}><UserPlus className="mr-2 h-4 w-4" /> Add User</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Users</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {users.length === 0 ? <p className="text-sm text-muted-foreground">No users found.</p> : users.map(user => (
            <div key={user.id} className="p-3 border rounded flex justify-between items-start">
              <div className="flex-1">
                <p className="font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <Badge variant={activeVariant(user.isActive)} className="mt-1">{user.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
                <Badge variant={subVariant(user.subscriptionStatus)} className="ml-2 mt-1">{user.subscriptionStatus.toUpperCase()}</Badge>
                <p className="text-xs text-muted-foreground mt-1">Created: {user.createdAt}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => toggleActive(user.id)}>{user.isActive ? "Deactivate" : "Activate"}</Button>
                <Button size="sm" variant="destructive" onClick={() => removeUser(user.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
