-- Shared device gateway for AgroClimate components other than Post-Harvest.
-- Post-Harvest retains its existing station registry, credential store and ingestion path.
-- This registry stores device metadata only; raw credentials are isolated below.

create table if not exists public.agroclimate_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  component text not null check (component in (
    'farm-handler','agro-inventory','market-link','agtrans',
    'agroforecast','agrorisk','aerial-console','satellite'
  )),
  device_name text not null check (char_length(trim(device_name)) between 1 and 100),
  hardware_id text not null check (char_length(trim(hardware_id)) between 1 and 160),
  manufacturer text,
  model text,
  firmware_version text,
  protocol text not null check (protocol in (
    'browser-camera','browser-geolocation','ble-gatt','usb-hid','usb-serial',
    'https-api','mqtt-tls','mavlink','vendor-sdk','satellite-api','manual'
  )),
  capabilities jsonb not null default '[]'::jsonb check (jsonb_typeof(capabilities) = 'array'),
  farm_id text,
  site_id text,
  status text not null default 'active' check (status in ('active','revoked')),
  last_seen_at timestamptz,
  calibration_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, component, hardware_id)
);

create table if not exists public.agroclimate_device_credentials (
  device_id uuid primary key references public.agroclimate_devices(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.agroclimate_device_observations (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.agroclimate_devices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  component text not null check (component in (
    'farm-handler','agro-inventory','market-link','agtrans',
    'agroforecast','agrorisk','aerial-console','satellite'
  )),
  metric text not null check (char_length(trim(metric)) between 1 and 64),
  value double precision not null check (value > '-Infinity'::double precision and value < 'Infinity'::double precision),
  unit text not null check (char_length(trim(unit)) between 1 and 24),
  observed_at timestamptz not null,
  received_at timestamptz not null default now(),
  idempotency_key text not null check (char_length(trim(idempotency_key)) between 1 and 160),
  farm_id text,
  site_id text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (device_id, idempotency_key),
  check ((latitude is null) = (longitude is null))
);

alter table public.agroclimate_devices enable row level security;
alter table public.agroclimate_device_credentials enable row level security;
alter table public.agroclimate_device_observations enable row level security;

drop policy if exists "Owners read AgroClimate devices" on public.agroclimate_devices;
create policy "Owners read AgroClimate devices" on public.agroclimate_devices
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Owners read AgroClimate device observations" on public.agroclimate_device_observations;
create policy "Owners read AgroClimate device observations" on public.agroclimate_device_observations
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.agroclimate_device_credentials from public, anon, authenticated;
grant select on public.agroclimate_devices to authenticated;
grant select on public.agroclimate_device_observations to authenticated;
grant all on public.agroclimate_devices to service_role;
grant all on public.agroclimate_device_credentials to service_role;
grant all on public.agroclimate_device_observations to service_role;

create index if not exists agroclimate_devices_owner_component_idx
  on public.agroclimate_devices(user_id, component, created_at desc);
create index if not exists agroclimate_device_observations_owner_time_idx
  on public.agroclimate_device_observations(user_id, component, observed_at desc);
create index if not exists agroclimate_device_observations_device_time_idx
  on public.agroclimate_device_observations(device_id, observed_at desc);

create or replace function public.update_agroclimate_device_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_agroclimate_device_updated_at on public.agroclimate_devices;
create trigger update_agroclimate_device_updated_at
  before update on public.agroclimate_devices
  for each row execute function public.update_agroclimate_device_updated_at();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'agroclimate_devices') then
      alter publication supabase_realtime add table public.agroclimate_devices;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'agroclimate_device_observations') then
      alter publication supabase_realtime add table public.agroclimate_device_observations;
    end if;
  end if;
end $$;
