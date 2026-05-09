import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileSignature, Truck, Calendar, Handshake, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { formatMarketPrice } from "@/lib/market";

export interface AgreementRow {
  id: string;
  negotiation_id: string;
  listing_id: string | null;
  order_id: string | null;
  buyer_id: string;
  supplier_id: string;
  buyer_name?: string | null;
  supplier_name?: string | null;
  product?: string | null;
  agreed_price: number;
  agreed_quantity: number;
  unit: string;
  delivery_terms: string | null;
  negotiation_summary?: string | null;
  agreement_status: "active" | "fulfilled" | "cancelled";
  created_at: string;
}

export default function Agreement({ role = "both" }: { role?: "buyer" | "supplier" | "both" }) {
  const { user } = useAuth();
  const [items, setItems] = useState<AgreementRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) { setItems([]); setLoading(false); return; }
    setLoading(true);
    let query = supabase.from("agreements" as any).select("*").order("created_at", { ascending: false }).limit(100);
    if (role === "buyer")        query = (query as any).eq("buyer_id", user.id);
    else if (role === "supplier")query = (query as any).eq("supplier_id", user.id);
    else                         query = (query as any).or(`buyer_id.eq.${user.id},supplier_id.eq.${user.id}`);
    const { data } = await query;
    setItems(((data as any) || []) as AgreementRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`agreements-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "agreements" }, load)
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, role]);

  const empty = useMemo(() => !loading && items.length === 0, [loading, items]);

  if (!user) return <p className="text-sm text-muted-foreground py-6 text-center">Sign in to view agreements.</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileSignature className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Agreements</h3>
        <Badge variant="outline">{items.length}</Badge>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-6 text-center"><Loader2 className="h-4 w-4 inline animate-spin mr-1" />Loading agreements…</p>
      ) : empty ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No agreements yet — accept a negotiation to generate one.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((a) => {
            const mineAsBuyer = a.buyer_id === user.id;
            return (
              <Card key={a.id} className="hover:shadow-md transition">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="truncate">{a.product || "Agreement"}</span>
                    <Badge variant={a.agreement_status === "active" ? "default" : a.agreement_status === "fulfilled" ? "secondary" : "destructive"}>
                      {a.agreement_status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <Row label="Quantity" value={`${Number(a.agreed_quantity).toLocaleString()} ${a.unit}`} />
                  <Row label="Agreed price" value={formatMarketPrice(a.agreed_price, a.unit, null)} />
                  <Row label={mineAsBuyer ? "Supplier" : "Buyer"} value={(mineAsBuyer ? a.supplier_name : a.buyer_name) || "—"} />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />{new Date(a.created_at).toLocaleDateString()}
                  </div>
                  {a.delivery_terms && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Truck className="h-3 w-3" />{a.delivery_terms}
                    </div>
                  )}
                  {a.negotiation_summary && (
                    <p className="text-xs text-muted-foreground border-t pt-1.5 line-clamp-3">
                      <Handshake className="h-3 w-3 inline mr-1" />{a.negotiation_summary}
                    </p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Link to={`/dashboard/contracts?agreement=${a.id}`} className="flex-1">
                      <Button size="sm" className="w-full"><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Open contract</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  );
}
