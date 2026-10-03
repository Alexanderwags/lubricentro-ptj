-- Ejecutar una vez en el SQL Editor del proyecto Supabase.
-- Después, crear la cuenta de la administradora en Authentication > Users
-- y asociarla a admin_users con el UUID de esa cuenta.

create table if not exists public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null unique check (plate ~ '^([A-Z]{3}[0-9]{3}|[A-Z]{2}[0-9]{3}[A-Z]{2})$'),
  brand text not null check (char_length(trim(brand)) between 1 and 50),
  model text not null check (char_length(trim(model)) between 1 and 50),
  year integer not null check (year between 1900 and 2100),
  customer_name text not null check (
    char_length(trim(customer_name)) between 2 and 80
    and customer_name ~ '^[[:alpha:]]+([ ''-][[:alpha:]]+)*$'
  ),
  phone text not null default '' check (
    phone = '' or (
      char_length(phone) <= 30
      and phone ~ '^[+]?[0-9][0-9 ()-]*$'
      and char_length(regexp_replace(phone, '[^0-9]', '', 'g')) between 8 and 15
    )
  ),
  created_at timestamptz not null default now()
);

create table if not exists public.service_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  service_date date not null,
  current_km integer not null check (current_km >= 0),
  oil_type text not null check (oil_type in ('mineral', 'semisintetico', 'sintetico')),
  filter_oil boolean not null default false,
  filter_air boolean not null default false,
  next_service_km integer not null check (next_service_km > current_km),
  next_service_date date not null check (next_service_date > service_date),
  created_at timestamptz not null default now()
);

create index if not exists service_records_vehicle_date_idx
  on public.service_records (vehicle_id, service_date desc, created_at desc);

alter table public.admin_users enable row level security;
alter table public.vehicles enable row level security;
alter table public.service_records enable row level security;

revoke all on public.admin_users, public.vehicles, public.service_records from anon, authenticated;
grant select on public.admin_users to authenticated;
grant select, insert on public.vehicles, public.service_records to authenticated;

create policy "Administradora consulta su acceso"
  on public.admin_users for select to authenticated
  using (id = (select auth.uid()));

create policy "Administradora consulta vehiculos"
  on public.vehicles for select to authenticated
  using (exists (select 1 from public.admin_users where id = (select auth.uid())));
create policy "Administradora registra vehiculos"
  on public.vehicles for insert to authenticated
  with check (exists (select 1 from public.admin_users where id = (select auth.uid())));

create policy "Administradora consulta servicios"
  on public.service_records for select to authenticated
  using (exists (select 1 from public.admin_users where id = (select auth.uid())));
create policy "Administradora registra servicios"
  on public.service_records for insert to authenticated
  with check (exists (select 1 from public.admin_users where id = (select auth.uid())));

-- Respuesta pública sin nombre ni teléfono del cliente.
create or replace function public.lookup_vehicle(lookup_plate text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_vehicle public.vehicles%rowtype;
  matched_service public.service_records%rowtype;
begin
  if lookup_plate !~ '^([A-Z]{3}[0-9]{3}|[A-Z]{2}[0-9]{3}[A-Z]{2})$' then
    return null;
  end if;

  select * into matched_vehicle
  from public.vehicles where plate = lookup_plate;
  if not found then return null; end if;

  select * into matched_service
  from public.service_records
  where vehicle_id = matched_vehicle.id
  order by service_date desc, created_at desc, id desc limit 1;

  return pg_catalog.jsonb_build_object(
    'vehicle', pg_catalog.jsonb_build_object(
      'plate', matched_vehicle.plate, 'brand', matched_vehicle.brand,
      'model', matched_vehicle.model, 'year', matched_vehicle.year),
    'service', case when matched_service.id is null then null else
      pg_catalog.jsonb_build_object(
        'date', matched_service.service_date,
        'currentKm', matched_service.current_km,
        'oilType', matched_service.oil_type,
        'filterOil', matched_service.filter_oil,
        'filterAir', matched_service.filter_air,
        'nextServiceKm', matched_service.next_service_km,
        'nextServiceDate', matched_service.next_service_date)
      end);
end;
$$;

revoke all on function public.lookup_vehicle(text) from public;
grant execute on function public.lookup_vehicle(text) to anon, authenticated;

-- Reemplaza el UUID por el de Authentication > Users:
-- insert into public.admin_users (id) values ('UUID-DE-LA-ADMINISTRADORA');
