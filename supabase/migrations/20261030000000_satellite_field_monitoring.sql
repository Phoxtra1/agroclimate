-- Persistent field boundaries and satellite-derived crop observation history.
create table if not exists public.satellite_fields (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100),
  crop_type text,
  planted_on date,
  field_geojson jsonb not null,
  area_hectares numeric(12, 3) not null default 0 check (area_hectares >= 0),
  monitoring_enabled boolean not null default true,
  max_cloud_cover numeric(5, 2) not null default 30 check (max_cloud_cover between 0 and 100),
  ndvi_drop_threshold numeric(5, 3) not null default 0.15 check (ndvi_drop_threshold between 0.05 and 0.6),
  last_scene_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint satellite_fields_geojson_polygon_check check (
    field_geojson->>'type' in ('Polygon', 'MultiPolygon')
  )
);

create index if not exists satellite_fields_monitoring_idx
  on public.satellite_fields (monitoring_enabled, last_scene_at)
  where monitoring_enabled = true;

create table if not exists public.satellite_field_observations (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.satellite_fields(id) on delete cascade,
  scene_id text not null,
  captured_at timestamptz not null,
  cloud_cover numeric(5, 2),
  mean_ndvi numeric(8, 5),
  min_ndvi numeric(8, 5),
  max_ndvi numeric(8, 5),
  mean_ndmi numeric(8, 5),
  valid_pixel_count integer not null default 0 check (valid_pixel_count >= 0),
  created_at timestamptz not null default now(),
  unique (field_id, scene_id)
);

create index if not exists satellite_field_observations_history_idx
  on public.satellite_field_observations (field_id, captured_at desc);

create table if not exists public.satellite_field_alerts (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.satellite_fields(id) on delete cascade,
  scene_id text not null,
  alert_kind text not null default 'vegetation_decline',
  severity text not null check (severity in ('moderate', 'high')),
  title text not null,
  message text not null,
  baseline_ndvi numeric(8, 5),
  current_ndvi numeric(8, 5),
  ndvi_drop numeric(8, 5),
  ndvi_drop_percent numeric(8, 2),
  baseline_ndmi numeric(8, 5),
  current_ndmi numeric(8, 5),
  ndmi_drop numeric(8, 5),
  cloud_cover numeric(5, 2),
  valid_pixel_count integer not null default 0,
  confidence integer not null default 0 check (confidence between 0 and 100),
  captured_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  created_at timestamptz not null default now(),
  unique (field_id, scene_id, alert_kind)
);

create index if not exists satellite_field_alerts_field_created_idx
  on public.satellite_field_alerts (field_id, created_at desc);

alter table public.satellite_fields enable row level security;
alter table public.satellite_field_observations enable row level security;
alter table public.satellite_field_alerts enable row level security;

drop policy if exists "Farmers manage their satellite fields" on public.satellite_fields;
create policy "Farmers manage their satellite fields"
  on public.satellite_fields
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Farmers read their satellite observations" on public.satellite_field_observations;
create policy "Farmers read their satellite observations"
  on public.satellite_field_observations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.satellite_fields f
      where f.id = field_id and f.user_id = auth.uid()
    )
  );

drop policy if exists "Farmers read their satellite alerts" on public.satellite_field_alerts;
create policy "Farmers read their satellite alerts"
  on public.satellite_field_alerts
  for select
  to authenticated
  using (
    exists (
      select 1 from public.satellite_fields f
      where f.id = field_id and f.user_id = auth.uid()
    )
  );

drop policy if exists "Farmers acknowledge their satellite alerts" on public.satellite_field_alerts;
create policy "Farmers acknowledge their satellite alerts"
  on public.satellite_field_alerts
  for update
  to authenticated
  using (
    exists (
      select 1 from public.satellite_fields f
      where f.id = field_id and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.satellite_fields f
      where f.id = field_id and f.user_id = auth.uid()
    )
  );

-- Make alert inserts visible to connected Satellite pages in real time.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'satellite_field_alerts'
     ) then
    alter publication supabase_realtime add table public.satellite_field_alerts;
  end if;
end $$;
