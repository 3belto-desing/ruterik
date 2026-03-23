create extension if not exists pgcrypto;
create extension if not exists postgis;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  role text not null check (role in ('admin', 'dispatcher', 'driver')),
  driver_code text unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'anonymous');
$$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  external_code text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.customer_locations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  label text not null check (label in ('home', 'work', 'temporary')),
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now(),
  unique (customer_id, label)
);

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  route_date date not null default current_date,
  status text not null default 'active' check (status in ('draft', 'active', 'completed', 'cancelled')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  customer_id uuid references public.customers (id),
  location_id uuid references public.customer_locations (id),
  stop_order integer not null,
  customer_name text not null,
  latitude double precision not null,
  longitude double precision not null,
  status text not null default 'pending' check (status in ('pending', 'arrived', 'attempted', 'completed', 'failed')),
  delivered_at timestamptz,
  completed_by uuid references public.profiles (id),
  proof_required boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.driver_assignments (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  driver_id uuid not null references public.profiles (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (route_id, driver_id)
);

create table if not exists public.driver_positions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles (id) on delete cascade,
  route_id uuid references public.routes (id) on delete set null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_m double precision,
  speed_mps double precision,
  heading double precision,
  source text not null default 'mobile',
  recorded_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.driver_current_status (
  driver_id uuid primary key references public.profiles (id) on delete cascade,
  route_id uuid references public.routes (id) on delete set null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_m double precision,
  speed_mps double precision,
  heading double precision,
  source text not null default 'mobile',
  recorded_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  route_stop_id uuid not null references public.route_stops (id) on delete cascade,
  driver_id uuid references public.profiles (id) on delete set null,
  event_type text not null check (event_type in ('arrived', 'completed', 'attempted', 'failed')),
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  proof jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.sync_driver_current_status()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.driver_current_status (
    driver_id,
    route_id,
    latitude,
    longitude,
    accuracy_m,
    speed_mps,
    heading,
    source,
    recorded_at,
    updated_at
  )
  values (
    new.driver_id,
    new.route_id,
    new.latitude,
    new.longitude,
    new.accuracy_m,
    new.speed_mps,
    new.heading,
    new.source,
    new.recorded_at,
    now()
  )
  on conflict (driver_id) do update
  set
    route_id = excluded.route_id,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    accuracy_m = excluded.accuracy_m,
    speed_mps = excluded.speed_mps,
    heading = excluded.heading,
    source = excluded.source,
    recorded_at = excluded.recorded_at,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_driver_current_status on public.driver_positions;
create trigger trg_sync_driver_current_status
after insert on public.driver_positions
for each row execute function public.sync_driver_current_status();

create or replace function public.complete_stop(
  p_driver_id text,
  p_stop_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m double precision default null,
  p_proof jsonb default null
)
returns public.route_stops
language plpgsql
security definer
as $$
declare
  v_stop public.route_stops;
  v_distance_m double precision;
  v_driver_profile_id uuid;
begin
  select id
  into v_driver_profile_id
  from public.profiles
  where driver_code = p_driver_id
     or id::text = p_driver_id;

  if v_driver_profile_id is null then
    raise exception 'Driver not found';
  end if;

  select *
  into v_stop
  from public.route_stops
  where id = p_stop_id
  for update;

  if not found then
    raise exception 'Stop not found';
  end if;

  if v_stop.status = 'completed' then
    return v_stop;
  end if;

  select ST_Distance(
    ST_SetSRID(ST_MakePoint(v_stop.longitude, v_stop.latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  )
  into v_distance_m;

  if v_distance_m > 20 then
    raise exception 'Driver too far from stop: % meters', round(v_distance_m);
  end if;

  update public.route_stops
  set
    status = 'completed',
    delivered_at = now(),
    completed_by = v_driver_profile_id
  where id = p_stop_id
  returning * into v_stop;

  insert into public.delivery_events (
    route_stop_id,
    driver_id,
    event_type,
    latitude,
    longitude,
    accuracy_m,
    proof
  )
  values (
    p_stop_id,
    v_driver_profile_id,
    'completed',
    p_lat,
    p_lng,
    p_accuracy_m,
    p_proof
  );

  return v_stop;
end;
$$;

create or replace function public.clear_active_route()
returns void
language plpgsql
security definer
as $$
begin
  if public.current_app_role() not in ('admin', 'dispatcher') then
    raise exception 'Not authorized';
  end if;

  delete from public.route_stops
  where route_id in (select id from public.routes where status = 'active');
end;
$$;

alter table public.customers enable row level security;
alter table public.customer_locations enable row level security;
alter table public.routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.driver_assignments enable row level security;
alter table public.driver_positions enable row level security;
alter table public.driver_current_status enable row level security;
alter table public.delivery_events enable row level security;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
for select using (auth.uid() = id or public.current_app_role() in ('admin', 'dispatcher'));

drop policy if exists customers_admin_dispatcher_rw on public.customers;
create policy customers_admin_dispatcher_rw on public.customers
for all using (public.current_app_role() in ('admin', 'dispatcher'))
with check (public.current_app_role() in ('admin', 'dispatcher'));

drop policy if exists customer_locations_admin_dispatcher_rw on public.customer_locations;
create policy customer_locations_admin_dispatcher_rw on public.customer_locations
for all using (public.current_app_role() in ('admin', 'dispatcher'))
with check (public.current_app_role() in ('admin', 'dispatcher'));

drop policy if exists routes_admin_dispatcher_rw on public.routes;
create policy routes_admin_dispatcher_rw on public.routes
for all using (public.current_app_role() in ('admin', 'dispatcher'))
with check (public.current_app_role() in ('admin', 'dispatcher'));

drop policy if exists route_stops_read_for_ops on public.route_stops;
create policy route_stops_read_for_ops on public.route_stops
for select using (public.current_app_role() in ('admin', 'dispatcher', 'driver'));

drop policy if exists route_stops_admin_dispatcher_write on public.route_stops;
create policy route_stops_admin_dispatcher_write on public.route_stops
for all using (public.current_app_role() in ('admin', 'dispatcher'))
with check (public.current_app_role() in ('admin', 'dispatcher'));

drop policy if exists driver_assignments_read_for_ops on public.driver_assignments;
create policy driver_assignments_read_for_ops on public.driver_assignments
for select using (public.current_app_role() in ('admin', 'dispatcher') or driver_id = auth.uid());

drop policy if exists driver_assignments_admin_dispatcher_write on public.driver_assignments;
create policy driver_assignments_admin_dispatcher_write on public.driver_assignments
for all using (public.current_app_role() in ('admin', 'dispatcher'))
with check (public.current_app_role() in ('admin', 'dispatcher'));

drop policy if exists driver_positions_insert_own on public.driver_positions;
create policy driver_positions_insert_own on public.driver_positions
for insert with check (public.current_app_role() = 'driver' and driver_id = auth.uid());

drop policy if exists driver_positions_read_for_ops on public.driver_positions;
create policy driver_positions_read_for_ops on public.driver_positions
for select using (public.current_app_role() in ('admin', 'dispatcher') or driver_id = auth.uid());

drop policy if exists driver_current_status_read_for_ops on public.driver_current_status;
create policy driver_current_status_read_for_ops on public.driver_current_status
for select using (public.current_app_role() in ('admin', 'dispatcher') or driver_id = auth.uid());

drop policy if exists delivery_events_read_for_ops on public.delivery_events;
create policy delivery_events_read_for_ops on public.delivery_events
for select using (public.current_app_role() in ('admin', 'dispatcher') or driver_id = auth.uid());

grant execute on function public.complete_stop(text, uuid, double precision, double precision, double precision, jsonb) to authenticated;
grant execute on function public.clear_active_route() to authenticated;
