import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CreditCard, DollarSign, Users, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Subscriber {
  id: string;
  name: string;
  email: string;
  plan: string;
  amount: number;
  currency: string;
  status: "active" | "expired" | "cancelled";
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

  const [subscribers] = useState<Subscriber[]>([
    { id: "s1", name: "Kwame Asante", email: "kwame@farm.gh", plan: "Pro", amount: 29.99, currency: "USD", status: "active", paymentMethod: "Stripe", subscribedAt: "2026-03-01" },
    { id: "s2", name: "Ama Mensah", email: "ama@agri.gh", plan: "Basic", amount: 9.99, currency: "USD", status: "active", paymentMethod: "Paystack", subscribedAt: "2026-02-15" },
    { id: "s3", name: "Kofi Boateng", email: "kofi@harvest.gh", plan: "Pro", amount: 29.99, currency: "USD", status: "expired", paymentMethod: "Stripe", subscribedAt: "2025-12-01" },
  ]);

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
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">Subscription Management</h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{subscribers.length}</p><p className="text-xs text-muted-foreground">Total Subscribers</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{activeCount}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p><p className="text-xs text-muted-foreground">Monthly Revenue</p></CardContent></Card>
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

      {/* Subscribers List */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Subscribers</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {subscribers.map(sub => (
            <div key={sub.id} className="p-3 border rounded-lg flex justify-between items-center flex-wrap gap-2">
              <div>
                <p className="font-medium text-sm">{sub.name}</p>
                <p className="text-xs text-muted-foreground">{sub.email}</p>
                <p className="text-xs text-muted-foreground">{sub.plan} · ${sub.amount} · {sub.paymentMethod} · Since {sub.subscribedAt}</p>
              </div>
              <Badge variant={statusColor(sub.status) as any}>{sub.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
