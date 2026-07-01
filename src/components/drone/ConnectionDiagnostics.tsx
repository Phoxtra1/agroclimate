import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Activity, Bluetooth, Wifi, Usb, Cpu, AlertCircle, CheckCircle2, Network, FileText, Download, Trash2 } from "lucide-react";
import type { ConnectionDiagnostics as Diag } from "@/lib/drone/types";
import { getConnectionEvents, clearConnectionEvents, downloadEventsCSV, logConnectionEvent, type ConnectionEvent } from "@/lib/drone/eventLog";

interface Props {
  diagnostics?: Diag;
  protocol: string;
  status: string;
}

const transportIcon = (t?: string) => {
  switch (t) {
    case "websocket": return <Network className="h-3 w-3" />;
    case "bluetooth": return <Bluetooth className="h-3 w-3" />;
    case "serial":    return <Usb className="h-3 w-3" />;
    case "aih":       return <Activity className="h-3 w-3" />;
    case "simulator": return <Cpu className="h-3 w-3" />;
    default:          return <Wifi className="h-3 w-3" />;
  }
};

const typeColor = (t: string) => {
  switch (t) {
    case "error": return "text-red-300 border-red-800 bg-red-900/30";
    case "handshake": return "text-cyan-300 border-cyan-800 bg-cyan-900/30";
    case "connect": return "text-emerald-300 border-emerald-800 bg-emerald-900/30";
    case "disconnect": return "text-slate-300 border-slate-700 bg-slate-800/40";
    case "protocol_change": return "text-amber-300 border-amber-800 bg-amber-900/30";
    default: return "text-slate-300 border-slate-700 bg-slate-800/40";
  }
};

export function ConnectionDiagnostics({ diagnostics, protocol, status }: Props) {
  const [, force] = useState(0);
  const [events, setEvents] = useState<ConnectionEvent[]>(() => getConnectionEvents({ limit: 200 }));

  useEffect(() => { const t = setInterval(() => force((n) => n + 1), 1000); return () => clearInterval(t); }, []);

  // Refresh log when log changes
  useEffect(() => {
    const refresh = () => setEvents(getConnectionEvents({ limit: 200 }));
    window.addEventListener("aih:event-log-changed", refresh);
    const poll = setInterval(refresh, 4000);
    return () => { window.removeEventListener("aih:event-log-changed", refresh); clearInterval(poll); };
  }, []);

  // Auto-derive log entries from diagnostics changes
  const prev = React.useRef<Diag | undefined>(undefined);
  useEffect(() => {
    const d = diagnostics;
    const p = prev.current;
    if (d) {
      if (d.lastError && d.lastError !== p?.lastError) {
        logConnectionEvent({ type: "error", protocol, adapter: d.transport, message: "Transport error", detail: d.lastError });
      }
      if (d.lastHandshakeAt && d.lastHandshakeAt !== p?.lastHandshakeAt) {
        logConnectionEvent({ type: "handshake", protocol, adapter: d.transport, message: `Handshake ok on ${d.transport}`, detail: d.endpoint });
      }
      if (d.transport !== p?.transport && d.transport !== "none") {
        logConnectionEvent({ type: "protocol_change", protocol, adapter: d.transport, message: `Adapter set to ${d.transport}` });
      }
    }
    prev.current = d;
  }, [diagnostics, protocol]);

  const d = diagnostics || { transport: "none" as const, framesReceived: 0, bytesReceived: 0 };
  const sinceFrame = d.lastFrameAt ? Math.round((Date.now() - d.lastFrameAt) / 1000) : null;
  const sinceHandshake = d.lastHandshakeAt ? Math.round((Date.now() - d.lastHandshakeAt) / 1000) : null;
  const live = sinceFrame !== null && sinceFrame < 5;

  const errorCount = useMemo(() => events.filter((e) => e.type === "error").length, [events]);

  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-100">
      <CardHeader className="py-3 border-b border-slate-800 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-mono uppercase tracking-widest text-slate-300 flex items-center gap-2">
          <Activity className="h-3.5 w-3.5" /> Live Connection Diagnostics
        </CardTitle>
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-cyan-300 hover:bg-slate-800 font-mono text-[10px]">
                <FileText className="h-3 w-3 mr-1" /> LOGS ({events.length})
                {errorCount > 0 && <Badge variant="outline" className="ml-1.5 border-red-800 bg-red-900/40 text-red-300 text-[9px]">{errorCount} ERR</Badge>}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-slate-950 border-slate-800 text-slate-100 w-full sm:max-w-lg overflow-hidden flex flex-col">
              <SheetHeader>
                <SheetTitle className="text-slate-100 font-mono text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Diagnostics Log Drawer
                </SheetTitle>
              </SheetHeader>
              <div className="flex items-center gap-2 py-3 border-b border-slate-800">
                <Button size="sm" variant="outline" className="border-slate-800 bg-slate-900 text-cyan-300 hover:bg-slate-800 font-mono text-[10px] h-8"
                  onClick={() => downloadEventsCSV(events)}>
                  <Download className="h-3 w-3 mr-1" /> EXPORT CSV
                </Button>
                <Button size="sm" variant="outline" className="border-slate-800 bg-slate-900 text-red-300 hover:bg-red-950/40 font-mono text-[10px] h-8"
                  onClick={() => { clearConnectionEvents(); setEvents([]); }}>
                  <Trash2 className="h-3 w-3 mr-1" /> CLEAR
                </Button>
                <span className="text-[10px] font-mono text-slate-500 ml-auto">Last {events.length} events</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 py-3 pr-1">
                {events.length === 0 && (
                  <p className="text-[11px] font-mono text-slate-500 italic">No handshakes or errors recorded yet.</p>
                )}
                {events.map((e) => (
                  <div key={e.id} className="rounded border border-slate-800 bg-slate-900 p-2 text-[10px] font-mono">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className={`uppercase text-[9px] ${typeColor(e.type)}`}>{e.type.replace("_", " ")}</Badge>
                      <span className="text-slate-500">{new Date(e.ts).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-200 mt-1 break-words">{e.message}</p>
                    {e.detail && <p className="text-slate-500 mt-0.5 break-all">{e.detail}</p>}
                    <p className="text-slate-600 mt-1 text-[9px]">
                      {[e.protocol && `proto:${e.protocol}`, e.adapter && `adapter:${e.adapter}`, e.aircraftName && `aircraft:${e.aircraftName}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>
          <Badge variant="outline" className={live ? "border-emerald-700 bg-emerald-900/30 text-emerald-300 text-[10px]" : "border-slate-700 bg-slate-900 text-slate-400 text-[10px]"}>
            {live ? "LIVE" : "IDLE"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] font-mono">
        <Row label="Protocol" value={protocol.toUpperCase()} />
        <Row label="Adapter" value={<span className="flex items-center gap-1">{transportIcon(d.transport)}{d.transport.toUpperCase()}</span>} />
        <Row label="Status" value={status.toUpperCase()} />
        <Row label="Endpoint" value={d.endpoint || "—"} truncate />
        <Row label="Handshake" value={sinceHandshake !== null ? `${sinceHandshake}s ago` : "—"} />
        <Row label="Last frame" value={sinceFrame !== null ? `${sinceFrame}s ago` : "—"} />
        <Row label="Frames" value={String(d.framesReceived)} />
        <Row label="Bytes RX" value={fmtBytes(d.bytesReceived)} />
        <div className="col-span-2 mt-1 flex items-start gap-2 px-2 py-1.5 rounded border border-slate-800 bg-slate-950">
          {d.lastError ? (
            <><AlertCircle className="h-3.5 w-3.5 text-red-400 mt-0.5" /><span className="text-red-300 break-all">{d.lastError}</span></>
          ) : (
            <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5" /><span className="text-emerald-300">No transport errors reported.</span></>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, truncate }: { label: string; value: React.ReactNode; truncate?: boolean }) {
  return (
    <div className="flex justify-between items-center gap-2 min-w-0">
      <span className="text-slate-500 uppercase text-[10px]">{label}</span>
      <span className={`text-slate-100 text-right ${truncate ? "truncate max-w-[140px]" : ""}`}>{value}</span>
    </div>
  );
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
