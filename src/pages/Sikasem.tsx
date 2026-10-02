import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CreditCard, Smartphone, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { PLANS, PlanId } from "@/lib/subscriptions/plans";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Method = "card" | "momo";

/** Sikasem — the single payment-method selector for AgroClimate plans. */
export default function Sikasem() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const planId = (params.get("plan") || "pro") as PlanId;
  const returnPath = params.get("return") || "/dashboard";
  const plan = PLANS.find((p) => p.id === planId && p.priceUsd > 0);
  const [method, setMethod] = useState<Method>("card");
  const [busy, setBusy] = useState(false);

  if (!plan) {
    navigate("/subscription", { replace: true });
    return null;
  }

  const pay = async () => {
    setBusy(true);
    try {
      const fn = method === "card" ? "stripe-checkout" : "paystack-init";
      const { data, error } = await supabase.functions.invoke(fn, { body: { plan: plan.id, return_path: returnPath } });
      if (error) {
        const ctx: any = (error as any).context;
        const details = ctx?.json ? (await ctx.json().catch(() => null))?.error : null;
        throw new Error(details || error.message);
      }
      const url = data?.url || data?.authorization_url;
      if (!url) throw new Error(data?.error || "Payment could not start.");
      window.location.href = url;
    } catch (e: any) {
      toast({ title: "Payment unavailable", description: e?.message, variant: "destructive" });
      setBusy(false);
    }
  };

  const options: { id: Method; title: string; desc: string; Icon: typeof CreditCard }[] = [
    { id: "card", title: "Card", desc: "Visa, Mastercard and more. Shown in your local currency where supported.", Icon: CreditCard },
    { id: "momo", title: "Mobile Money", desc: "MTN, Telecel, AirtelTigo, M-Pesa and other wallets.", Icon: Smartphone },
  ];

  return (
    <div className="max-w-md mx-auto p-4 lg:p-8">
      <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground flex items-center gap-1 mb-4 hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="bg-card border rounded-xl p-6 shadow-sm space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Sikasem</p>
          <h1 className="text-xl font-bold mt-1">Choose how to pay</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {plan.name} plan · <span className="font-semibold text-foreground">${plan.priceUsd} USD</span> / month
          </p>
        </div>
        <div role="radiogroup" className="space-y-3">
          {options.map(({ id, title, desc, Icon }) => (
            <button
              key={id}
              role="radio"
              aria-checked={method === id}
              onClick={() => setMethod(id)}
              className={cn(
                "w-full text-left flex gap-3 items-start rounded-lg border p-4 transition-colors",
                method === id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
              )}
            >
              <Icon className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </button>
          ))}
        </div>
        <Button className="w-full" onClick={pay} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue to secure payment"}
        </Button>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" /> Access is activated only after your payment is confirmed.
        </p>
      </div>
    </div>
  );
}
