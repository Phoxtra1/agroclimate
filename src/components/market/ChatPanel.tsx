import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, LogIn } from "lucide-react";
import { useMarketChat, usePresence } from "@/hooks/useMarketChat";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Props {
  otherUserId: string;
  otherName: string;
  relatedSupplyId?: string;
  relatedOrderId?: string;
  onClose?: () => void;
}

export function ChatPanel({ otherUserId, otherName, relatedSupplyId, relatedOrderId }: Props) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { messages, loading, send, markAllRead } = useMarketChat(otherUserId);
  const { online, refresh } = usePresence();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selfChat = !!user && user.id === otherUserId;

  useEffect(() => {
    if (!otherUserId || selfChat) return;
    refresh([otherUserId]);
    const t = setInterval(() => refresh([otherUserId]), 30_000);
    return () => clearInterval(t);
  }, [otherUserId, refresh, selfChat]);

  useEffect(() => {
    if (!user) return;
    markAllRead();
  }, [messages.length, markAllRead, user]);

  // Scroll on length AND on the latest message id (handles edits/deletes too).
  const lastId = useMemo(() => messages[messages.length - 1]?.id ?? "", [messages]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lastId, messages.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("Sign in to chat"); return; }
    if (selfChat) { toast.error("You can't chat with yourself."); return; }
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      await send(body, { related_supply_id: relatedSupplyId, related_order_id: relatedOrderId });
      setText("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send");
    } finally {
      setBusy(false);
    }
  };

  // Not signed in — show a clear prompt instead of an empty/blank panel.
  if (!authLoading && !user) {
    return (
      <div className="flex flex-col items-center justify-center h-[40vh] border rounded-lg bg-background p-6 text-center gap-3">
        <p className="text-sm font-medium">Sign in to chat with {otherName}</p>
        <p className="text-xs text-muted-foreground">
          Buyers and suppliers chat live here to negotiate price, quality and delivery, and to lock in agreements.
        </p>
        <Button size="sm" onClick={() => navigate("/marketplace/auth")}>
          <LogIn className="h-4 w-4 mr-1" /> Sign in to continue
        </Button>
      </div>
    );
  }

  if (selfChat) {
    return (
      <div className="flex flex-col items-center justify-center h-[30vh] border rounded-lg bg-background p-6 text-center">
        <p className="text-sm text-muted-foreground">This listing belongs to you — open another party's listing to start a chat.</p>
      </div>
    );
  }

  const isOnline = !!online[otherUserId];

  return (
    <div className="flex flex-col h-[60vh] border rounded-lg bg-background">
      <div className="px-3 py-2 border-b flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? "bg-green-500" : "bg-muted-foreground/40"}`} />
        <div className="text-sm font-semibold truncate">{otherName}</div>
        <div className="text-[11px] text-muted-foreground">
          {isOnline ? "Online" : "Offline · leave a message"}
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No messages yet. Say hello 👋 — discuss price, quantity and delivery to finalise the agreement.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            const meta: any = user?.user_metadata || {};
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
      <form onSubmit={submit} className="p-2 border-t flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !text.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
