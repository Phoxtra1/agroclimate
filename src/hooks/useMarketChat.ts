// Live chat for Market Link (farmer ↔ buyer)
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface MarketMessage {
  id: string;
  thread_key: string;
  sender_id: string;
  recipient_id: string;
  related_supply_id: string | null;
  related_order_id: string | null;
  body: string;
  read_at: string | null;
  created_at: string;
}

/**
 * A thread is always scoped to the exact pair of users, and — when the chat is
 * about a specific listing or order — to that item too. This keeps every
 * conversation private and separate per counterpart and per deal.
 */
export function makeThreadKey(a: string, b: string, contextId?: string | null): string {
  const pair = [a, b].sort().join(":");
  return contextId ? `${pair}#${contextId}` : pair;
}

export function useMarketChat(otherUserId: string | null, contextId?: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MarketMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const threadKey = user && otherUserId ? makeThreadKey(user.id, otherUserId, contextId) : null;

  const fetchMessages = useCallback(async () => {
    if (!threadKey || !user) return;
    setLoading(true);
    const { data } = await supabase
      .from("market_messages" as any)
      .select("*")
      .eq("thread_key", threadKey)
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: true });
    const rows = ((data as any) || []) as MarketMessage[];
    // Isolation guard: only messages this signed-in user takes part in are ever
    // rendered, even if a wider row set were ever returned.
    const safe = rows.filter((m) => isParticipant(m as any, user.id) && m.thread_key === threadKey);
    reportAudit(
      "thread",
      auditThread(rows as any, user.id, threadKey, makeThreadKey(user.id, otherUserId!, contextId)),
    );
    setMessages(safe);
    setLoading(false);
  }, [threadKey, user?.id, otherUserId, contextId]);


  useEffect(() => {
    setMessages([]);
    fetchMessages();
    if (!threadKey) return;
    const ch = supabase
      .channel(`market-chat-${threadKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "market_messages", filter: `thread_key=eq.${threadKey}` },
        () => fetchMessages(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [threadKey, fetchMessages]);

  const send = useCallback(
    async (body: string, opts?: { related_supply_id?: string; related_order_id?: string }) => {
      if (!user || !otherUserId || !threadKey) return;
      const trimmed = body.trim();
      if (!trimmed) return;
      const { error } = await supabase.from("market_messages" as any).insert({
        thread_key: threadKey,
        sender_id: user.id,
        recipient_id: otherUserId,
        related_supply_id: opts?.related_supply_id || null,
        related_order_id: opts?.related_order_id || null,
        body: trimmed,
      } as any);
      if (error) throw error;
    },
    [user, otherUserId, threadKey],
  );

  const markAllRead = useCallback(async () => {
    if (!user || !threadKey) return;
    await supabase
      .from("market_messages" as any)
      .update({ read_at: new Date().toISOString() } as any)
      .eq("thread_key", threadKey)
      .eq("recipient_id", user.id)
      .is("read_at", null);
  }, [user, threadKey]);

  return { messages, loading, send, markAllRead };
}

// Simple presence: heartbeats every 30s; "online" = last_seen within 90s
export function usePresence() {
  const { user } = useAuth();
  const [online, setOnline] = useState<Record<string, boolean>>({});
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;
    const beat = async () => {
      await supabase.from("market_presence" as any).upsert(
        { user_id: user.id, last_seen: new Date().toISOString() } as any,
        { onConflict: "user_id" } as any,
      );
    };
    beat();
    heartbeatRef.current = setInterval(beat, 30_000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [user]);

  const refresh = useCallback(async (userIds: string[]) => {
    if (!userIds.length) return;
    const { data } = await supabase
      .from("market_presence" as any)
      .select("user_id, last_seen")
      .in("user_id", userIds);
    const cutoff = Date.now() - 90_000;
    const next: Record<string, boolean> = {};
    (data as any[] | null)?.forEach((r) => {
      next[r.user_id] = new Date(r.last_seen).getTime() >= cutoff;
    });
    setOnline(next);
  }, []);

  return { online, refresh };
}
