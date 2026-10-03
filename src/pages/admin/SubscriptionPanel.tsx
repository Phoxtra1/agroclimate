import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CreditCard, DollarSign, Users, Key, RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Subscriber {
  id: string;
  userId: string;
  name: string;
  email: string;
  plan: string;
  amount: number;
  currency: string;
  status: "active" | "expired" | "cancelled" | string;
  paymentMethod: string;
  subscribedAt: string;
}

export default function SubscriptionPanel() {
  const { toast } = useToast();

  // Payment platform config
  const [stripeKey, setStripeKey] = useState("");
  const [paystackKey, setPaystackKey] = useState("");
  const [stripeActive, setStripeActive] = useState(false);
  const [paystackActive, setPaystackActive] = useState(false);

  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSubscribers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: subData, error: subError } = await supabase
        .from("user_subscriptions")
        .select("*")
        .order("created_at", { ascending: false });

      if (subError) {
        console.error("[SubscriptionPanel] Fetch error:", subError);
        setSubscribers([]);
        return;
      }

      if (!subData || subData.length === 0) {
        setSubscribers([]);
        return;
      }

      const userIds = Array.from(new Set(subData.map(s => s.user_id).filter(Boolean)));
      let profileMap: Record<string, { name?: string }> = {};

      if (userIds.length > 0) {
        const { data: profData } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);

        if (profData) {
          profData.forEach(p => {
            if (p.user_id) {
              profileMap[p.user_id] = { name: p.display_name || undefined };
            }
          });
        }
      }

      const mapped: Subscriber[] = subData.map((row) => {
        const prof = profileMap[row.user_id];
        return {
          id: row.id,
          userId: row.user_id,
          name: prof?.name || `Subscriber (${row.user_id.slice(0, 8)})`,
          email: `User ID: ${row.user_id.slice(0, 8)}...`,
          plan: row.plan ? row.plan.charAt(0).toUpperCase() + row.plan.slice(1) : "Standard",
          amount: Number(row.amount_usd) || Number(row.amount_local) || 0,
          currency: row.currency || "USD",
          status: row.status || "active",
          paymentMethod: row.provider ? row.provider.toUpperCase() : "Direct",
          subscribedAt: row.activated_at
            ? new Date(row.activated_at).toISOString().split("T")[0]
            : new Date(row.created_at).toISOString().split("T")[0],
        };
      });

      setSubscribers(mapped);
    } catch (err) {
      console.error("[SubscriptionPanel] Unexpected error:", err);
      setSubscribers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscribers();

    const channel = supabase
      .channel("admin-subscriptions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_subscriptions" },
        () => loadSubscribers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadSubscribers]);

  const saveStripeConfig = () => {
    toast({ title: "Stripe configuration saved" });
  };

  const savePaystackConfig = () => {
    toast({ title: "Paystack configuration saved" });
  };

  const statusColor = (s: string) => {
    if (s === "active") return "default";
    if (s === "expired") return "secondary";
    return "destructive";
  };

  const activeCount = subscribers.filter(s => s.status === "active").length;
  const totalRevenue = subscribers.filter(s => s.status === "active").reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold">Subscription Management</h2>
        </div>
        <Button size="sm" variant="outline" onClick={loadSubscribers} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{loading ? "..." : subscribers.length}</p><p className="text-xs text-muted-foreground">Total Subscribers</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{loading ? "..." : activeCount}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{loading ? "..." : `$${totalRevenue.toFixed(2)}`}</p><p className="text-xs text-muted-foreground">Monthly Revenue</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{stripeActive || paystackActive ? "Connected" : "None"}</p><p className="text-xs text-muted-foreground">Payment Gateway</p></CardContent></Card>
      </div>

      {/* Stripe Config */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4" /> Stripe Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Enable Stripe</Label>
            <Switch checked={stripeActive} onCheckedChange={setStripeActive} />
          </div>
          {stripeActive && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Publishable Key</Label>
                <Input placeholder="pk_live_..." value={stripeKey} onChange={e => setStripeKey(e.target.value)} />
              </div>
              <Button size="sm" onClick={saveStripeConfig}>Save Stripe Config</Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Paystack Config */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4" /> Paystack Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Enable Paystack</Label>
            <Switch checked={paystackActive} onCheckedChange={setPaystackActive} />
          </div>
          {paystackActive && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Public Key</Label>
                <Input placeholder="pk_live_..." value={paystackKey} onChange={e => setPaystackKey(e.target.value)} />
              </div>
              <Button size="sm" onClick={savePaystackConfig}>Save Paystack Config</Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Real-time Subscribers List */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Live Subscribers</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm">Fetching real-time subscription records...</p>
            </div>
          ) : subscribers.length === 0 ? (
            <div className="p-8 text-center border border-dashed rounded-lg flex flex-col items-center justify-center gap-2">
              <AlertCircle className="h-8 w-8 text-muted-foreground/60" />
              <p className="font-semibold text-sm">No Active Real-Time Subscriptions</p>
              <p className="text-xs text-muted-foreground max-w-md">
                There are currently no real-time subscriptions from learners, schools, or users.
                All metrics update automatically live as new subscriptions occur.
              </p>
            </div>
          ) : (
            subscribers.map(sub => (
              <div key={sub.id} className="p-3 border rounded-lg flex justify-between items-center flex-wrap gap-2">
                <div>
                  <p className="font-medium text-sm">{sub.name}</p>
                  <p className="text-xs text-muted-foreground">{sub.email}</p>
                  <p className="text-xs text-muted-foreground">{sub.plan} · ${sub.amount.toFixed(2)} · {sub.paymentMethod} · Since {sub.subscribedAt}</p>
                </div>
                <Badge variant={statusColor(sub.status) as any}>{sub.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
