import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QRCodeSVG } from "qrcode.react";
import {
  Users, Plus, ClipboardList, Clock, AlertTriangle, QrCode,
  MapPin, Calendar, CheckCircle2, XCircle, Loader2, Copy, Download
} from "lucide-react";
import { format } from "date-fns";

interface Handler {
  id: string;
  user_id: string;
  handler_name: string;
  handler_type: string;
  assigned_farm: string | null;
  status: string;
  created_at: string;
}

interface Task {
  id: string;
  handler_id: string;
  title: string;
  description: string | null;
  field_location: string | null;
  deadline: string | null;
  evidence_required: boolean;
  status: string;
  quantity_label: string | null;
  quantity_expected: number | null;
  quantity_completed: number | null;
  completed_at: string | null;
  created_at: string;
}

interface WorkSession {
  id: string;
  handler_id: string;
  clock_in: string;
  clock_out: string | null;
  gps_lat: number | null;
  gps_lon: number | null;
}

interface HandlerIssue {
  id: string;
  handler_id: string;
  issue_type: string;
  description: string | null;
  status: string;
  created_at: string;
}

interface FarmQR {
  id: string;
  farm_name: string;
  farm_location: string | null;
  qr_code_data: string;
  created_at: string;
}

export default function HandlerManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [handlers, setHandlers] = useState<Handler[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [issues, setIssues] = useState<HandlerIssue[]>([]);
  const [farmQRs, setFarmQRs] = useState<FarmQR[]>([]);
  const [loading, setLoading] = useState(true);

  // Create handler dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newHandler, setNewHandler] = useState({ name: "", email: "", password: "", type: "labourer", farm: "" });
  const [creating, setCreating] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  // Create task dialog
  const [showTask, setShowTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", field: "", handler_id: "", deadline: "", evidence: false, qty_label: "", qty_expected: "" });
  const [creatingTask, setCreatingTask] = useState(false);

  // QR dialog
  const [showQR, setShowQR] = useState(false);
  const [newFarm, setNewFarm] = useState({ name: "", location: "" });

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [h, t, s, i, q] = await Promise.all([
      supabase.from("handlers").select("*").eq("farmer_id", user.id).order("created_at", { ascending: false }),
      supabase.from("handler_tasks").select("*").eq("farmer_id", user.id).order("created_at", { ascending: false }),
      supabase.from("work_sessions").select("*").order("clock_in", { ascending: false }).limit(50),
      supabase.from("handler_issues").select("*").eq("farmer_id", user.id).order("created_at", { ascending: false }),
      supabase.from("farm_qr_codes").select("*").eq("farmer_id", user.id).order("created_at", { ascending: false }),
    ]);

    if (h.data) setHandlers(h.data);
    if (t.data) setTasks(t.data);
    if (s.data) {
      const handlerIds = (h.data || []).map(x => x.id);
      setSessions(s.data.filter(x => handlerIds.includes(x.handler_id)));
    }
    if (i.data) setIssues(i.data);
    if (q.data) setFarmQRs(q.data);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createHandler = async () => {
    if (!user || !newHandler.name || !newHandler.email || !newHandler.password) return;
    setCreating(true);
    try {
      // Create auth account for handler via edge function
      const { data: fnData, error: fnError } = await supabase.functions.invoke("create-handler", {
        body: {
          email: newHandler.email.trim().toLowerCase(),
          password: newHandler.password,
          handler_name: newHandler.name,
          handler_type: newHandler.type,
          assigned_farm: newHandler.farm || null,
          farmer_id: user.id,
        },
      });

      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);

      setInviteLink(`${window.location.origin}/?handler_invite=true&email=${encodeURIComponent(newHandler.email)}`);
      toast({ title: "Handler created!", description: `${newHandler.name} can now log in.` });
      setNewHandler({ name: "", email: "", password: "", type: "labourer", farm: "" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setCreating(false);
  };

  const createTask = async () => {
    if (!user || !newTask.title || !newTask.handler_id) return;
    setCreatingTask(true);
    const { error } = await supabase.from("handler_tasks").insert({
      farmer_id: user.id,
      handler_id: newTask.handler_id,
      title: newTask.title,
      description: newTask.description || null,
      field_location: newTask.field || null,
      deadline: newTask.deadline ? new Date(newTask.deadline).toISOString() : null,
      evidence_required: newTask.evidence,
      quantity_label: newTask.qty_label || null,
      quantity_expected: newTask.qty_expected ? Number(newTask.qty_expected) : null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Task assigned!" });
      setNewTask({ title: "", description: "", field: "", handler_id: "", deadline: "", evidence: false, qty_label: "", qty_expected: "" });
      setShowTask(false);
      fetchData();
    }
    setCreatingTask(false);
  };

  const createFarmQR = async () => {
    if (!user || !newFarm.name) return;
    const qrData = `agroclimate:farm:${user.id}:${Date.now()}`;
    const { error } = await supabase.from("farm_qr_codes").insert({
      farmer_id: user.id,
      farm_name: newFarm.name,
      farm_location: newFarm.location || null,
      qr_code_data: qrData,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Farm QR created!" });
      setNewFarm({ name: "", location: "" });
      setShowQR(false);
      fetchData();
    }
  };

  const getHandlerName = (id: string) => handlers.find(h => h.id === id)?.handler_name ?? "Unknown";

  const statusColor = (s: string) => {
    switch (s) {
      case "completed": return "bg-green-500/10 text-green-600";
      case "in_progress": return "bg-blue-500/10 text-blue-600";
      case "pending": return "bg-yellow-500/10 text-yellow-700";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Handler Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage farm laborers, assign tasks, track activities</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) setInviteLink(null); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Handler</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Create Handler Account</DialogTitle></DialogHeader>
              {inviteLink ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Handler account created! Share these credentials:</p>
                  <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                    <p><strong>Email:</strong> {newHandler.email || "—"}</p>
                    <p><strong>Login:</strong> {window.location.origin}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(inviteLink); toast({ title: "Copied!" }); }}>
                    <Copy className="h-4 w-4 mr-1" /> Copy Invite Link
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div><Label>Handler Name *</Label><Input value={newHandler.name} onChange={e => setNewHandler(p => ({ ...p, name: e.target.value }))} /></div>
                  <div><Label>Email *</Label><Input type="email" value={newHandler.email} onChange={e => setNewHandler(p => ({ ...p, email: e.target.value }))} /></div>
                  <div><Label>Temporary Password *</Label><Input type="password" value={newHandler.password} onChange={e => setNewHandler(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" /></div>
                  <div>
                    <Label>Handler Type</Label>
                    <Select value={newHandler.type} onValueChange={v => setNewHandler(p => ({ ...p, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="labourer">Labourer</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Assigned Farm</Label><Input value={newHandler.farm} onChange={e => setNewHandler(p => ({ ...p, farm: e.target.value }))} /></div>
                  <Button onClick={createHandler} disabled={creating} className="w-full">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />} Create Handler
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={showTask} onOpenChange={setShowTask}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><ClipboardList className="h-4 w-4 mr-1" /> Assign Task</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Assign Task to Handler</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Task Title *</Label><Input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Spray tomatoes – Field B" /></div>
                <div><Label>Description</Label><Textarea value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} /></div>
                <div><Label>Field / Location</Label><Input value={newTask.field} onChange={e => setNewTask(p => ({ ...p, field: e.target.value }))} /></div>
                <div>
                  <Label>Assign Handler *</Label>
                  <Select value={newTask.handler_id} onValueChange={v => setNewTask(p => ({ ...p, handler_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select handler" /></SelectTrigger>
                    <SelectContent>
                      {handlers.filter(h => h.status === "active").map(h => (
                        <SelectItem key={h.id} value={h.id}>{h.handler_name} ({h.handler_type})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Deadline</Label><Input type="datetime-local" value={newTask.deadline} onChange={e => setNewTask(p => ({ ...p, deadline: e.target.value }))} /></div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={newTask.evidence} onChange={e => setNewTask(p => ({ ...p, evidence: e.target.checked }))} id="evidence-req" />
                  <Label htmlFor="evidence-req">Evidence required (photo/video)</Label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Quantity Label</Label><Input value={newTask.qty_label} onChange={e => setNewTask(p => ({ ...p, qty_label: e.target.value }))} placeholder="e.g. bags, acres" /></div>
                  <div><Label>Expected Qty</Label><Input type="number" value={newTask.qty_expected} onChange={e => setNewTask(p => ({ ...p, qty_expected: e.target.value }))} /></div>
                </div>
                <Button onClick={createTask} disabled={creatingTask} className="w-full">
                  {creatingTask ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Assign Task
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showQR} onOpenChange={setShowQR}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><QrCode className="h-4 w-4 mr-1" /> Farm QR</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Generate Farm QR Code</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Farm Name *</Label><Input value={newFarm.name} onChange={e => setNewFarm(p => ({ ...p, name: e.target.value }))} /></div>
                <div><Label>Location</Label><Input value={newFarm.location} onChange={e => setNewFarm(p => ({ ...p, location: e.target.value }))} /></div>
                <Button onClick={createFarmQR} className="w-full">Generate QR Code</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="handlers" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="handlers">Handlers ({handlers.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="issues">Issues ({issues.filter(i => i.status === "open").length})</TabsTrigger>
          <TabsTrigger value="qr">Farm QR</TabsTrigger>
        </TabsList>

        <TabsContent value="handlers">
          {handlers.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No handlers yet. Click "Add Handler" to get started.</CardContent></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {handlers.map(h => (
                <Card key={h.id}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{h.handler_name}</h3>
                      <Badge variant={h.status === "active" ? "default" : "secondary"}>{h.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Type: <span className="capitalize">{h.handler_type}</span></p>
                      {h.assigned_farm && <p>Farm: {h.assigned_farm}</p>}
                      <p>Added: {format(new Date(h.created_at), "dd MMM yyyy")}</p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="text-primary font-medium">{tasks.filter(t => t.handler_id === h.id && t.status === "pending").length} pending</span>
                      <span className="text-green-600 font-medium">{tasks.filter(t => t.handler_id === h.id && t.status === "completed").length} done</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tasks">
          {tasks.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No tasks assigned yet.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {tasks.map(t => (
                <Card key={t.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm">{t.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                          <span>Handler: {getHandlerName(t.handler_id)}</span>
                          {t.field_location && <span>• {t.field_location}</span>}
                          {t.deadline && <span>• Due: {format(new Date(t.deadline), "dd MMM, HH:mm")}</span>}
                          {t.quantity_label && <span>• {t.quantity_completed ?? "—"}/{t.quantity_expected} {t.quantity_label}</span>}
                        </div>
                      </div>
                      <Badge className={statusColor(t.status)}>{t.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sessions">
          {sessions.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No work sessions recorded yet.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => (
                <Card key={s.id}>
                  <CardContent className="pt-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{getHandlerName(s.handler_id)}</p>
                      <p className="text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {format(new Date(s.clock_in), "dd MMM HH:mm")}
                        {s.clock_out ? ` → ${format(new Date(s.clock_out), "HH:mm")}` : " (active)"}
                      </p>
                    </div>
                    {s.gps_lat && <MapPin className="h-4 w-4 text-muted-foreground" />}
                    {s.clock_out ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Badge variant="default" className="text-xs">Active</Badge>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="issues">
          {issues.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No issues reported.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {issues.map(i => (
                <Card key={i.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          <h3 className="font-semibold text-sm capitalize">{i.issue_type.replace(/_/g, " ")}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{i.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">By: {getHandlerName(i.handler_id)} • {format(new Date(i.created_at), "dd MMM yyyy")}</p>
                      </div>
                      <Badge variant={i.status === "open" ? "destructive" : "secondary"}>{i.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="qr">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {farmQRs.map(qr => (
              <Card key={qr.id}>
                <CardContent className="pt-4 flex flex-col items-center gap-3">
                  <QRCodeSVG value={qr.qr_code_data} size={160} />
                  <h3 className="font-semibold text-sm">{qr.farm_name}</h3>
                  {qr.farm_location && <p className="text-xs text-muted-foreground">{qr.farm_location}</p>}
                  <p className="text-xs text-muted-foreground">Print and place at farm entrance</p>
                </CardContent>
              </Card>
            ))}
            {farmQRs.length === 0 && (
              <Card><CardContent className="py-12 text-center text-muted-foreground col-span-full">No farm QR codes generated yet.</CardContent></Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
