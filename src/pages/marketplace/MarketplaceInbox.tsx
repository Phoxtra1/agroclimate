import { useEffect, useState } from "react";
import { MarketplaceLayout } from "@/components/market/MarketplaceLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ChatPanel } from "@/components/market/ChatPanel";
import { Navigate } from "react-router-dom";
import { makeThreadKey } from "@/hooks/useMarketChat";

interface ThreadSummary { other: string; lastBody: string; lastAt: string; unread: number; }

export default function MarketplaceInbox() {
  const { user, loading } = useAuth();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("market_messages" as any)
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(500);
      const map = new Map<string, ThreadSummary>();
      (data as any[] | null)?.forEach((m) => {
        const other = m.sender_id === user.id ? m.recipient_id : m.sender_id;
        const key = makeThreadKey(user.id, other);
        if (!map.has(key)) {
          map.set(key, { other, lastBody: m.body, lastAt: m.created_at, unread: 0 });
        }
        const t = map.get(key)!;
        if (m.recipient_id === user.id && !m.read_at) t.unread += 1;
      });
      setThreads(Array.from(map.values()));
    };
    load();
    const ch = supabase.channel("market-inbox").on("postgres_changes", { event: "*", schema: "public", table: "market_messages" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  if (loading) return <MarketplaceLayout><p>Loading…</p></MarketplaceLayout>;
  if (!user) return <Navigate to="/marketplace/auth" replace />;

  return (
    <MarketplaceLayout>
      <h1 className="text-xl font-bold mb-3">Messages</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="md:col-span-1"><CardContent className="p-2 space-y-1">
          {threads.length === 0 && <p className="text-xs text-muted-foreground p-3">No conversations yet.</p>}
          {threads.map((t) => (
            <button key={t.other} onClick={() => setActive(t.other)}
              className={`w-full text-left p-2 rounded-md hover:bg-accent ${active === t.other ? "bg-accent" : ""}`}>
              <div className="flex items-center justify-between text-sm font-medium">
                <span className="truncate">User · {t.other.slice(0, 8)}</span>
                {t.unread > 0 && <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5">{t.unread}</span>}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">{t.lastBody}</div>
            </button>
          ))}
        </CardContent></Card>
        <div className="md:col-span-2">
          {active ? <ChatPanel key={`${user?.id}-${active}`} otherUserId={active} otherName={`User · ${active.slice(0, 8)}`} />
            : <p className="text-sm text-muted-foreground p-6 text-center">Select a conversation to start chatting.</p>}
        </div>
      </div>
    </MarketplaceLayout>
  );
}
