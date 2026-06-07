import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Image as ImageIcon, Video, Download, Archive, Share2, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDroneMedia } from "@/hooks/useDroneMedia";
import { useToast } from "@/hooks/use-toast";
import { CopyButton } from "@/components/CopyButton";

export function DroneMediaCenter() {
  const { items, loading, archive, remove } = useDroneMedia();
  const { toast } = useToast();

  const share = (url?: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast({ title: "Share link copied" });
  };

  if (loading) return (
    <div className="flex items-center gap-2 text-slate-400 font-mono text-xs"><Loader2 className="h-4 w-4 animate-spin" /> Loading media…</div>
  );

  if (!items.length) return (
    <div className="text-center py-10 text-slate-500 font-mono text-xs">
      No captured media yet. Take a screenshot or record from the live feed.
    </div>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((m) => (
        <Card key={m.id} className="bg-slate-900 border-slate-800 text-slate-100 overflow-hidden group">
          <div className="h-32 bg-black flex items-center justify-center relative overflow-hidden">
            {m.media_type === "image" && m.signedUrl ? (
              <img src={m.signedUrl} className="w-full h-full object-cover" />
            ) : m.media_type === "video" ? (
              <Video className="h-8 w-8 text-slate-700" />
            ) : (
              <ImageIcon className="h-8 w-8 text-slate-700" />
            )}
            {m.archived && <Badge variant="outline" className="absolute top-1 right-1 text-[9px] bg-black/60 border-slate-700 text-slate-400">Archived</Badge>}
            <div className="absolute inset-0 bg-cyan-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              {m.signedUrl && (
                <a href={m.signedUrl} download target="_blank" rel="noreferrer">
                  <Button size="icon" variant="ghost" className="text-white hover:bg-cyan-600"><Download className="h-4 w-4" /></Button>
                </a>
              )}
              <Button size="icon" variant="ghost" className="text-white hover:bg-cyan-600" onClick={() => share(m.signedUrl)}><Share2 className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="text-white hover:bg-cyan-600" onClick={() => archive(m.id, !m.archived)}><Archive className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="text-white hover:bg-red-700" onClick={() => remove(m.id, m.storage_path)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
          <CardContent className="p-3">
            <p className="text-[10px] font-mono text-cyan-400 truncate uppercase">{m.media_type}</p>
            <div className="flex items-center justify-between gap-1 mt-0.5">
              <p className="text-[10px] font-mono text-slate-500 truncate">{new Date(m.captured_at).toLocaleString()}</p>
              <CopyButton value={m.id} className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
