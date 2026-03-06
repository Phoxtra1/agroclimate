import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { UploadCloud, Trash2 } from "lucide-react";

interface FlightAdvisory {
  id: string;
  title: string;
  description: string;
  ndviFiles: string[];
  surveyVideos: string[];
  status: "pending" | "active" | "reviewed";
  createdAt: string;
}

export default function FlightEngine() {
  const [advisories, setAdvisories] = useState<FlightAdvisory[]>([]);
  const [newAdvisory, setNewAdvisory] = useState({ title: "", description: "", ndviFiles: [] as string[], surveyVideos: [] as string[] });

  useEffect(() => {
    setAdvisories([
      { id: "f1", title: "Corn Field Survey 2026-03", description: "NDVI analysis for March growth stage.", ndviFiles: ["ndvi_march_01.png"], surveyVideos: ["video1.mp4"], status: "active", createdAt: "2026-03-01" },
      { id: "f2", title: "Rice Field Aerial Review", description: "Drone survey for irrigation analysis.", ndviFiles: ["rice_ndvi.png"], surveyVideos: ["rice_survey.mp4"], status: "pending", createdAt: "2026-03-03" },
    ]);
  }, []);

  const uploadAdvisory = () => {
    if (!newAdvisory.title) return;
    setAdvisories([...advisories, { id: `f${advisories.length + 1}`, ...newAdvisory, status: "pending", createdAt: new Date().toISOString().slice(0, 10) }]);
    setNewAdvisory({ title: "", description: "", ndviFiles: [], surveyVideos: [] });
  };

  const removeAdvisory = (id: string) => setAdvisories(prev => prev.filter(a => a.id !== id));

  const statusVariant = (s: string): "default" | "secondary" | "outline" | "destructive" => {
    if (s === "active") return "default";
    if (s === "pending") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader><CardTitle>Upload Flight Advisory</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Title" value={newAdvisory.title} onChange={(e) => setNewAdvisory({ ...newAdvisory, title: e.target.value })} />
          <Textarea placeholder="Description" value={newAdvisory.description} onChange={(e) => setNewAdvisory({ ...newAdvisory, description: e.target.value })} />
          <Button onClick={uploadAdvisory}><UploadCloud className="mr-2 h-4 w-4" /> Publish Advisory</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Current Flight Advisories</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {advisories.length === 0 ? <p className="text-sm text-muted-foreground">No flight advisories yet.</p> : advisories.map(adv => (
            <div key={adv.id} className="p-3 border rounded flex justify-between items-start">
              <div className="flex-1">
                <p className="font-medium">{adv.title}</p>
                <p className="text-xs text-muted-foreground">{adv.description}</p>
                <p className="text-xs text-muted-foreground mt-1">NDVI: {adv.ndviFiles.join(", ")} · Videos: {adv.surveyVideos.join(", ")}</p>
                <Badge variant={statusVariant(adv.status)} className="mt-1">{adv.status.toUpperCase()}</Badge>
                <p className="text-xs text-muted-foreground mt-1">Created: {adv.createdAt}</p>
              </div>
              <Button size="sm" variant="destructive" onClick={() => removeAdvisory(adv.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
