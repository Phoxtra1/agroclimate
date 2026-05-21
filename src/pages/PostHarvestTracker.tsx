import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sprout, AlertTriangle, Package, Camera, Sparkles, Trash2, Search, Loader2, CloudOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePostHarvest, computeRisk, uploadHarvestPhoto, type HarvestEntry, type RiskLevel } from "@/hooks/usePostHarvest";
import { queueHarvest, getPendingCount, syncPendingHarvests, installOfflineSync } from "@/lib/offlineQueue";

const CROP_SUGGESTIONS = ["Maize", "Rice", "Cassava", "Yam", "Tomato", "Pepper", "Onion", "Cocoa", "Plantain", "Beans", "Groundnut", "Millet"];
const UNITS = ["kg", "bags", "tons", "crates", "baskets"];
const STORAGE_METHODS = ["Bagged", "Crib", "Open space", "Sealed container", "Cold storage", "Silo"];

function riskBadge(level: RiskLevel) {
  if (level === "danger") return <Badge className="bg-red-500 hover:bg-red-500/90 text-white">High Risk</Badge>;
  if (level === "warning") return <Badge className="bg-yellow-500 hover:bg-yellow-500/90 text-black">Warning</Badge>;
  return <Badge className="bg-green-600 hover:bg-green-600/90 text-white">Safe</Badge>;
}

function OverviewPanel({ entries }: { entries: HarvestEntry[] }) {
  const totalQty = entries.reduce((sum, e) => sum + Number(e.quantity || 0), 0);
  const highRisk = entries.filter((e) => computeRisk(e).level === "danger").length;
  const recent = entries.slice(0, 3);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Card><CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs"><Package className="h-4 w-4" /> Total stored</div>
        <p className="text-2xl font-bold mt-1">{entries.length}</p>
        <p className="text-xs text-muted-foreground">{totalQty.toLocaleString()} units total</p>
      </CardContent></Card>
      <Card><CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs"><AlertTriangle className="h-4 w-4 text-red-500" /> High-risk items</div>
        <p className="text-2xl font-bold mt-1 text-red-500">{highRisk}</p>
        <p className="text-xs text-muted-foreground">Need attention now</p>
      </CardContent></Card>
      <Card><CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs"><Sprout className="h-4 w-4" /> Recent harvests</div>
        <p className="text-2xl font-bold mt-1">{recent.length}</p>
        <p className="text-xs text-muted-foreground truncate">{recent.map((r) => r.crop_name).join(", ") || "None"}</p>
      </CardContent></Card>
    </div>
  );
}

function HarvestForm({ onAdded }: { onAdded: () => void }) {
  const { user } = useAuth();
  const { addEntry } = usePostHarvest();
  const [cropName, setCropName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [method, setMethod] = useState("Bagged");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cropName || !quantity) { toast.error("Crop name and quantity are required"); return; }
    if (!user) { toast.error("Please sign in"); return; }
    setSaving(true);
    try {
      const offline = !navigator.onLine;
      if (offline) {
        await queueHarvest({
          user_id: user.id,
          crop_name: cropName,
          quantity: Number(quantity),
          unit, harvest_date: date,
          storage_location: location || null,
          storage_method: method || null,
          notes: notes || null,
        }, files);
        toast.success("Saved offline — will sync automatically when online");
      } else {
        const photoUrls: string[] = [];
        const failedPhotos: File[] = [];
        for (const f of files) {
          try { photoUrls.push(await uploadHarvestPhoto(user.id, f)); }
          catch { failedPhotos.push(f); }
        }
        try {
          await addEntry({
            crop_name: cropName,
            quantity: Number(quantity),
            unit, harvest_date: date,
            storage_location: location || null,
            storage_method: method || null,
            notes: notes || null,
            photos: photoUrls,
          });
          if (failedPhotos.length) {
            // Queue remaining photos as a follow-up entry? simpler: queue full retry
            toast.message(`Saved. ${failedPhotos.length} photo(s) will retry when online.`);
            await queueHarvest({
              user_id: user.id,
              crop_name: `${cropName} (photos)`,
              quantity: 0, unit, harvest_date: date,
              storage_location: location || null,
              storage_method: null, notes: "Photo-only retry",
            }, failedPhotos);
          } else {
            toast.success("Harvest saved");
          }
        } catch {
          // Network failure — queue the whole thing
          await queueHarvest({
            user_id: user.id,
            crop_name: cropName,
            quantity: Number(quantity),
            unit, harvest_date: date,
            storage_location: location || null,
            storage_method: method || null,
            notes: notes || null,
          }, files);
          toast.success("Saved offline — will sync automatically when online");
        }
      }
      setCropName(""); setQuantity(""); setLocation(""); setNotes(""); setFiles([]);
      onAdded();
    } catch (err: any) {
      toast.error(err.message || "Could not save");
    } finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Log a new harvest</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Crop name</Label>
            <Input list="crop-suggestions" value={cropName} onChange={(e) => setCropName(e.target.value)} placeholder="e.g. Maize" required />
            <datalist id="crop-suggestions">
              {CROP_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantity</Label>
              <Input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
            <div>
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Harvest date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <Label>Storage method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STORAGE_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Storage location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Warehouse, room, farm…" />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div>
            <Label className="flex items-center gap-2"><Camera className="h-4 w-4" /> Add photos</Label>
            <Input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            {files.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {files.map((f, i) => (
                  <img key={i} src={URL.createObjectURL(f)} alt="preview" className="h-14 w-14 object-cover rounded border" />
                ))}
              </div>
            )}
          </div>
          <Button type="submit" className="w-full h-11" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Harvest"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function HarvestList({ entries, onAdvice, onDelete }: { entries: HarvestEntry[]; onAdvice: (e: HarvestEntry) => void; onDelete: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (search && !e.crop_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (riskFilter !== "all" && computeRisk(e).level !== riskFilter) return false;
      return true;
    });
  }, [entries, search, riskFilter]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Stored harvests</CardTitle>
        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search crop…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={riskFilter} onValueChange={(v) => setRiskFilter(v as any)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All risks</SelectItem>
              <SelectItem value="safe">Safe</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="danger">High Risk</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No harvest entries yet. Log your first harvest to start tracking.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((e) => {
              const risk = computeRisk(e);
              return (
                <div key={e.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{e.crop_name}</span>
                        <span className="text-sm text-muted-foreground">{Number(e.quantity).toLocaleString()} {e.unit}</span>
                        {riskBadge(risk.level)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {risk.days} day{risk.days === 1 ? "" : "s"} since harvest · {e.storage_method || "N/A"} · {e.storage_location || "no location"}
                      </p>
                      <p className="text-xs mt-1">{risk.message}</p>
                      {e.photos && e.photos.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {e.photos.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer">
                              <img src={url} alt="" className="h-14 w-14 object-cover rounded border" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => onAdvice(e)}>
                        <Sparkles className="h-3 w-3 mr-1" /> Advice
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(e.id)} className="text-red-500">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdviceModal({ entry, open, onClose }: { entry: HarvestEntry | null; open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  if (!entry) return null;
  const risk = computeRisk(entry);
  const prompt = `I have stored ${entry.quantity} ${entry.unit} of ${entry.crop_name} for ${risk.days} days using "${entry.storage_method || "unspecified storage"}" at "${entry.storage_location || "unspecified location"}". Current spoilage risk: ${risk.level}. Advise me on: 1) what to do now, 2) how to prevent spoilage, and 3) whether I should sell or continue storing.`;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Get Odeneho AI advice</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p><b>Crop:</b> {entry.crop_name}</p>
          <p><b>Days stored:</b> {risk.days}</p>
          <p><b>Storage method:</b> {entry.storage_method || "N/A"}</p>
          <p><b>Risk level:</b> {risk.level}</p>
          <p className="text-muted-foreground text-xs">We'll send this context to Odeneho AI for a detailed recommendation.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => {
            try { sessionStorage.setItem("odeneho-prefill", prompt); } catch {}
            navigate("/odeneho");
          }}>Open Odeneho</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PostHarvestTracker() {
  const { entries, loading, deleteEntry, fetchEntries } = usePostHarvest();
  const [adviceEntry, setAdviceEntry] = useState<HarvestEntry | null>(null);
  const [pending, setPending] = useState(getPendingCount());
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    installOfflineSync();
    const refresh = () => setPending(getPendingCount());
    const onOnline = () => { setOnline(true); refresh(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("agc:queue-changed", refresh);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const t = setInterval(refresh, 5000);
    return () => {
      window.removeEventListener("agc:queue-changed", refresh);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(t);
    };
  }, []);

  const dangerCount = entries.filter((e) => computeRisk(e).level === "danger").length;

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this harvest entry?")) return;
    await deleteEntry(id);
    toast.success("Entry deleted");
  };

  const runSync = async () => {
    setSyncing(true);
    const r = await syncPendingHarvests();
    setSyncing(false);
    setPending(getPendingCount());
    if (r.synced) { toast.success(`Synced ${r.synced} entr${r.synced === 1 ? "y" : "ies"}`); fetchEntries(); }
    if (r.failed) toast.error(`${r.failed} still pending — will retry`);
    if (!r.synced && !r.failed) toast.message("Nothing to sync");
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Sprout className="h-6 w-6 text-primary" /> Post-Harvest Tracker</h1>
        <p className="text-sm text-muted-foreground">Track stored crops, monitor spoilage risk and get AI guidance.</p>
      </div>

      {(pending > 0 || !online) && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-800 dark:text-yellow-200 rounded-lg p-3 flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <CloudOff className="h-4 w-4" />
            <span>
              {!online ? "You're offline. " : ""}
              {pending > 0 ? `${pending} entr${pending === 1 ? "y" : "ies"} waiting to sync.` : "All saved locally — will sync when online."}
            </span>
          </div>
          {online && pending > 0 && (
            <Button size="sm" variant="outline" onClick={runSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />} Sync now
            </Button>
          )}
        </div>
      )}

      {dangerCount > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 rounded-lg p-3 flex items-start gap-2 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div><b>{dangerCount}</b> harvest{dangerCount > 1 ? "s are" : " is"} at high spoilage risk. Inspect storage now.</div>
        </div>
      )}

      <OverviewPanel entries={entries} />

      <Tabs defaultValue="log" className="w-full">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="log">Log harvest</TabsTrigger>
          <TabsTrigger value="list">Stored ({entries.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="log" className="mt-3">
          <HarvestForm onAdded={() => { /* realtime refresh */ }} />
        </TabsContent>
        <TabsContent value="list" className="mt-3">
          {loading ? (
            <div className="text-center py-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
          ) : (
            <HarvestList entries={entries} onAdvice={(e) => setAdviceEntry(e)} onDelete={handleDelete} />
          )}
        </TabsContent>
      </Tabs>

      <AdviceModal entry={adviceEntry} open={!!adviceEntry} onClose={() => setAdviceEntry(null)} />
    </div>
  );
}
