import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, CheckCircle, XCircle, Send, Globe, Mail, Building2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OpenInSatelliteButton } from "@/components/satellite/OpenInSatelliteButton";

interface BuyerRow {
  id: string;
  company_name: string;
  country: string;
  region: string | null;
  website: string | null;
  public_contact_channel: string | null;
  public_email: string | null;
  product_interest: string;
  source: string;
  relevance_score: number;
  status: "admin_review" | "approved" | "rejected" | "outreach_sent";
  outreach_draft: string | null;
  discovered_at: string;
}

export function PotentialBuyersPanel() {
  const [buyers, setBuyers] = useState<BuyerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBuyer, setSelectedBuyer] = useState<BuyerRow | null>(null);
  const [outreachDraft, setOutreachDraft] = useState("");
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadBuyers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("potential_buyers" as any)
      .select("*")
      .order("relevance_score", { ascending: false });

    setBuyers((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadBuyers();
  }, []);

  const updateStatus = async (id: string, status: BuyerRow["status"]) => {
    const { error } = await supabase
      .from("potential_buyers" as any)
      .update({ status })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success(`Buyer status set to ${status.replace("_", " ")}`);
      loadBuyers();
    }
  };

  const handleOpenDraft = (buyer: BuyerRow) => {
    setSelectedBuyer(buyer);
    setOutreachDraft(
      buyer.outreach_draft ||
        `Dear Sourcing Team at ${buyer.company_name},\n\nWe identified your public procurement requirements for ${buyer.product_interest}.\nAgroClimate connects verified agricultural producers with international market channels.\n\nBest regards,\nAgroClimate Sourcing Desk`
    );
  };

  const handleSendOutreach = async () => {
    if (!selectedBuyer) return;
    await updateStatus(selectedBuyer.id, "outreach_sent");
    toast.success(`Outreach draft recorded and approved for ${selectedBuyer.company_name}`);
    setSelectedBuyer(null);
  };

  const filtered = buyers.filter((b) => {
    const matchText =
      b.company_name.toLowerCase().includes(filterText.toLowerCase()) ||
      b.country.toLowerCase().includes(filterText.toLowerCase()) ||
      b.product_interest.toLowerCase().includes(filterText.toLowerCase());
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    return matchText;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Potential Buyer Discovery &amp; Outreach Queue
          </h2>
          <p className="text-xs text-muted-foreground">
            Early-stage buyer discovery with human-reviewed outreach drafts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search company, country or product..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="pl-8 h-9 text-xs w-[220px]"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((b) => (
          <Card key={b.id} className="border border-border/80 hover:border-primary/40 transition-colors shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">{b.company_name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{b.country} {b.region ? `· ${b.region}` : ""}</p>
                </div>
                <Badge
                  variant={
                    b.status === "approved"
                      ? "default"
                      : b.status === "outreach_sent"
                      ? "secondary"
                      : b.status === "rejected"
                      ? "destructive"
                      : "outline"
                  }
                  className="text-[10px] capitalize"
                >
                  {b.status.replace("_", " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="bg-muted/30 p-2.5 rounded-lg space-y-1">
                <p className="font-semibold text-foreground">Interest: {b.product_interest}</p>
                <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                  <Globe className="h-3 w-3" /> <span>{b.website || "Public Directory Listing"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                  <Mail className="h-3 w-3" /> <span>{b.public_email || b.public_contact_channel || "Desk Contact"}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Relevance Score:</span>
                <span className="font-bold text-primary">{b.relevance_score}/100</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <OpenInSatelliteButton
                  query={`${b.region ? `${b.region}, ` : ""}${b.country}`}
                  label={`Buyer regional listing · ${b.company_name}`}
                  zoom={9}
                >
                  Map broad region
                </OpenInSatelliteButton>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs gap-1"
                  onClick={() => handleOpenDraft(b)}
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Review Outreach
                </Button>
                {b.status === "admin_review" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                    onClick={() => updateStatus(b.id, "approved")}
                    title="Approve"
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && !loading && (
          <div className="col-span-full p-8 text-center bg-card rounded-xl border border-dashed text-muted-foreground">
            No potential buyers found matching filters.
          </div>
        )}
      </div>

      {/* Outreach Draft Dialog */}
      <Dialog open={!!selectedBuyer} onOpenChange={(open) => !open && setSelectedBuyer(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Human-Reviewed Outreach Draft
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">
              Recipient: <strong className="text-foreground">{selectedBuyer?.company_name}</strong> ({selectedBuyer?.country})
            </p>
            <Textarea
              rows={6}
              value={outreachDraft}
              onChange={(e) => setOutreachDraft(e.target.value)}
              className="text-xs font-mono"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedBuyer(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSendOutreach} className="gap-1">
                <Send className="h-3.5 w-3.5" /> Approve &amp; Log Outreach
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
