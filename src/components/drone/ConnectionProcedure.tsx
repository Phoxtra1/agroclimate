import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Info, Link2, Save } from "lucide-react";
import { getBridgeUrl, setBridgeUrl } from "@/lib/drone/realAdapter";
import { useToast } from "@/hooks/use-toast";

export function ConnectionProcedure() {
  const [url, setUrl] = useState(getBridgeUrl());
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const save = () => {
    setBridgeUrl(url.trim());
    toast({ title: url ? "Bridge URL saved" : "Bridge cleared", description: url ? "Click SCAN, then Connect to go live." : "Switched back to BLE / Serial discovery." });
  };

  const support = {
    bluetooth: typeof navigator !== "undefined" && !!(navigator as any).bluetooth,
    serial:    typeof navigator !== "undefined" && !!(navigator as any).serial,
    secure:    typeof window !== "undefined" && window.isSecureContext,
  };

  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-100">
      <CardContent className="p-3 space-y-3">
        <button onClick={() => setOpen((o) => !o)} className="w-full text-left flex items-center justify-between text-[11px] font-mono uppercase tracking-widest text-slate-300">
          <span className="flex items-center gap-2"><Info className="h-3 w-3 text-cyan-400" /> Live Connection Procedure</span>
          <span className="text-cyan-400">{open ? "HIDE" : "SHOW"}</span>
        </button>

        {open && (
          <div className="space-y-3 text-[11px] font-mono text-slate-400 leading-relaxed">
            <ol className="list-decimal list-inside space-y-1 text-slate-300">
              <li>Pick a transport: <b>Bridge URL</b> (recommended), Web Bluetooth, or USB Serial.</li>
              <li>For a bridge, run any WS gateway (e.g. <code className="text-cyan-300">mavlink-router → mavlink2ws</code>, <code className="text-cyan-300">tello-ws</code>, <code className="text-cyan-300">dji-bridge</code>) on the same network and paste the URL below.</li>
              <li>Hit <b>SCAN</b> in the panel above, select the device, then <b>Connect</b>. Telemetry frames must be JSON like <code className="text-cyan-300">{`{"lat":..,"lng":..,"altitude":..,"battery":..}`}</code>.</li>
              <li>Power-on drone &amp; controller, ensure Wi-Fi/Bluetooth pairing, then arm + launch from the Flight Ops panel.</li>
            </ol>

            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className={support.secure ? "border-emerald-700 text-emerald-300" : "border-red-700 text-red-300"}>HTTPS {support.secure ? "OK" : "REQUIRED"}</Badge>
              <Badge variant="outline" className={support.bluetooth ? "border-emerald-700 text-emerald-300" : "border-slate-700 text-slate-500"}>Web Bluetooth {support.bluetooth ? "OK" : "N/A"}</Badge>
              <Badge variant="outline" className={support.serial ? "border-emerald-700 text-emerald-300" : "border-slate-700 text-slate-500"}>Web Serial {support.serial ? "OK" : "N/A"}</Badge>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] uppercase text-slate-500"><Link2 className="h-3 w-3" /> Bridge URL (ws:// or wss://)</label>
              <div className="flex gap-2">
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="ws://192.168.1.10:14550" className="bg-slate-950 border-slate-800 text-slate-200 font-mono h-8 text-xs" />
                <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white h-8" onClick={save}><Save className="h-3 w-3 mr-1" />Save</Button>
              </div>
              <p className="text-[10px] text-slate-500">Saved locally. Leave empty to fall back to BLE/Serial.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
