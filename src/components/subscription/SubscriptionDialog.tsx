import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";

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
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="text-center">Subscription Required</DialogTitle>
          <DialogDescription className="text-center">
            Subscribe to access {componentLabel ? <span className="font-medium text-foreground">{componentLabel}</span> : "this component"} and continue using AgroClimate.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={goSubscribe}>Subscribe</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
