import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";

interface EnvironmentRecord {
  id: string;
  title: string;
  description: string;
  category: "weather" | "degradation" | "legal-mining" | "pollution";
  severity: "low" | "medium" | "high";
  status: "active" | "resolved";
  createdAt: string;
}

export default function EnvironmentEngine() {
  const [records, setRecords] = useState<EnvironmentRecord[]>([]);
  const [newRecord, setNewRecord] = useState({
    title: "",
    description: "",
    category: "weather" as EnvironmentRecord["category"],
    severity: "low" as EnvironmentRecord["severity"],
  });

  useEffect(() => {
    // Mock initial records
    setRecords([
      {
        id: "e1",
        title: "Heavy Rain Warning",
        description: "Potential flooding in lowland areas.",
        category: "weather",
        severity: "high",
        status: "active",
        createdAt: "2026-03-01",
      },
      {
        id: "e2",
        title: "Illegal Mining Activity",
        description: "Unauthorized excavation detected near river.",
        category: "legal-mining",
        severity: "medium",
        status: "active",
        createdAt: "2026-03-02",
      },
    ]);
  }, []);

  const addRecord = () => {
    if (!newRecord.title) return;
    const id = `e${records.length + 1}`;
    setRecords([
      ...records,
      {
        id,
        ...newRecord,
        status: "active",
        createdAt: new Date().toISOString().slice(0, 10),
      },
    ]);
    setNewRecord({ title: "", description: "", category: "weather", severity: "low" });
  };

  const removeRecord = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-6 p-6">

      {/* Add New Environment Record */}
      <Card>
        <CardHeader>
          <CardTitle>Add Environment Record</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Title"
            value={newRecord.title}
            onChange={(e) => setNewRecord({ ...newRecord, title: e.target.value })}
          />
          <Textarea
            placeholder="Description"
            value={newRecord.description}
            onChange={(e) => setNewRecord({ ...newRecord, description: e.target.value })}
          />
          <div className="flex gap-2">
            <select
              value={newRecord.category}
              onChange={(e) => setNewRecord({ ...newRecord, category: e.target.value as EnvironmentRecord["category"] })}
              className="border rounded p-2"
            >
              <option value="weather">Weather</option>
              <option value="degradation">Degradation</option>
              <option value="legal-mining">Legal Mining</option>
              <option value="pollution">Pollution</option>
            </select>
            <select
              value={newRecord.severity}
              onChange={(e) => setNewRecord({ ...newRecord, severity: e.target.value as EnvironmentRecord["severity"] })}
              className="border rounded p-2"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <Button onClick={addRecord}>Add Record</Button>
          </div>
        </CardContent>
      </Card>

      {/* Environment Record List */}
      <Card>
        <CardHeader>
          <CardTitle>Environment Records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground">No environment records yet.</p>
          ) : (
            records.map((r) => (
              <div key={r.id} className="p-3 border rounded flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                  <Badge
                    variant={r.status === "active" ? "success" : "default"}
                    className="mt-1"
                  >
                    {r.status.toUpperCase()}
                  </Badge>
                  <Badge
                    variant={r.severity === "high" ? "destructive" : r.severity === "medium" ? "warning" : "default"}
                    className="ml-2 mt-1"
                  >
                    {r.severity.toUpperCase()}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">Category: {r.category}</p>
                  <p className="text-xs text-muted-foreground mt-1">Created at: {r.createdAt}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={() => removeRecord(r.id)}>
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
