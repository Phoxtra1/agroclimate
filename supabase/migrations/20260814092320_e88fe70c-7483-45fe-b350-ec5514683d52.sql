CREATE OR REPLACE FUNCTION public.admin_overview_stats(p_since timestamptz, p_today timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'active_users', (SELECT count(*) FROM public.market_presence WHERE last_seen >= now() - interval '24 hours'),
    'by_farmer_type', COALESCE((SELECT jsonb_object_agg(t, c) FROM (
        SELECT COALESCE(farmer_type,'smallholder') AS t, count(*) AS c FROM public.profiles GROUP BY 1) x), '{}'::jsonb),
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
    'drivers_pending', (SELECT count(*) FROM public.agtrans_drivers WHERE approval_status IN ('pending','more_info')),
    'dau', COALESCE((SELECT jsonb_agg(jsonb_build_object('day', d, 'count', c) ORDER BY d) FROM (
        SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS d, count(DISTINCT user_id) AS c
        FROM public.user_alert_events
        WHERE event = 'delivered' AND created_at >= now() - interval '7 days'
        GROUP BY 1) y), '[]'::jsonb)
  )
$$;

GRANT EXECUTE ON FUNCTION public.admin_overview_stats(timestamptz, timestamptz) TO anon, authenticated, service_role;