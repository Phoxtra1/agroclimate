-- AgroClimate shared geospatial infrastructure and maritime safety migration.
-- All coordinates are WGS84 longitude/latitude. GeoJSON is retained for interchange;
-- PostGIS geometry columns are derived for spatial indexing and querying.

create extension if not exists postgis with schema extensions;

create or replace function public.is_agroclimate_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  );
$$;

revoke all on function public.is_agroclimate_admin() from public;
grant execute on function public.is_agroclimate_admin() to authenticated;

-- One spatial feature registry for farm parcels, facilities, buyers, suppliers,
-- ports, drone observations and other map-backed records.
create table if not exists public.geo_features (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  feature_type text not null check (feature_type in (
    'farm_boundary','farm_location','warehouse','silo','cold_store','collection_centre',
    'processing_facility','buyer','supplier','port','pickup_point',
    'delivery_point','drone_observation','water_source','road_hazard','other'
  )),
  name text not null,
  description text,
  visibility text not null default 'private' check (visibility in ('private','public')),
  geojson jsonb not null,
  geom extensions.geometry(Geometry, 4326),
  centroid extensions.geometry(Point, 4326),
  properties jsonb not null default '{}'::jsonb,
  source_name text,
  source_url text,
  source_record_id text,
  acquisition_date timestamptz,
  resolution_m numeric,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  data_quality text not null default 'unverified' check (data_quality in ('unverified','estimated','observed','verified')),
  stale_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint geo_features_geojson_object check (jsonb_typeof(geojson) = 'object')
);

alter table public.geo_features drop constraint if exists geo_features_feature_type_check;
alter table public.geo_features add constraint geo_features_feature_type_check check (feature_type in (
  'farm_boundary','farm_location','warehouse','silo','cold_store','collection_centre',
  'processing_facility','buyer','supplier','port','pickup_point','delivery_point',
  'drone_observation','water_source','road_hazard','other'
));

create index if not exists geo_features_geom_gix on public.geo_features using gist (geom);
create index if not exists geo_features_centroid_gix on public.geo_features using gist (centroid);
create index if not exists geo_features_type_idx on public.geo_features (feature_type, created_at desc);
create index if not exists geo_features_owner_idx on public.geo_features (owner_id, created_at desc);
create index if not exists geo_features_properties_gin on public.geo_features using gin (properties);

create or replace function public.set_geo_feature_geometry()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.geom := st_setsrid(st_geomfromgeojson(new.geojson::text), 4326);
  if new.geom is null or st_isempty(new.geom) or not st_isvalid(new.geom) then
    raise exception 'GeoJSON must contain a valid non-empty geometry';
  end if;
  new.centroid := st_centroid(new.geom);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists geo_features_geometry_before_write on public.geo_features;
create trigger geo_features_geometry_before_write
before insert or update of geojson on public.geo_features
for each row execute function public.set_geo_feature_geometry();

create table if not exists public.geo_observations (
  id uuid primary key default gen_random_uuid(),
  feature_id uuid references public.geo_features(id) on delete cascade,
  observer_id uuid references auth.users(id) on delete set null,
  observation_type text not null,
  observed_at timestamptz not null default now(),
  source_name text,
  source_url text,
  resolution_m numeric,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  metrics jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists geo_observations_feature_idx on public.geo_observations (feature_id, observed_at desc);
create index if not exists geo_observations_observer_idx on public.geo_observations (observer_id, observed_at desc);

create table if not exists public.geo_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  route_type text not null default 'road' check (route_type in ('road','freight','tractor','walking','waterway','multimodal','drone')),
  origin jsonb not null,
  destination jsonb not null,
  geometry jsonb not null,
  geom extensions.geometry(LineString, 4326),
  distance_m numeric,
  duration_s numeric,
  provider text,
  status text not null default 'calculated' check (status in ('calculated','active','completed','cancelled')),
  is_simulated boolean not null default false,
  calculated_at timestamptz not null default now(),
  last_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists geo_routes_geom_gix on public.geo_routes using gist (geom);
create index if not exists geo_routes_user_idx on public.geo_routes (user_id, calculated_at desc);

create or replace function public.set_geo_route_geometry()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.geom := st_setsrid(st_geomfromgeojson(new.geometry::text), 4326)::geometry(LineString, 4326);
  if new.geom is null or st_isempty(new.geom) or not st_isvalid(new.geom) then
    raise exception 'Route geometry must be a valid GeoJSON LineString';
  end if;
  return new;
end;
$$;
drop trigger if exists geo_routes_geometry_before_write on public.geo_routes;
create trigger geo_routes_geometry_before_write
before insert or update of geometry on public.geo_routes
for each row execute function public.set_geo_route_geometry();

-- A small source registry makes availability and limitations explicit.
create table if not exists public.geo_data_sources (
  id text primary key,
  name text not null,
  provider text not null,
  data_family text not null,
  access_status text not null check (access_status in ('available','limited','paused','not_ingested','configured')),
  spatial_resolution text,
  source_url text not null,
  attribution text,
  last_checked_at timestamptz not null default now(),
  notes text
);
insert into public.geo_data_sources
  (id,name,provider,data_family,access_status,spatial_resolution,source_url,attribution,notes)
values
  ('nasa-power-climatology','NASA POWER climatology','NASA POWER','climate','available','Gridded point product; product-dependent','https://power.larc.nasa.gov/docs/services/api/temporal/climatology/','NASA POWER','Climate normals only; not a field-scale weather forecast.'),
  ('sentinel-2-l2a','Sentinel-2 L2A','Copernicus / Element 84 Earth Search','optical_imagery','available','10 m / 20 m bands','https://earth-search.aws.element84.com/v1/','Copernicus Sentinel-2','Scene acquisition date and cloud cover must accompany each result.'),
  ('soilgrids','SoilGrids','ISRIC','soil','paused','250 m','https://docs.isric.org/globaldata/soilgrids/','ISRIC SoilGrids','REST API is currently paused by ISRIC; do not substitute synthetic soil values.'),
  ('fao-gaez-v5','FAO GAEZ v5','FAO / IIASA','crop_suitability','not_ingested','Selected outputs approx. 1 km','https://gaez.fao.org/','FAO / IIASA','Catalogue only until licensed/downloaded layers are ingested and tiled.'),
  ('openstreetmap','OpenStreetMap','OpenStreetMap contributors','roads_and_places','available','Crowdsourced / variable','https://www.openstreetmap.org/copyright','© OpenStreetMap contributors','Map geometry does not verify legal ownership, access rights or road passability.')
on conflict (id) do update set
  access_status = excluded.access_status,
  spatial_resolution = excluded.spatial_resolution,
  source_url = excluded.source_url,
  attribution = excluded.attribution,
  notes = excluded.notes,
  last_checked_at = now();

-- AGNav data model. These CREATE IF NOT EXISTS statements also repair deployments
-- where the old page was used after its migration had only been documented in code.
create table if not exists public.vessels (
  id text primary key,
  owner_id uuid references auth.users(id) on delete set null,
  vessel_name text,
  operator_name text,
  operator_type text,
  phone_number text,
  home_lat double precision,
  home_lon double precision,
  max_capacity integer not null default 0,
  cargo_capacity_kg numeric not null default 0,
  has_rescue_capability boolean not null default false,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);
alter table public.vessels add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.vessels add column if not exists vessel_name text;
alter table public.vessels add column if not exists operator_name text;
alter table public.vessels add column if not exists operator_type text;
alter table public.vessels add column if not exists phone_number text;
alter table public.vessels add column if not exists home_lat double precision;
alter table public.vessels add column if not exists home_lon double precision;
alter table public.vessels add column if not exists max_capacity integer not null default 0;
alter table public.vessels add column if not exists cargo_capacity_kg numeric not null default 0;
alter table public.vessels add column if not exists has_rescue_capability boolean not null default false;
alter table public.vessels add column if not exists status text not null default 'ACTIVE';
alter table public.vessels add column if not exists created_at timestamptz not null default now();

create table if not exists public.vessel_locations (
  id uuid primary key default gen_random_uuid(),
  vessel_id text not null references public.vessels(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  geom extensions.geometry(Point, 4326),
  accuracy_m numeric,
  captured_at timestamptz not null default now(),
  location_source text not null default 'unverified',
  speed_kn numeric,
  heading numeric,
  risk_level text,
  created_at timestamptz not null default now()
);
alter table public.vessel_locations add column if not exists geom extensions.geometry(Point, 4326);
alter table public.vessel_locations add column if not exists accuracy_m numeric;
alter table public.vessel_locations add column if not exists captured_at timestamptz;
alter table public.vessel_locations add column if not exists location_source text;
update public.vessel_locations
set captured_at = coalesce(captured_at, created_at),
    location_source = coalesce(location_source, 'unverified')
where captured_at is null or location_source is null;
alter table public.vessel_locations alter column captured_at set default now();
alter table public.vessel_locations alter column captured_at set not null;
alter table public.vessel_locations alter column location_source set default 'unverified';
alter table public.vessel_locations alter column location_source set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.vessel_locations'::regclass and conname = 'vessel_locations_accuracy_check') then
    alter table public.vessel_locations add constraint vessel_locations_accuracy_check check (accuracy_m is null or accuracy_m between 0.1 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.vessel_locations'::regclass and conname = 'vessel_locations_source_check') then
    alter table public.vessel_locations add constraint vessel_locations_source_check check (location_source in ('unverified','device_gps'));
  end if;
end $$;
create index if not exists vessel_locations_vessel_idx on public.vessel_locations (vessel_id, created_at desc);
create index if not exists vessel_locations_geom_gix on public.vessel_locations using gist (geom);

create or replace function public.set_vessel_location_geometry()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.lat not between -90 and 90 or new.lon not between -180 and 180 then
    raise exception 'Invalid WGS84 vessel coordinates';
  end if;
  new.geom := st_setsrid(st_makepoint(new.lon, new.lat), 4326);
  return new;
end;
$$;
drop trigger if exists vessel_locations_geometry_before_write on public.vessel_locations;
create trigger vessel_locations_geometry_before_write
before insert or update of lat, lon on public.vessel_locations
for each row execute function public.set_vessel_location_geometry();

create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  lat double precision not null,
  lon double precision not null,
  geo_feature_id uuid references public.geo_features(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.farms add column if not exists geo_feature_id uuid references public.geo_features(id) on delete set null;
create index if not exists farms_user_idx on public.farms (user_id, created_at desc);
create index if not exists farms_geo_feature_idx on public.farms (geo_feature_id);

-- Bring legacy AgroRisk farm pins into the common Satellite feature registry.
insert into public.geo_features (owner_id, feature_type, name, visibility, geojson, properties, source_name, data_quality)
select f.user_id, 'farm_location', f.name, 'private',
       jsonb_build_object('type','Point','coordinates',jsonb_build_array(f.lon,f.lat)),
       jsonb_build_object('farm_record_id', f.id::text, 'location_method', 'legacy_user_entry'),
       'Legacy AgroRisk farm registration', 'unverified'
from public.farms f
where f.geo_feature_id is null
  and not exists (
    select 1 from public.geo_features g
    where g.feature_type = 'farm_location' and g.properties->>'farm_record_id' = f.id::text
  );

update public.farms f
set geo_feature_id = g.id
from public.geo_features g
where f.geo_feature_id is null
  and g.feature_type = 'farm_location'
  and g.properties->>'farm_record_id' = f.id::text;

create table if not exists public.nav_routes (
  id uuid primary key default gen_random_uuid(),
  vessel_id text not null references public.vessels(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  start_lat double precision,
  start_lon double precision,
  end_lat double precision,
  end_lon double precision,
  passengers integer not null default 0,
  cargo_kg numeric not null default 0,
  distance_m numeric,
  duration_s numeric,
  risk_score numeric,
  risk_level text,
  geometry jsonb,
  created_at timestamptz not null default now()
);
create index if not exists nav_routes_user_idx on public.nav_routes (user_id, created_at desc);

create table if not exists public.external_responders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  agency text,
  phone_number text,
  webhook_url text,
  region text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sos_events (
  id uuid primary key default gen_random_uuid(),
  vessel_id text not null references public.vessels(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  risk_level text not null,
  message text,
  status text not null default 'BROADCAST' check (status in ('BROADCAST','ACCEPTED','RESOLVED')),
  accepted_by_vessel_id text references public.vessels(id) on delete set null,
  eta_minutes integer,
  notified_vessels jsonb not null default '[]'::jsonb,
  notified_responders jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists sos_events_created_idx on public.sos_events (created_at desc);
create index if not exists sos_events_status_idx on public.sos_events (status, created_at desc);

create table if not exists public.vessel_messages (
  id uuid primary key default gen_random_uuid(),
  sos_event_id uuid references public.sos_events(id) on delete cascade,
  from_vessel_id text not null references public.vessels(id) on delete cascade,
  to_vessel_id text references public.vessels(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists vessel_messages_event_idx on public.vessel_messages (sos_event_id, created_at asc);

-- Enable RLS on all operational and spatial tables.
alter table public.geo_features enable row level security;
alter table public.geo_observations enable row level security;
alter table public.geo_routes enable row level security;
alter table public.geo_data_sources enable row level security;
alter table public.vessels enable row level security;
alter table public.vessel_locations enable row level security;
alter table public.farms enable row level security;
alter table public.nav_routes enable row level security;
alter table public.external_responders enable row level security;
alter table public.sos_events enable row level security;
alter table public.vessel_messages enable row level security;

-- Drop the permissive legacy AGNav policies before recreating scoped policies.
drop policy if exists "vessels read" on public.vessels;
drop policy if exists "vessels owner write" on public.vessels;
drop policy if exists "loc read" on public.vessel_locations;
drop policy if exists "loc insert" on public.vessel_locations;
drop policy if exists "farms read own" on public.farms;
drop policy if exists "farms write own" on public.farms;
drop policy if exists "routes read" on public.nav_routes;
drop policy if exists "routes insert" on public.nav_routes;
drop policy if exists "ext read" on public.external_responders;
drop policy if exists "sos read" on public.sos_events;
drop policy if exists "sos insert" on public.sos_events;
drop policy if exists "sos accept" on public.sos_events;
drop policy if exists "msg read" on public.vessel_messages;
drop policy if exists "msg insert" on public.vessel_messages;

drop policy if exists geo_features_read on public.geo_features;
create policy geo_features_read on public.geo_features for select to authenticated
using (visibility = 'public' or owner_id = auth.uid() or public.is_agroclimate_admin());
drop policy if exists geo_features_insert on public.geo_features;
create policy geo_features_insert on public.geo_features for insert to authenticated
with check ((owner_id = auth.uid() and visibility = 'private') or public.is_agroclimate_admin());
drop policy if exists geo_features_update on public.geo_features;
create policy geo_features_update on public.geo_features for update to authenticated
using (owner_id = auth.uid() or public.is_agroclimate_admin())
with check ((owner_id = auth.uid() and visibility = 'private') or public.is_agroclimate_admin());
drop policy if exists geo_features_delete on public.geo_features;
create policy geo_features_delete on public.geo_features for delete to authenticated
using (owner_id = auth.uid() or public.is_agroclimate_admin());

drop policy if exists geo_observations_read on public.geo_observations;
create policy geo_observations_read on public.geo_observations for select to authenticated
using (
  observer_id = auth.uid()
  or public.is_agroclimate_admin()
  or exists (select 1 from public.geo_features f where f.id = feature_id and f.visibility = 'public')
);
drop policy if exists geo_observations_insert on public.geo_observations;
create policy geo_observations_insert on public.geo_observations for insert to authenticated
with check (observer_id = auth.uid() and (feature_id is null or exists (
  select 1 from public.geo_features f where f.id = feature_id and (f.owner_id = auth.uid() or f.visibility = 'public')
)));

drop policy if exists geo_routes_owner on public.geo_routes;
create policy geo_routes_owner on public.geo_routes for all to authenticated
using (user_id = auth.uid() or public.is_agroclimate_admin())
with check (user_id = auth.uid() or public.is_agroclimate_admin());

drop policy if exists geo_sources_read on public.geo_data_sources;
create policy geo_sources_read on public.geo_data_sources for select to authenticated using (true);
drop policy if exists geo_sources_admin on public.geo_data_sources;
create policy geo_sources_admin on public.geo_data_sources for all to authenticated
using (public.is_agroclimate_admin()) with check (public.is_agroclimate_admin());

drop policy if exists vessels_owner_read on public.vessels;
create policy vessels_owner_read on public.vessels for select to authenticated
using (owner_id = auth.uid() or public.is_agroclimate_admin());
drop policy if exists vessels_owner_insert on public.vessels;
create policy vessels_owner_insert on public.vessels for insert to authenticated
with check (owner_id = auth.uid());
drop policy if exists vessels_owner_update on public.vessels;
create policy vessels_owner_update on public.vessels for update to authenticated
using (owner_id = auth.uid() or public.is_agroclimate_admin())
with check (owner_id = auth.uid() or public.is_agroclimate_admin());
drop policy if exists vessels_owner_delete on public.vessels;
create policy vessels_owner_delete on public.vessels for delete to authenticated
using (owner_id = auth.uid() or public.is_agroclimate_admin());

drop policy if exists vessel_locations_read on public.vessel_locations;
create policy vessel_locations_read on public.vessel_locations for select to authenticated
using (
  user_id = auth.uid()
  or public.is_agroclimate_admin()
  or exists (
    select 1 from public.sos_events e
    join public.vessels mine on mine.owner_id = auth.uid()
    where mine.id in (e.vessel_id, e.accepted_by_vessel_id)
      and vessel_locations.vessel_id in (e.vessel_id, e.accepted_by_vessel_id)
      and e.status = 'ACCEPTED'
  )
);
drop policy if exists vessel_locations_insert on public.vessel_locations;
create policy vessel_locations_insert on public.vessel_locations for insert to authenticated
with check (
  user_id = auth.uid()
  and location_source = 'device_gps'
  and accuracy_m between 0.1 and 100
  and captured_at >= now() - interval '90 seconds'
  and captured_at <= now() + interval '15 seconds'
  and exists (select 1 from public.vessels v where v.id = vessel_id and v.owner_id = auth.uid())
);

drop policy if exists farms_owner on public.farms;
create policy farms_owner on public.farms for all to authenticated
using (user_id = auth.uid() or public.is_agroclimate_admin())
with check (user_id = auth.uid() or public.is_agroclimate_admin());

drop policy if exists nav_routes_owner on public.nav_routes;
create policy nav_routes_owner on public.nav_routes for all to authenticated
using (user_id = auth.uid() or public.is_agroclimate_admin())
with check (user_id = auth.uid() or public.is_agroclimate_admin());

drop policy if exists responders_read on public.external_responders;
create policy responders_read on public.external_responders for select to authenticated
using (public.is_agroclimate_admin());
drop policy if exists responders_admin_write on public.external_responders;
create policy responders_admin_write on public.external_responders for all to authenticated
using (public.is_agroclimate_admin()) with check (public.is_agroclimate_admin());

drop policy if exists sos_events_read_participants on public.sos_events;
create policy sos_events_read_participants on public.sos_events for select to authenticated
using (
  user_id = auth.uid()
  or public.is_agroclimate_admin()
  or exists (select 1 from public.vessels v where v.owner_id = auth.uid() and v.id = sos_events.accepted_by_vessel_id)
  or exists (
    select 1
    from jsonb_array_elements(coalesce(notified_vessels,'[]'::jsonb)) nv
    join public.vessels v on v.id = nv->>'vessel_id'
    where v.owner_id = auth.uid()
  )
);
drop policy if exists sos_events_insert_owner on public.sos_events;
-- SOS and rescue message writes are mediated by the authenticated Edge Function
-- so clients cannot set status, acceptance or resolution fields directly.
drop policy if exists sos_events_update_participant on public.sos_events;

drop policy if exists vessel_messages_read_participant on public.vessel_messages;
create policy vessel_messages_read_participant on public.vessel_messages for select to authenticated
using (
  exists (select 1 from public.vessels v where v.owner_id = auth.uid() and v.id in (from_vessel_id, to_vessel_id))
  or public.is_agroclimate_admin()
);
drop policy if exists vessel_messages_insert_participant on public.vessel_messages;

-- Explicit grants complement row-level security. No operational vessel,
-- location, emergency or private route data is available to anon.
revoke all on public.geo_features, public.geo_observations, public.geo_routes,
  public.geo_data_sources, public.vessels, public.vessel_locations, public.farms,
  public.nav_routes, public.external_responders, public.sos_events, public.vessel_messages
from anon;

grant select, insert, update, delete on public.geo_features to authenticated;
grant select, insert on public.geo_observations to authenticated;
grant select, insert, update, delete on public.geo_routes to authenticated;
grant select, insert, update, delete on public.geo_data_sources to authenticated;
grant select, insert, update, delete on public.vessels to authenticated;
grant select, insert on public.vessel_locations to authenticated;
grant select, insert, update, delete on public.farms to authenticated;
grant select, insert, update, delete on public.nav_routes to authenticated;
grant select, insert, update, delete on public.external_responders to authenticated;
grant select on public.sos_events to authenticated;
grant select on public.vessel_messages to authenticated;
revoke insert, update, delete on public.sos_events, public.vessel_messages from authenticated;

-- Enable realtime for live operational layers without making data public.
do $$
begin
  alter publication supabase_realtime add table public.vessel_locations;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.sos_events;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.vessel_messages;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.geo_features;
exception when duplicate_object then null;
end $$;

-- Link existing monitored fields into the canonical shared spatial registry.
alter table public.satellite_fields add column if not exists geo_feature_id uuid references public.geo_features(id) on delete set null;
insert into public.geo_features (owner_id, feature_type, name, visibility, geojson, source_name, data_quality, properties)
select
  sf.user_id,
  'farm_boundary',
  sf.name,
  'private',
  case
    when sf.field_geojson ? 'geometry' then sf.field_geojson->'geometry'
    else sf.field_geojson
  end,
  'User-drawn Satellite field boundary',
  'observed',
  jsonb_build_object('satellite_field_id', sf.id, 'crop_type', sf.crop_type, 'area_hectares', sf.area_hectares)
from public.satellite_fields sf
where sf.geo_feature_id is null
  and sf.field_geojson is not null
on conflict do nothing;

update public.satellite_fields sf
set geo_feature_id = f.id
from public.geo_features f
where sf.geo_feature_id is null
  and f.owner_id = sf.user_id
  and f.feature_type = 'farm_boundary'
  and f.properties->>'satellite_field_id' = sf.id::text;

create index if not exists satellite_fields_geo_feature_idx on public.satellite_fields (geo_feature_id);
