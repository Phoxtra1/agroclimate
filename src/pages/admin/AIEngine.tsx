import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { UploadCloud, Play, PauseCircle, RefreshCw, Trash2 } from "lucide-react";

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
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [jobs, setJobs] = useState<TrainingJob[]>([]);
  const [newDataset, setNewDataset] = useState({ name: "", records: 0 });

  // Mock initial data
  useEffect(() => {
    setDatasets([
      { id: "d1", name: "FarmerBehavior_v1.csv", records: 1200, uploadedAt: "2026-02-28" },
      { id: "d2", name: "CropHealth_v2.csv", records: 5000, uploadedAt: "2026-03-01" },
    ]);
    setJobs([
      { id: "j1", model: "Odeneho-Core-v1", dataset: "FarmerBehavior_v1.csv", status: "running", progress: 45, startedAt: "2026-03-02" },
      { id: "j2", model: "Odeneho-Predictor-v1", dataset: "CropHealth_v2.csv", status: "completed", progress: 100, startedAt: "2026-03-01" },
    ]);
  }, []);

  const uploadDataset = () => {
    if (!newDataset.name || newDataset.records <= 0) return;
    const newId = `d${datasets.length + 1}`;
    setDatasets([
      ...datasets,
      { id: newId, name: newDataset.name, records: newDataset.records, uploadedAt: new Date().toISOString().slice(0, 10) },
    ]);
    setNewDataset({ name: "", records: 0 });
  };

  const startJob = (jobId: string) => {
    setJobs((prev) => prev.map((job) => job.id === jobId ? { ...job, status: "running" } : job));
  };
  const pauseJob = (jobId: string) => {
    setJobs((prev) => prev.map((job) => job.id === jobId ? { ...job, status: "paused" } : job));
  };
  const removeJob = (jobId: string) => {
    setJobs((prev) => prev.filter((job) => job.id !== jobId));
  };

  return (
    <div className="space-y-6 p-6">

      {/* Dataset Management */}
      <Card>
        <CardHeader>
          <CardTitle>Dataset Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Dataset name"
              value={newDataset.name}
              onChange={(e) => setNewDataset({ ...newDataset, name: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Records count"
              value={newDataset.records || ""}
              onChange={(e) => setNewDataset({ ...newDataset, records: parseInt(e.target.value) })}
            />
            <Button onClick={uploadDataset}>
              <UploadCloud className="mr-2 h-4 w-4" /> Upload
            </Button>
          </div>

          <div className="space-y-2">
            {datasets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No datasets uploaded yet.</p>
            ) : (
              datasets.map((ds) => (
                <div key={ds.id} className="flex justify-between p-2 border rounded">
                  <div>
                    <p className="font-medium">{ds.name}</p>
                    <p className="text-xs text-muted-foreground">{ds.records} records • Uploaded on {ds.uploadedAt}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Training Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>AI Training Jobs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active training jobs.</p>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="p-4 border rounded space-y-2">
                <div className="flex justify-between items-center">
                  <p className="font-medium">{job.model}</p>
                  <Badge variant={job.status === "running" ? "success" : job.status === "paused" ? "secondary" : "default"}>
                    {job.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">Dataset: {job.dataset}</p>
                <Progress value={job.progress} />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => startJob(job.id)}>
                    <Play className="mr-1 h-4 w-4" /> Start
                  </Button>
                  <Button size="sm" onClick={() => pauseJob(job.id)}>
                    <PauseCircle className="mr-1 h-4 w-4" /> Pause
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => removeJob(job.id)}>
                    <Trash2 className="mr-1 h-4 w-4" /> Remove
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
