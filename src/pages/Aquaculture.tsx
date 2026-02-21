import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Fish, Plus, Thermometer, Droplets, Wind, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Pond {
  id: string;
  name: string;
  species: string;
  stock_count: number;
  pond_size_sqm: number | null;
  water_temp: number | null;
  ph_level: number | null;
  dissolved_oxygen: number | null;
  last_feeding: string | null;
  feeding_schedule: string;
  notes: string | null;
}

export default function Aquaculture() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", species: "Tilapia", stock_count: "", pond_size_sqm: "" });

  const fetchPonds = async () => {
    if (!user) return;
    const { data } = await supabase.from("fish_ponds").select("*").order("created_at", { ascending: false });
    setPonds((data as Pond[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchPonds(); }, [user]);

  const addPond = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("fish_ponds").insert({
      user_id: user.id,
      name: form.name,
      species: form.species,
      stock_count: parseInt(form.stock_count) || 0,
      pond_size_sqm: parseFloat(form.pond_size_sqm) || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Pond added!" });
      setDialogOpen(false);
      setForm({ name: "", species: "Tilapia", stock_count: "", pond_size_sqm: "" });
      fetchPonds();
    }
  };

  const logFeeding = async (pondId: string) => {
    await supabase.from("fish_ponds").update({ last_feeding: new Date().toISOString() }).eq("id", pondId);
    toast({ title: "Feeding logged!" });
    fetchPonds();
  };

  const updateWaterQuality = async (pondId: string, field: string, value: string) => {
    await supabase.from("fish_ponds").update({ [field]: parseFloat(value) }).eq("id", pondId);
    fetchPonds();
  };

  const getPhStatus = (ph: number | null) => {
    if (!ph) return { text: "Not recorded", color: "text-muted-foreground" };
    if (ph >= 6.5 && ph <= 8.5) return { text: "Optimal", color: "text-success" };
    if (ph >= 6 && ph <= 9) return { text: "Acceptable", color: "text-warning" };
    return { text: "Critical", color: "text-destructive" };
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Fish className="h-6 w-6 text-accent" /> Aquaculture
          </h1>
          <p className="text-sm text-muted-foreground">Monitor your fish ponds</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Add Pond</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Pond</DialogTitle></DialogHeader>
            <form onSubmit={addPond} className="space-y-3">
              <Input placeholder="Pond name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Select value={form.species} onValueChange={(v) => setForm({ ...form, species: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tilapia">Tilapia</SelectItem>
                  <SelectItem value="Catfish">Catfish</SelectItem>
                  <SelectItem value="Carp">Carp</SelectItem>
                  <SelectItem value="Trout">Trout</SelectItem>
                  <SelectItem value="Shrimp">Shrimp</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Stock count" type="number" value={form.stock_count} onChange={(e) => setForm({ ...form, stock_count: e.target.value })} />
              <Input placeholder="Pond size (m²)" type="number" value={form.pond_size_sqm} onChange={(e) => setForm({ ...form, pond_size_sqm: e.target.value })} />
              <Button type="submit" className="w-full">Add Pond</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : ponds.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Fish className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="font-semibold mb-1">No ponds yet</p>
            <p className="text-sm text-muted-foreground mb-4">Add your first fish pond to start monitoring</p>
            <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Pond</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ponds.map((pond) => {
            const phStatus = getPhStatus(pond.ph_level);
            return (
              <Card key={pond.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{pond.name}</span>
                    <span className="text-xs font-normal bg-accent/10 text-accent px-2 py-1 rounded-full">{pond.species}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Fish className="h-4 w-4 text-muted-foreground" />
                      <span>{pond.stock_count} fish</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-4 w-4 text-muted-foreground" />
                      <span>{pond.water_temp ?? "—"}°C</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplets className="h-4 w-4 text-muted-foreground" />
                      <span className={phStatus.color}>pH: {pond.ph_level ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wind className="h-4 w-4 text-muted-foreground" />
                      <span>O₂: {pond.dissolved_oxygen ?? "—"} mg/L</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        {pond.last_feeding
                          ? `Fed ${new Date(pond.last_feeding).toLocaleString()}`
                          : "Not fed yet"}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => logFeeding(pond.id)}>
                      Log Feeding
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="secondary" className="flex-1 text-xs">Update Water</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Update Water Quality - {pond.name}</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium">Temperature (°C)</label>
                            <Input type="number" step="0.1" defaultValue={pond.water_temp ?? ""} onBlur={(e) => updateWaterQuality(pond.id, "water_temp", e.target.value)} />
                          </div>
                          <div>
                            <label className="text-sm font-medium">pH Level</label>
                            <Input type="number" step="0.1" defaultValue={pond.ph_level ?? ""} onBlur={(e) => updateWaterQuality(pond.id, "ph_level", e.target.value)} />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Dissolved Oxygen (mg/L)</label>
                            <Input type="number" step="0.1" defaultValue={pond.dissolved_oxygen ?? ""} onBlur={(e) => updateWaterQuality(pond.id, "dissolved_oxygen", e.target.value)} />
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
