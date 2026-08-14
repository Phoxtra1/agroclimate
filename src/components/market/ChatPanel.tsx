import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, LogIn, CheckCircle2, XCircle, Handshake } from "lucide-react";
import { useMarketChat, usePresence } from "@/hooks/useMarketChat";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  openNegotiation,
  setNegotiationStatus,
  acceptNegotiation,
  declineNegotiation,
  statusBadgeTone,
  type NegotiationRow,
  type NegotiationStatus,
} from "@/lib/negotiationEngine";

interface Props {
  otherUserId: string;
  otherName: string;
  /** Which party the *other* user represents. Used to assign buyer_id/supplier_id. */
  otherRole?: "buyer" | "supplier" | "driver";
  relatedSupplyId?: string;   // listing_id when negotiating a supplier listing
  relatedOrderId?: string;    // order_id  when negotiating a buyer order
  onClose?: () => void;
  /** Optional pre-fill for accept dialog */
  defaultUnit?: string;
  defaultPrice?: number;
  defaultQuantity?: number;
}

export function ChatPanel({
  otherUserId, otherName, otherRole = "supplier",
  relatedSupplyId, relatedOrderId,
  defaultUnit, defaultPrice, defaultQuantity,
}: Props) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const contextId = relatedSupplyId || relatedOrderId || null;
  const { messages, loading, send, markAllRead } = useMarketChat(otherUserId, contextId);
  const { online, refresh } = usePresence();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [negotiation, setNegotiation] = useState<NegotiationRow | null>(null);
  const [stateBusy, setStateBusy] = useState(false);

  const selfChat = !!user && user.id === otherUserId;

  // Load (or create) the negotiation thread for this pair + listing/order.
  useEffect(() => {
    if (!user) return;
    if (!relatedSupplyId && !relatedOrderId) return;
    const buyerId    = otherRole === "buyer"    ? otherUserId : user.id;
    const supplierId = otherRole === "supplier" ? otherUserId : user.id;
    openNegotiation({
      buyerId, supplierId,
      listingId: relatedSupplyId,
      orderId: relatedOrderId,
      unit: defaultUnit, agreedPrice: defaultPrice, agreedQuantity: defaultQuantity,
    })
      .then(setNegotiation)
      .catch((e) => toast.error(e?.message || "Could not open negotiation"));
  }, [user?.id, otherUserId, otherRole, relatedSupplyId, relatedOrderId, selfChat, defaultUnit, defaultPrice, defaultQuantity]);

  useEffect(() => {
    if (!otherUserId) return;
    refresh([otherUserId]);
    const t = setInterval(() => refresh([otherUserId]), 30_000);
    return () => clearInterval(t);
  }, [otherUserId, refresh]);

  useEffect(() => { if (user) markAllRead(); }, [messages.length, markAllRead, user]);

  const lastId = useMemo(() => messages[messages.length - 1]?.id ?? "", [messages]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [lastId, messages.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("Sign in to chat"); return; }
    if (selfChat) { toast.error("You can't negotiate with yourself."); return; }
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      await send(body, { related_supply_id: relatedSupplyId, related_order_id: relatedOrderId });
      setText("");
      // First message moves pending → negotiating automatically.
      if (negotiation && negotiation.status === "pending") {
        const next = await setNegotiationStatus(negotiation.id, "pending", "negotiating");
        setNegotiation(next);
      }
    } catch (err: any) { toast.error(err?.message || "Failed to send"); }
    finally { setBusy(false); }
  };

  const move = async (to: NegotiationStatus) => {
    if (!negotiation) return;
    setStateBusy(true);
    try {
      if (to === "accepted") {
        const result = await acceptNegotiation(negotiation, {
          agreedPrice:    negotiation.agreed_price    ?? defaultPrice    ?? 0,
          agreedQuantity: negotiation.agreed_quantity ?? defaultQuantity ?? 0,
          unit:           negotiation.unit            ?? defaultUnit     ?? "kg",
        });
        setNegotiation(result.negotiation);
        toast.success("Agreement generated");
      } else if (to === "declined") {
        setNegotiation(await declineNegotiation(negotiation));
        toast.info("Negotiation declined — order stays active for other suppliers.");
      } else {
        setNegotiation(await setNegotiationStatus(negotiation.id, negotiation.status, to));
      }
    } catch (err: any) { toast.error(err?.message || "Could not update negotiation"); }
    finally { setStateBusy(false); }
  };

  if (!authLoading && !user) {
    return (
      <div className="flex flex-col items-center justify-center h-[40vh] border rounded-lg bg-background p-6 text-center gap-3">
        <p className="text-sm font-medium">Sign in to chat with {otherName}</p>
        <p className="text-xs text-muted-foreground">Buyers and suppliers negotiate price, quality and delivery here, then accept to generate an agreement.</p>
        <Button size="sm" onClick={() => navigate("/marketplace/auth")}><LogIn className="h-4 w-4 mr-1" />Sign in to continue</Button>
      </div>
    );
  }



  const isOnline = !!online[otherUserId];
  const status: NegotiationStatus = negotiation?.status ?? "pending";
  const terminal = status === "accepted" || status === "declined" || status === "completed";

  return (
    <div className="flex flex-col h-[60vh] border rounded-lg bg-background">
      <div className="px-3 py-2 border-b flex items-center gap-2 flex-wrap">
        <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? "bg-green-500" : "bg-muted-foreground/40"}`} />
        <div className="text-sm font-semibold truncate flex-1">{otherName}</div>
        <Badge variant={statusBadgeTone(status)} className="capitalize">{status}</Badge>
        <div className="text-[11px] text-muted-foreground basis-full mt-1">
          {isOnline ? "User is currently Online" : "User is currently Offline · Leave a message"}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : messages.length === 0 ? null : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            const meta: any = (user as any)?.user_metadata || {};
            const myName = meta.company_name || meta.full_name || meta.name || user?.email || "You";
            const senderName = mine ? myName : otherName;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <div className="text-[10px] font-semibold mb-0.5 opacity-80">{senderName}</div>
                  {m.body}
                  <div className="text-[10px] mt-1 opacity-70">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Negotiation action bar */}
      {!terminal && (
        <div className="px-2 py-1.5 border-t bg-muted/30 flex items-center gap-2 flex-wrap">
          {status === "pending" && (
            <Button size="sm" variant="secondary" onClick={() => move("negotiating")} disabled={stateBusy}>
              <Handshake className="h-3.5 w-3.5 mr-1" />Mark negotiating
            </Button>
          )}
          <Button size="sm" onClick={() => move("accepted")} disabled={stateBusy}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Accept &amp; generate agreement
          </Button>
          <Button size="sm" variant="destructive" onClick={() => move("declined")} disabled={stateBusy}>
            <XCircle className="h-3.5 w-3.5 mr-1" />Decline
          </Button>
        </div>
      )}

      <form onSubmit={submit} className="p-2 border-t flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={terminal ? "Negotiation closed" : "Type a message…"} disabled={busy || terminal} />
        <Button type="submit" disabled={busy || terminal || !text.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
