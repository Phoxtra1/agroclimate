import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Callback page hit after Paystack checkout. Verifies the reference then
 * returns the user to the exact component they came from.
 */
export default function SubscriptionVerify() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reference = params.get("reference");
  const returnPath = params.get("return") || "/dashboard";
  const [state, setState] = useState<"verifying" | "ok" | "fail">("verifying");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!reference) { setState("fail"); setMessage("Missing reference."); return; }
    (async () => {
      const { data, error } = await supabase.functions.invoke("paystack-verify", { body: { reference } });
      if (error || !data?.ok) { setState("fail"); setMessage(data?.message || error?.message || "Payment could not be verified."); return; }
      setState("ok");
      // Return user to the originating component; PremiumGate will now allow it.
      setTimeout(() => navigate(returnPath, { replace: true }), 900);
    })();
  }, [reference, returnPath, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-sm w-full rounded-lg border bg-card p-6 text-center shadow-sm space-y-3">
        {state === "verifying" && (<><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /><p className="text-sm">Verifying your payment…</p></>)}
        {state === "ok" && (<><CheckCircle className="h-8 w-8 mx-auto text-primary" /><p className="text-sm">Subscription activated. Returning you now…</p></>)}
        {state === "fail" && (
          <>
            <XCircle className="h-8 w-8 mx-auto text-destructive" />
            <p className="text-sm">{message}</p>
            <Button onClick={() => navigate("/subscription")} className="w-full">Try again</Button>
          </>
        )}
      </div>
    </div>
  );
}
