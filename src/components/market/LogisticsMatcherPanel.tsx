import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Truck, Phone, Star, ShieldCheck, Snowflake, MapPin } from "lucide-react";
import { DipaEngine, type LogisticsMatchResult } from "@/lib/dipaEngine";

export function LogisticsMatcherPanel() {
  const [pickup, setPickup] = useState("Accra / Volta");
  const [destination, setDestination] = useState("Kumasi / Northern");
  const [tons, setTons] = useState(12);
  const [coldChain, setColdChain] = useState(false);
  const [matchResult, setMatchResult] = useState<LogisticsMatchResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runMatch = async () => {
    setLoading(true);
    const res = await DipaEngine.matchLogisticsProviders(pickup, destination, tons, coldChain);
    setMatchResult(res);
    setLoading(false);
  };

  useEffect(() => {
    runMatch();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" /> Ghana &amp; Global Logistics Provider Matcher
          </h2>
          <p className="text-xs text-muted-foreground">
            Payload matching, vehicle capability scoring &amp; cold-chain options
          </p>
        </div>
      </div>

      {/* Query Bar */}
      <Card className="border border-border/80 bg-muted/20 shadow-none">
        <CardContent className="py-4 px-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs font-semibold">Pickup Location</Label>
              <Input value={pickup} onChange={(e) => setPickup(e.target.value)} className="h-9 text-xs" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Destination</Label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} className="h-9 text-xs" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Payload (Tons)</Label>
              <Input type="number" value={tons} onChange={(e) => setTons(Number(e.target.value) || 1)} className="h-9 text-xs" />
            </div>
            <div className="flex items-center justify-between gap-2 h-9 pb-1">
              <div className="flex items-center gap-1.5">
                <Switch checked={coldChain} onCheckedChange={setColdChain} id="cc-toggle" />
                <Label htmlFor="cc-toggle" className="text-xs flex items-center gap-1 cursor-pointer">
                  <Snowflake className="h-3.5 w-3.5 text-cyan-500" /> Cold-chain
                </Label>
              </div>
              <Button size="sm" onClick={runMatch} disabled={loading} className="text-xs h-9">
                Find Providers
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Matching Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {matchResult?.providers.map((p) => (
          <Card key={p.id} className="border border-border/80 hover:border-primary/40 transition-colors shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                    {p.name} <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{p.country} · {p.capacityTons} Tons Capacity</p>
                </div>
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                  {p.matchScore}% Match
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex flex-wrap gap-1">
                {p.vehicleTypes.map((v) => (
                  <Badge key={v} variant="outline" className="text-[9px] uppercase">
                    {v.replace("_", " ")}
                  </Badge>
                ))}
                {p.coldChain && (
                  <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200 text-[9px]">
                    ❄️ Cold-chain Ready
                  </Badge>
                )}
              </div>

              <div className="bg-muted/30 p-2.5 rounded-lg space-y-1 text-[11px]">
                {p.reasons.map((r, idx) => (
                  <p key={idx} className="text-muted-foreground flex items-center gap-1">
                    <span className="text-emerald-500">✓</span> {r}
                  </p>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-primary" /> {p.contactPhone}
                </span>
                <Button size="sm" variant="default" className="text-xs h-8">
                  Book Transport
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
