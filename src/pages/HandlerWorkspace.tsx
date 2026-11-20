import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  ClipboardList, Clock, Upload, AlertTriangle, LogOut, CheckCircle2,
  Loader2, Camera, MapPin
} from "lucide-react";
import { format } from "date-fns";
import agyenkwaIcon from "@/assets/agyenkwa-icon.png";
import { HandlerDashboard } from "@/components/handler/HandlerDashboard";
import { validateHandlerGpsFix } from "@/lib/handlerGps";

export default function HandlerWorkspace() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [handler, setHandler] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState(false);

  // Issue report
  const [showIssue, setShowIssue] = useState(false);
  const [issueType, setIssueType] = useState("pest_outbreak");
  const [issueDesc, setIssueDesc] = useState("");
  const [reportingIssue, setReportingIssue] = useState(false);

  // Task completion
  const [completingTask, setCompletingTask] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [completionQty, setCompletionQty] = useState("");
  const [evidenceCounts, setEvidenceCounts] = useState<Record<string, number>>({});
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);
  const fetchVersion = useRef(0);
  const currentUserId = useRef<string | null>(user?.id ?? null);
  currentUserId.current = user?.id ?? null;

  const getGPS = (): Promise<{ lat: number; lon: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(validateHandlerGpsFix(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy,
          pos.timestamp,
        )),
        () => resolve(null),
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
      );
    });
  };

  const fetchData = useCallback(async () => {
    const userId = user?.id;
    if ((userId ?? null) !== currentUserId.current) return;
    const version = ++fetchVersion.current;
    if (!userId) {
      setHandler(null);
      setTasks([]);
      setActiveSession(null);
      setEvidenceCounts({});
      setLoading(false);
      return;
    }
    setLoading(true);
    // Do not display a previous handler's data while another account is loading.
    setHandler(null);
    setTasks([]);
    setActiveSession(null);
    setEvidenceCounts({});

    const { data: h, error: handlerError } = await supabase.from("handlers").select("*").eq("user_id", userId).maybeSingle();
    if (version !== fetchVersion.current || userId !== currentUserId.current) return;
    if (handlerError || !h) {
      if (handlerError) toast({ title: "Could not load handler profile", description: handlerError.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setHandler(h);

    const [t, s, e] = await Promise.all([
      supabase.from("handler_tasks").select("*").eq("handler_id", h.id).order("created_at", { ascending: false }),
      supabase.from("work_sessions").select("*").eq("handler_id", h.id).is("clock_out", null).order("clock_in", { ascending: false }).limit(1),
      supabase.from("task_evidence").select("task_id,evidence_type").eq("handler_id", h.id),
    ]);

    if (version !== fetchVersion.current || userId !== currentUserId.current) return;
    if (t.error || s.error || e.error) {
      const messages = [t.error, s.error, e.error].filter(Boolean).map((error) => error?.message);
      toast({ title: "Some handler records could not be loaded", description: messages.join("; "), variant: "destructive" });
    }
    setTasks(t.data || []);
    setEvidenceCounts((e.data || []).reduce((counts: Record<string, number>, item: { task_id: string; evidence_type: string }) => { if (item.evidence_type === "photo" || item.evidence_type === "video") counts[item.task_id] = (counts[item.task_id] || 0) + 1; return counts; }, {}));
    setActiveSession(s.data?.[0] || null);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void fetchData();
    return () => { fetchVersion.current += 1; };
  }, [fetchData]);

  const clockIn = async () => {
    if (!handler || !user?.id || user.id !== currentUserId.current) return;
    setClockingIn(true);
    const gps = await getGPS();
    if (user.id !== currentUserId.current) { setClockingIn(false); return; }
    const { data: existing, error: lookupError } = await supabase.from("work_sessions").select("id")
      .eq("handler_id", handler.id).is("clock_out", null).limit(1).maybeSingle();
    if (lookupError) {
      toast({ title: "Could not verify attendance state", description: lookupError.message, variant: "destructive" });
      setClockingIn(false);
      return;
    }
    if (existing) {
      toast({ title: "Already clocked in", description: "An active work session already exists." });
      await fetchData();
      setClockingIn(false);
      return;
    }
    const { error } = await supabase.from("work_sessions").insert({
      handler_id: handler.id,
      gps_lat: gps?.lat ?? null,
      gps_lon: gps?.lon ?? null,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Clocked In!", description: "Your work session has started." });
    setClockingIn(false);
    fetchData();
  };

  const clockOut = async () => {
    if (!activeSession || !handler || !user?.id || user.id !== currentUserId.current) return;
    setClockingIn(true);
    const { data, error } = await supabase.from("work_sessions").update({ clock_out: new Date().toISOString() })
      .eq("id", activeSession.id).eq("handler_id", handler.id).is("clock_out", null).select("id").maybeSingle();
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else if (!data) toast({ title: "Session already closed", description: "Refresh your workspace to see the latest session." });
    else toast({ title: "Clocked Out!", description: "Session ended." });
    setClockingIn(false);
    fetchData();
  };

  const completeTask = async (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || !handler || !user?.id || user.id !== currentUserId.current || !["pending", "in_progress"].includes(task.status)) return;
    if (completionQty.trim()) {
      const completed = Number(completionQty);
      if (!Number.isFinite(completed) || completed < 0) {
        toast({ title: "Invalid completed quantity", description: "Enter a valid non-negative number.", variant: "destructive" });
        return;
      }
    }
    if (task.evidence_required && (evidenceCounts[taskId] || 0) < 1) {
      toast({ title: "Evidence required", description: "Upload at least one photo or video before completing this task.", variant: "destructive" });
      return;
    }

    if (completionNotes.trim()) {
      const gps = await getGPS();
      const { error: evidenceError } = await supabase.from("task_evidence").insert({
        task_id: taskId,
        handler_id: handler.id,
        evidence_type: "notes",
        notes: completionNotes.trim(),
        gps_lat: gps?.lat ?? null,
        gps_lon: gps?.lon ?? null,
      });
      if (evidenceError) {
        toast({ title: "Could not save completion notes", description: evidenceError.message, variant: "destructive" });
        return;
      }
    }

    const { data: updatedTask, error } = await supabase.from("handler_tasks").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      quantity_completed: completionQty ? Number(completionQty) : null,
    }).eq("id", taskId).eq("handler_id", handler.id).in("status", ["pending", "in_progress"]).select("id").maybeSingle();

    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else if (!updatedTask) toast({ title: "Task could not be completed", description: "It may have been reassigned or completed already. Refresh and try again.", variant: "destructive" });
    else {
      toast({ title: "Task completed!" });
      setCompletingTask(null);
      setCompletionNotes("");
      setCompletionQty("");
      fetchData();
    }
  };

  const reportIssue = async () => {
    if (!handler || !user?.id || user.id !== currentUserId.current) return;
    setReportingIssue(true);
    const gps = await getGPS();
    const { error } = await supabase.from("handler_issues").insert({
      handler_id: handler.id,
      farmer_id: handler.farmer_id,
      issue_type: issueType,
      description: issueDesc || null,
      gps_lat: gps?.lat ?? null,
      gps_lon: gps?.lon ?? null,
    });
    if (error) {
      toast({ title: "Could not report issue", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Issue reported!", description: "Your farmer has been notified." });
      setShowIssue(false);
      setIssueDesc("");
    }
    setReportingIssue(false);
  };

  const uploadEvidence = async (taskId: string, file: File) => {
    if (!handler || !user?.id || user.id !== currentUserId.current) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast({ title: "Unsupported file", description: "Upload a photo or video.", variant: "destructive" });
      return;
    }
    const maxBytes = file.type.startsWith("video/") ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast({ title: "File is too large", description: file.type.startsWith("video/") ? "Videos must be 100 MB or smaller." : "Photos must be 20 MB or smaller.", variant: "destructive" });
      return;
    }
    setUploadingTaskId(taskId);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "evidence";
    const path = `${handler.id}/${taskId}/${crypto.randomUUID()}_${safeName}`;
    try {
      const { error: uploadError } = await supabase.storage.from("handler-evidence").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      if (user.id !== currentUserId.current) {
        await supabase.storage.from("handler-evidence").remove([path]);
        throw new Error("Your account changed during upload. Sign in again before retrying.");
      }
      const { data: urlData } = supabase.storage.from("handler-evidence").getPublicUrl(path);
      const gps = await getGPS();
      const { error: recordError } = await supabase.from("task_evidence").insert({
        task_id: taskId,
        handler_id: handler.id,
        evidence_type: file.type.startsWith("video") ? "video" : "photo",
        file_url: urlData.publicUrl,
        gps_lat: gps?.lat ?? null,
        gps_lon: gps?.lon ?? null,
        device_id: null,
      });
      if (recordError) {
        await supabase.storage.from("handler-evidence").remove([path]);
        throw recordError;
      }
      setEvidenceCounts((current) => ({ ...current, [taskId]: (current[taskId] || 0) + 1 }));
      toast({ title: "Evidence uploaded!" });
    } catch (error) {
      toast({ title: "Evidence upload failed", description: error instanceof Error ? error.message : "Could not save evidence.", variant: "destructive" });
    } finally {
      setUploadingTaskId(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!handler) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <p className="text-muted-foreground">Your handler account is being set up. Please contact your farmer.</p>
        <Button variant="ghost" onClick={signOut} className="mt-4"><LogOut className="h-4 w-4 mr-2" /> Sign Out</Button>
      </div>
    );
  }

  const pendingTasks = tasks.filter(t => t.status === "pending" || t.status === "in_progress");
  const completedTasks = tasks.filter(t => t.status === "completed");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={agyenkwaIcon} alt="AgroClimate" className="h-7 w-7 rounded-lg" />
          <div>
            <span className="font-bold text-sm">AgroClimate</span>
            <p className="text-[10px] text-muted-foreground leading-none">Handler Workspace</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs capitalize">{handler.handler_type}</Badge>
          <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      <main className="p-4 space-y-4 max-w-2xl mx-auto pb-20">
        {/* Welcome */}
        <Card>
          <CardContent className="pt-4">
            <h2 className="text-lg font-bold">Welcome, {handler.handler_name}</h2>
            <p className="text-sm text-muted-foreground">{handler.assigned_farm ? `Farm: ${handler.assigned_farm}` : "No farm assigned"}</p>
          </CardContent>
        </Card>

        {/* Clock In/Out */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            className="h-20 flex-col gap-1"
            disabled={!!activeSession || clockingIn}
            onClick={clockIn}
          >
            {clockingIn ? <Loader2 className="h-6 w-6 animate-spin" /> : <Clock className="h-6 w-6" />}
            <span className="text-xs">Clock In</span>
          </Button>
          <Button
            size="lg"
            variant={activeSession ? "destructive" : "outline"}
            className="h-20 flex-col gap-1"
            disabled={!activeSession || clockingIn}
            onClick={clockOut}
          >
            {clockingIn ? <Loader2 className="h-6 w-6 animate-spin" /> : <Clock className="h-6 w-6" />}
            <span className="text-xs">Clock Out</span>
          </Button>
        </div>

        {/* Live dashboard: hours, completed tasks, open issues, GPS */}
        <HandlerDashboard handlerId={handler.id} activeSession={activeSession} tasks={tasks} />

        {activeSession && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-3 text-sm">
              <p className="font-medium text-primary">Active Session</p>
              <p className="text-xs text-muted-foreground">Started: {format(new Date(activeSession.clock_in), "HH:mm, dd MMM")}</p>
            </CardContent>
          </Card>
        )}

        {/* Today's Tasks */}
        <div>
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Today's Tasks ({pendingTasks.length})</h3>
          {pendingTasks.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No pending tasks</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {pendingTasks.map(t => (
                <Card key={t.id}>
                  <CardContent className="pt-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-sm">{t.title}</h4>
                        {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                        <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                          {t.field_location && <span><MapPin className="h-3 w-3 inline" /> {t.field_location}</span>}
                          {t.deadline && <span>Due: {format(new Date(t.deadline), "dd MMM HH:mm")}</span>}
                          {t.quantity_label && <span>{t.quantity_expected} {t.quantity_label}</span>}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">📷 {t.evidence_required ? `Required · ${evidenceCounts[t.id] || 0} uploaded` : `Optional · ${evidenceCounts[t.id] || 0} uploaded`}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <label className="cursor-pointer">
                          <input type="file" accept="image/*,video/*" capture="environment" className="hidden" disabled={uploadingTaskId === t.id} onChange={e => { if (e.target.files?.[0]) void uploadEvidence(t.id, e.target.files[0]); e.currentTarget.value = ""; }} />
                          <Button size="sm" variant="outline" asChild disabled={uploadingTaskId === t.id}><span><Camera className="h-3 w-3 mr-1" /> {uploadingTaskId === t.id ? "Uploading…" : "Upload"}</span></Button>
                      </label>
                      {completingTask === t.id ? (
                        <div className="flex-1 space-y-2">
                          {t.quantity_label && <Input type="number" placeholder={`${t.quantity_label} completed`} value={completionQty} onChange={e => setCompletionQty(e.target.value)} />}
                          <Textarea placeholder="Notes (optional)" value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} rows={2} />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => void completeTask(t.id)} disabled={uploadingTaskId === t.id || (t.evidence_required && (evidenceCounts[t.id] || 0) < 1)}><CheckCircle2 className="h-3 w-3 mr-1" /> Submit</Button>
                            <Button size="sm" variant="ghost" onClick={() => setCompletingTask(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <Button size="sm" onClick={() => setCompletingTask(t.id)}><CheckCircle2 className="h-3 w-3 mr-1" /> Complete</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm mb-2 text-green-600">✓ Completed ({completedTasks.length})</h3>
            <div className="space-y-2">
              {completedTasks.slice(0, 5).map(t => (
                <Card key={t.id} className="opacity-70">
                  <CardContent className="pt-3 text-sm">
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.completed_at ? format(new Date(t.completed_at), "dd MMM HH:mm") : ""}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Report Issue */}
        <Dialog open={showIssue} onOpenChange={setShowIssue}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full"><AlertTriangle className="h-4 w-4 mr-2" /> Report Issue</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Report Farm Issue</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Issue Type</Label>
                <Select value={issueType} onValueChange={setIssueType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pest_outbreak">Pest Outbreak</SelectItem>
                    <SelectItem value="crop_disease">Crop Disease</SelectItem>
                    <SelectItem value="irrigation_failure">Irrigation Failure</SelectItem>
                    <SelectItem value="livestock_sickness">Livestock Sickness</SelectItem>
                    <SelectItem value="flooding">Flooding</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Description</Label><Textarea value={issueDesc} onChange={e => setIssueDesc(e.target.value)} placeholder="Describe the issue..." /></div>
              <Button onClick={reportIssue} disabled={reportingIssue} className="w-full">
                {reportingIssue ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <AlertTriangle className="h-4 w-4 mr-1" />} Submit Report
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
