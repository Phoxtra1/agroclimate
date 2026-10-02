import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Return page after Stripe (card) or Paystack (Mobile Money). Reaching this
 * page grants nothing — access is activated only when the provider confirms
 * the payment server-side.
 */
export default function SubscriptionVerify() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const provider = params.get("provider") === "stripe" ? "stripe" : "paystack";
  const reference = provider === "stripe" ? params.get("session_id") : params.get("reference");
  const returnPath = params.get("return") || "/dashboard";
  const [state, setState] = useState<"verifying" | "ok" | "fail">("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!reference) { setState("fail"); setMessage("Missing payment reference."); return; }
    let cancelled = false;
    const fn = provider === "stripe" ? "stripe-verify" : "paystack-verify";
    const body = provider === "stripe" ? { session_id: reference } : { reference };
    const attempt = async (n: number) => {
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (cancelled) return;
      if (data?.ok) {
        setState("ok");
        setTimeout(() => navigate(returnPath, { replace: true }), 1200);
        return;
      }
      if (data?.pending && n < 6) { setTimeout(() => attempt(n + 1), 4000); return; }
      setState("fail");
      setMessage(data?.message || error?.message || "Payment could not be verified.");
    };
    attempt(0);
    return () => { cancelled = true; };
  }, [reference, provider, returnPath, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-sm w-full rounded-lg border bg-card p-6 text-center shadow-sm space-y-3">
        {state === "verifying" && (<><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /><p className="text-sm">Confirming your payment with the provider…</p></>)}
        {state === "ok" && (<><CheckCircle className="h-8 w-8 mx-auto text-primary" /><p className="text-sm">Payment confirmed. Your plan is active.</p></>)}
        {state === "fail" && (
          <>
            <XCircle className="h-8 w-8 mx-auto text-destructive" />
            <p className="text-sm">{message}</p>
            <Button onClick={() => navigate("/subscription")} className="w-full">Back to plans</Button>
          </>
        )}
      </div>
    </div>
  );
}
