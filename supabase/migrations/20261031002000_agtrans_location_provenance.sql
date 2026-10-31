-- Track the provenance and freshness of AGTrans driver GPS positions.
alter table public.tracking_sessions
  add column if not exists last_location_at timestamptz,
  add column if not exists location_accuracy_m numeric,
  add column if not exists location_source text not null default 'unverified',
  add column if not exists is_simulated boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tracking_sessions'::regclass
      and conname = 'tracking_sessions_location_source_check'
  ) then
    alter table public.tracking_sessions
      add constraint tracking_sessions_location_source_check
      check (location_source in ('unverified','device_gps','network_gps','simulated'));
  end if;
end $$;

create index if not exists tracking_sessions_last_location_idx
  on public.tracking_sessions (last_location_at desc)
  where location_source in ('device_gps','network_gps');

-- Previously seeded sessions may contain a pickup marker or a hard-coded
-- default point. They are retained as legacy records but never marked verified.
update public.tracking_sessions
set location_source = 'unverified',
    last_location_at = null,
    location_accuracy_m = null,
    is_simulated = false
where last_location_at is null;
