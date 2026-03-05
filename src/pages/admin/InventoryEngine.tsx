import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, Plus } from "lucide-react";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  status: "active" | "low-stock" | "out-of-stock";
  addedAt: string;
}

export default function InventoryEngine() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [newItem, setNewItem] = useState({ name: "", category: "", quantity: 0 });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Mock initial inventory
  useEffect(() => {
    setInventory([
      { id: "i1", name: "Fertilizer - NPK", category: "Fertilizer", quantity: 120, status: "active", addedAt: "2026-02-25" },
      { id: "i2", name: "Corn Seeds", category: "Seeds", quantity: 50, status: "low-stock", addedAt: "2026-02-28" },
      { id: "i3", name: "Tractor Fuel", category: "Equipment", quantity: 0, status: "out-of-stock", addedAt: "2026-03-01" },
    ]);
  }, []);

  const addItem = () => {
    if (!newItem.name || !newItem.category || newItem.quantity < 0) return;
    const id = `i${inventory.length + 1}`;
    const status: InventoryItem["status"] =
      newItem.quantity === 0 ? "out-of-stock" : newItem.quantity < 50 ? "low-stock" : "active";
    setInventory([...inventory, { id, ...newItem, status, addedAt: new Date().toISOString().slice(0, 10) }]);
    setNewItem({ name: "", category: "", quantity: 0 });
  };

  const startEdit = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setNewItem({ name: item.name, category: item.category, quantity: item.quantity });
  };

  const saveEdit = () => {
    if (!editingItemId) return;
    const status: InventoryItem["status"] =
      newItem.quantity === 0 ? "out-of-stock" : newItem.quantity < 50 ? "low-stock" : "active";
    setInventory((prev) =>
      prev.map((item) => (item.id === editingItemId ? { ...item, ...newItem, status } : item))
    );
    setEditingItemId(null);
    setNewItem({ name: "", category: "", quantity: 0 });
  };

  const removeItem = (id: string) => {
    setInventory((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-6 p-6">

      {/* Add / Edit Inventory Item */}
      <Card>
        <CardHeader>
          <CardTitle>{editingItemId ? "Edit Inventory Item" : "Add New Inventory Item"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Item name"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            />
            <Input
              placeholder="Category"
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Quantity"
              value={newItem.quantity || ""}
              onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) })}
            />
            {editingItemId ? (
              <Button onClick={saveEdit}>Save</Button>
            ) : (
              <Button onClick={addItem}>
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Inventory List */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {inventory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items in inventory.</p>
          ) : (
            inventory.map((item) => (
              <div key={item.id} className="flex justify-between p-3 border rounded items-center">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.category} • Added on {item.addedAt}</p>
                  <Badge
                    variant={item.status === "active" ? "success" : item.status === "low-stock" ? "warning" : "destructive"}
                    className="mt-1"
                  >
                    {item.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => removeItem(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
