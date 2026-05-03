import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2 } from "lucide-react";
import { useMarketChat, usePresence } from "@/hooks/useMarketChat";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  otherUserId: string;
  otherName: string;
  relatedSupplyId?: string;
  relatedOrderId?: string;
  onClose?: () => void;
}

export function ChatPanel({ otherUserId, otherName, relatedSupplyId, relatedOrderId }: Props) {
  const { user } = useAuth();
  const { messages, loading, send, markAllRead } = useMarketChat(otherUserId);
  const { online, refresh } = usePresence();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { refresh([otherUserId]); const t = setInterval(() => refresh([otherUserId]), 30_000); return () => clearInterval(t); }, [otherUserId, refresh]);
  useEffect(() => { markAllRead(); }, [messages.length, markAllRead]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("Sign in to chat"); return; }
    setBusy(true);
    try { await send(text, { related_supply_id: relatedSupplyId, related_order_id: relatedOrderId }); setText(""); }
    catch (err: any) { toast.error(err.message || "Failed to send"); }
    finally { setBusy(false); }
  };

  const isOnline = !!online[otherUserId];

  return (
    <div className="flex flex-col h-[60vh] border rounded-lg bg-background">
      <div className="px-3 py-2 border-b flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? "bg-green-500" : "bg-muted-foreground/40"}`} />
        <div className="text-sm font-semibold">{otherName}</div>
        <div className="text-[11px] text-muted-foreground">{isOnline ? "Online" : "Offline · leave a message"}</div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? <p className="text-xs text-muted-foreground">Loading…</p>
          : messages.length === 0 ? <p className="text-xs text-muted-foreground text-center py-6">No messages yet. Say hello 👋</p>
          : messages.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {m.body}
                    <div className={`text-[10px] mt-1 opacity-70`}>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                </div>
              );
            })}
      </div>
      <form onSubmit={submit} className="p-2 border-t flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" />
        <Button type="submit" disabled={busy || !text.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
