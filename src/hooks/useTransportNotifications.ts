import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface TransportNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

const EVENT_TOASTS: Record<string, { title: string; message: string }> = {
  driver_approved: { title: "Driver Approved", message: "You are approved and can start taking transport requests." },
  driver_rejected: { title: "Driver Rejected", message: "Your driver application was rejected." },
  new_transport_request: { title: "New Transport Request", message: "A supplier has requested your transport service." },
  driver_accepted: { title: "Request Accepted", message: "Driver accepted your transport request." },
  driver_declined: { title: "Request Declined", message: "Driver declined your transport request." },
  counter_offer: { title: "Counter Offer", message: "A new counter offer has been received." },
  transport_agreement_created: { title: "Agreement Created", message: "A transport agreement has been reached." },
  driver_en_route: { title: "Driver En Route", message: "The driver is heading to the pickup location." },
  goods_picked_up: { title: "Goods Picked Up", message: "Cargo has been loaded and picked up." },
  driver_near_destination: { title: "Near Destination", message: "Driver is approaching the delivery location." },
  delivery_completed: { title: "Delivery Completed", message: "The delivery has been completed." },
  buyer_confirmed_delivery: { title: "Buyer Confirmed", message: "Buyer confirmed receipt of the delivery." },
};

export function useTransportNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<TransportNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("transport_notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    const list = (data as unknown as TransportNotification[]) || [];
    setNotifications(list);
    setUnreadCount(list.filter((n) => !n.is_read).length);
  }, [user]);

  const markAsRead = useCallback(async (id: string) => {
    await supabase.from("transport_notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await supabase.from("transport_notifications").update({ is_read: true }).eq("user_id", user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const ch = supabase
      .channel(`transport-notifications-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transport_notifications", filter: `user_id=eq.${user.id}` }, (payload: { new: TransportNotification }) => {
        const n = payload.new;
        setNotifications((prev) => [n, ...prev]);
        setUnreadCount((c) => c + 1);
        const preset = EVENT_TOASTS[n.type] || { title: n.title, message: n.message };
        toast(preset.title, { description: n.message || preset.message });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transport_notifications", filter: `user_id=eq.${user.id}` }, (payload: { new: TransportNotification }) => {
        const n = payload.new;
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? n : x)));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchNotifications]);

  return { notifications, unreadCount, fetchNotifications, markAsRead, markAllRead };
}
