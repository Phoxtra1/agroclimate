import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Bluetooth, Wifi, Usb, Cpu, AlertCircle, CheckCircle2, Network } from "lucide-react";
import type { ConnectionDiagnostics as Diag } from "@/lib/drone/types";

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

export function ConnectionDiagnostics({ diagnostics, protocol, status }: Props) {
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const d = diagnostics || { transport: "none" as const, framesReceived: 0, bytesReceived: 0 };
  const sinceFrame = d.lastFrameAt ? Math.round((Date.now() - d.lastFrameAt) / 1000) : null;
  const sinceHandshake = d.lastHandshakeAt ? Math.round((Date.now() - d.lastHandshakeAt) / 1000) : null;
  const live = sinceFrame !== null && sinceFrame < 5;

  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-100">
      <CardHeader className="py-3 border-b border-slate-800 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-mono uppercase tracking-widest text-slate-300 flex items-center gap-2">
          <Activity className="h-3.5 w-3.5" /> Live Connection Diagnostics
        </CardTitle>
        <Badge variant="outline" className={live ? "border-emerald-700 bg-emerald-900/30 text-emerald-300 text-[10px]" : "border-slate-700 bg-slate-900 text-slate-400 text-[10px]"}>
          {live ? "LIVE" : "IDLE"}
        </Badge>
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
