import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FlaskConical } from "lucide-react";
import { useTestMode } from "@/hooks/useTestMode";
import { useToast } from "@/hooks/use-toast";

/** Administrative switch for the standalone Test Mode engine. */
export default function TestModeCard() {
  const { testMode, note, updatedAt, loading, setTestMode } = useTestMode();
  const { toast } = useToast();
  const [draftNote, setDraftNote] = useState(note ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setDraftNote(note ?? ""); }, [note]);

  const toggle = async (v: boolean) => {
    setBusy(true);
    try {
      await setTestMode(v, draftNote || undefined);
      toast({
        title: v ? "Test Mode enabled" : "Test Mode disabled",
        description: v
          ? "All features unlocked platform-wide. Subscription checks are bypassed."
          : "Subscriptions and payments are now enforced.",
      });
    } catch (e: any) {
      toast({ title: "Could not update Test Mode", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async () => {
    if (!testMode) return;
    setBusy(true);
    try {
      await setTestMode(true, draftNote || undefined);
      toast({ title: "Tester message updated" });
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={testMode ? "border-warning" : ""}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" /> Test Mode
          {testMode && <Badge className="ml-2">ACTIVE</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm font-medium">Enable Test Mode</Label>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              When ON, every feature check passes instantly and no subscription is required.
              When OFF, normal tier permissions and payments are enforced.
            </p>
          </div>
          <Switch checked={testMode} disabled={loading || busy} onCheckedChange={toggle} />
        </div>

        {testMode && (
          <div className="pt-4 border-t border-dashed space-y-2">
            <Label className="text-xs">Message shown to testers</Label>
            <div className="flex gap-2">
              <Input
                value={draftNote}
                placeholder="Safety and demo overrides engaged…"
                onChange={(e) => setDraftNote(e.target.value)}
                onBlur={saveNote}
                maxLength={300}
              />
            </div>
            {updatedAt && (
              <p className="text-[10px] text-muted-foreground">
                Last changed {new Date(updatedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
