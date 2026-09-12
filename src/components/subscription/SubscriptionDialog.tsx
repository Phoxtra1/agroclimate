import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CloudRain, Lock, Sprout } from "lucide-react";
import premiumClimateAccess from "@/assets/premium-climate-access.jpg";

interface Props {
  open: boolean;
  onCancel: () => void;
  redirectPath: string; // where to return after successful subscription
  componentLabel?: string;
}

/**
 * One reusable dialog used for every premium component.
 * "Cancel" closes; "Subscribe" routes to the central Subscription page.
 */
export function SubscriptionDialog({ open, onCancel, redirectPath, componentLabel }: Props) {
  const navigate = useNavigate();
  const goSubscribe = () => {
    navigate(`/subscription?return=${encodeURIComponent(redirectPath)}`);
  };
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <div className="relative h-36 overflow-hidden border-b border-border">
          <img src={premiumClimateAccess} alt="Climate monitoring across cultivated fields" width={1200} height={720} className="h-full w-full object-cover object-right" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />
        </div>
        <div className="p-6 pt-5">
        <DialogHeader>
          <div className="mx-auto mb-2 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="text-center">Unlock premium intelligence</DialogTitle>
          <DialogDescription className="text-center">
            Upgrade to access {componentLabel ? <span className="font-medium text-foreground">{componentLabel}</span> : "this component"} and turn climate data into clearer farm decisions.
          </DialogDescription>
        </DialogHeader>
        <div className="my-5 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-2 rounded-md border border-border p-3"><CloudRain className="h-4 w-4 text-primary" /> Climate insights</span>
          <span className="flex items-center gap-2 rounded-md border border-border p-3"><Sprout className="h-4 w-4 text-primary" /> Agro guidance</span>
        </div>
        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="outline" onClick={onCancel}>Not now</Button>
          <Button onClick={goSubscribe} className="gap-2">View plans <ArrowRight className="h-4 w-4" /></Button>
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
