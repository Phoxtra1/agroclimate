CREATE OR REPLACE FUNCTION public.admin_overview_stats(p_since timestamp with time zone, p_today timestamp with time zone)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'active_users', (SELECT count(DISTINCT u) FROM (
        SELECT user_id AS u FROM public.market_presence WHERE last_seen >= now() - interval '24 hours'
        UNION
        SELECT user_id FROM public.activity WHERE created_at >= now() - interval '24 hours'
        UNION
        SELECT user_id FROM public.user_alert_events WHERE created_at >= now() - interval '24 hours'
      ) a WHERE u IS NOT NULL),
    'by_farmer_type', COALESCE((SELECT jsonb_object_agg(t, c) FROM (
        SELECT COALESCE(NULLIF(farmer_type,''),'smallholder') AS t, count(*) AS c FROM public.profiles GROUP BY 1) x), '{}'::jsonb),
    'alerts_total', (SELECT count(*) FROM public.disaster_alerts),
    'alerts_today', (SELECT count(*) FROM public.disaster_alerts WHERE created_at >= p_today),
    'alerts_by_type', COALESCE((SELECT jsonb_object_agg(t, c) FROM (
        SELECT COALESCE(alert_type,'other') AS t, count(*) AS c FROM public.disaster_alerts WHERE created_at >= p_since GROUP BY 1) x), '{}'::jsonb),
    'alerts_by_severity', COALESCE((SELECT jsonb_object_agg(t, c) FROM (
        SELECT COALESCE(severity,'info') AS t, count(*) AS c FROM public.disaster_alerts WHERE created_at >= p_since GROUP BY 1) x), '{}'::jsonb),
    'contracts', (SELECT count(*) FROM public.market_contracts WHERE created_at >= p_since),
    'supply', (SELECT count(*) FROM public.farmer_inputs WHERE created_at >= p_since),
    'demand', (SELECT count(*) FROM public.buyer_orders WHERE created_at >= p_since),
    'farms', (SELECT count(*) FROM public.farm_qr_codes),
    'handlers', (SELECT count(*) FROM public.handlers),
    'sos', (SELECT count(*) FROM public.disaster_alerts WHERE alert_type = 'sos' AND created_at >= p_since),
    'alerts_delivered', (SELECT count(*) FROM public.user_alert_events WHERE event = 'delivered' AND created_at >= p_since),
    'alerts_opened', (SELECT count(*) FROM public.user_alert_events WHERE event = 'opened' AND created_at >= p_since),
    'drivers_total', (SELECT count(*) FROM public.agtrans_drivers),
    'drivers_pending', (SELECT count(*) FROM public.agtrans_drivers WHERE approval_status IN ('pending','more_info')),
    'drivers_approved', (SELECT count(*) FROM public.agtrans_drivers WHERE approval_status = 'approved'),
    'requests_total', (SELECT count(*) FROM public.agtrans_requests WHERE created_at >= p_since),
    'agreements_total', (SELECT count(*) FROM public.transport_agreements WHERE created_at >= p_since),
    'active_trips', (SELECT count(*) FROM public.agtrans_requests WHERE status IN ('accepted','in_transit','picked_up','en_route') AND created_at >= p_since),
    'completed_trips', (SELECT count(*) FROM public.agtrans_requests WHERE status = 'delivered' AND created_at >= p_since),
    'dau', COALESCE((SELECT jsonb_agg(jsonb_build_object('day', d, 'count', c) ORDER BY d) FROM (
        SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS d, count(DISTINCT user_id) AS c
        FROM (
          SELECT user_id, created_at FROM public.user_alert_events WHERE created_at >= now() - interval '7 days'
          UNION ALL
          SELECT user_id, created_at FROM public.activity WHERE created_at >= now() - interval '7 days'
        ) e
        GROUP BY 1) y), '[]'::jsonb)
  )
$$;

GRANT EXECUTE ON FUNCTION public.admin_overview_stats(timestamp with time zone, timestamp with time zone) TO anon, authenticated, service_role;