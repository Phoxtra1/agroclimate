import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PLANS, PlanId } from "@/lib/subscriptions/plans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft, Loader2 } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Subscription() {
  const [params] = useSearchParams();
  const returnPath = params.get("return") || "/dashboard";
  const { subscription } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null);

  const startCheckout = (plan: PlanId) => {
    if (plan === "freemium") { navigate(returnPath); return; }
    if (!user) { toast({ title: "Please sign in first", variant: "destructive" }); return; }
    setBusyPlan(plan);
    navigate(`/subscription/pay?plan=${plan}&return=${encodeURIComponent(returnPath)}`);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 h-auto px-0 text-sm text-muted-foreground hover:bg-transparent hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold">Choose your AgroClimate plan</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Prices in USD. Paystack will charge in your local currency automatically.
        </p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = subscription?.plan === plan.id;
          return (
            <Card key={plan.id} className={isCurrent ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {isCurrent && <Badge>Current</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{plan.tagline}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-3xl font-bold">${plan.priceUsd}</span>
                  <span className="text-xs text-muted-foreground">{plan.priceUsd > 0 ? "/month" : ""}</span>
                </div>
                <ul className="space-y-1.5 text-sm">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  disabled={isCurrent || busyPlan === plan.id}
                  variant={plan.id === "freemium" ? "outline" : "default"}
                  onClick={() => startCheckout(plan.id)}
                >
                  {busyPlan === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isCurrent ? "Current plan" : plan.priceUsd === 0 ? "Continue free" : "Proceed to Pay"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-8">
        Buyers and transport partners are pay-as-you-go — no subscription required; charges apply per order or trip.
      </p>
    </div>
  );
}
