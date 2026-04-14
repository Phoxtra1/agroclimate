import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Bot, UploadCloud, Play, PauseCircle, Trash2, Key, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Dataset {
  id: string;
  name: string;
  records: number;
  uploadedAt: string;
}

interface TrainingJob {
  id: string;
  model: string;
  dataset: string;
  status: "idle" | "running" | "paused" | "completed" | "failed";
  progress: number;
  startedAt?: string;
}

export default function AIEngine() {
  const { toast } = useToast();
  const [datasets, setDatasets] = useState<Dataset[]>([
    { id: "d1", name: "FarmerBehavior_v1.csv", records: 1200, uploadedAt: "2026-02-28" },
    { id: "d2", name: "CropHealth_v2.csv", records: 5000, uploadedAt: "2026-03-01" },
  ]);
  const [jobs, setJobs] = useState<TrainingJob[]>([
    { id: "j1", model: "Odeneho-Core-v1", dataset: "FarmerBehavior_v1.csv", status: "running", progress: 45, startedAt: "2026-03-02" },
    { id: "j2", model: "Odeneho-Predictor-v1", dataset: "CropHealth_v2.csv", status: "completed", progress: 100, startedAt: "2026-03-01" },
  ]);
  const [newDataset, setNewDataset] = useState({ name: "", records: 0 });

  // AI API configuration
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiApiEndpoint, setAiApiEndpoint] = useState("");
  const [aiApiActive, setAiApiActive] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(
    "You are Odeneho, an AI assistant for AgroClimate. Help farmers with crop management, weather interpretation, livestock care, and agricultural best practices."
  );

  const uploadDataset = () => {
    if (!newDataset.name || newDataset.records <= 0) return;
    setDatasets(prev => [...prev, {
      id: `d${prev.length + 1}`,
      name: newDataset.name,
      records: newDataset.records,
      uploadedAt: new Date().toISOString().slice(0, 10),
    }]);
    setNewDataset({ name: "", records: 0 });
    toast({ title: "Dataset uploaded" });
  };

  const startJob = (jobId: string) => setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "running" } : j));
  const pauseJob = (jobId: string) => setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "paused" } : j));
  const removeJob = (jobId: string) => setJobs(prev => prev.filter(j => j.id !== jobId));

  const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    if (status === "running") return "default";
    if (status === "paused") return "secondary";
    if (status === "failed") return "destructive";
    return "outline";
  };

  const saveApiConfig = () => {
    toast({ title: "AI API configuration saved", description: "Odeneho AI on user dashboard will use this configuration." });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">Odeneho AI Engine</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Manage datasets, training jobs, and API configuration for the Odeneho AI assistant. Changes here synchronize to the user dashboard.
      </p>

      {/* AI API Configuration */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4" /> AI API Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Enable External AI API</Label>
            <Switch checked={aiApiActive} onCheckedChange={setAiApiActive} />
          </div>
          {aiApiActive && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">API Endpoint</Label>
                <Input placeholder="https://api.openai.com/v1/chat/completions" value={aiApiEndpoint} onChange={e => setAiApiEndpoint(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">API Key</Label>
                <Input type="password" placeholder="sk-..." value={aiApiKey} onChange={e => setAiApiKey(e.target.value)} />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label className="text-xs">System Prompt</Label>
            <Textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={4} />
          </div>
          <Button onClick={saveApiConfig}><Zap className="mr-2 h-4 w-4" /> Save Configuration</Button>
        </CardContent>
      </Card>

      {/* Dataset Management */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dataset Management</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="Dataset name" value={newDataset.name} onChange={e => setNewDataset({ ...newDataset, name: e.target.value })} />
            <Input type="number" placeholder="Records" value={newDataset.records || ""} onChange={e => setNewDataset({ ...newDataset, records: parseInt(e.target.value) || 0 })} className="sm:w-32" />
            <Button onClick={uploadDataset}><UploadCloud className="mr-2 h-4 w-4" /> Upload</Button>
          </div>
          <div className="space-y-2">
            {datasets.map(ds => (
              <div key={ds.id} className="flex justify-between p-3 border rounded">
                <div>
                  <p className="font-medium text-sm">{ds.name}</p>
                  <p className="text-xs text-muted-foreground">{ds.records} records · {ds.uploadedAt}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setDatasets(prev => prev.filter(d => d.id !== ds.id))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Training Jobs */}
      <Card>
        <CardHeader><CardTitle className="text-base">Training Jobs</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {jobs.map(job => (
            <div key={job.id} className="p-4 border rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <p className="font-medium text-sm">{job.model}</p>
                <Badge variant={statusVariant(job.status)}>{job.status.toUpperCase()}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Dataset: {job.dataset}</p>
              <Progress value={job.progress} />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => startJob(job.id)}><Play className="mr-1 h-3 w-3" /> Start</Button>
                <Button size="sm" variant="outline" onClick={() => pauseJob(job.id)}><PauseCircle className="mr-1 h-3 w-3" /> Pause</Button>
                <Button size="sm" variant="ghost" onClick={() => removeJob(job.id)}><Trash2 className="mr-1 h-3 w-3 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
