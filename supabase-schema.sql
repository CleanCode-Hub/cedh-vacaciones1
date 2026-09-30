-- Portal de vacaciones CEDH
-- Ejecutar en Supabase: SQL Editor > New query.

create extension if not exists pgcrypto;

create type public.app_role as enum ('superuser', 'admin', 'employee');
create type public.request_status as enum ('pending', 'approved', 'rejected');

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique,
  role public.app_role not null default 'employee',
  area_id uuid references public.areas(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index one_admin_per_area
  on public.profiles(area_id) where role = 'admin';

create table public.vacation_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  business_days integer not null check (business_days > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table public.holidays (
  holiday_date date primary key,
  description text,
  created_at timestamptz not null default now()
);

create table public.vacation_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete restrict,
  area_id uuid not null references public.areas(id) on delete restrict,
  period_id uuid not null references public.vacation_periods(id) on delete restrict,
  note text,
  status public.request_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  check ((status = 'rejected' and rejection_reason is not null) or status <> 'rejected')
);

create table public.request_days (
  request_id uuid not null references public.vacation_requests(id) on delete cascade,
  vacation_date date not null,
  primary key (request_id, vacation_date)
);

create table public.approval_audit (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.vacation_requests(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('approved', 'rejected')),
  reason text,
  created_at timestamptz not null default now()
);

-- Funciones internas para políticas RLS (evitan confiar en valores del navegador).
create or replace function public.current_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_area()
returns uuid language sql stable security definer set search_path = public as $$
  select area_id from public.profiles where id = auth.uid()
$$;

grant execute on function public.current_role() to authenticated;
grant execute on function public.current_area() to authenticated;

alter table public.areas enable row level security;
alter table public.profiles enable row level security;
alter table public.vacation_periods enable row level security;
alter table public.holidays enable row level security;
alter table public.vacation_requests enable row level security;
alter table public.request_days enable row level security;
alter table public.approval_audit enable row level security;

-- Permite que la aplicación autenticada llegue a las tablas.
-- Las políticas RLS de abajo siguen siendo las que deciden qué puede ver o modificar cada rol.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy "Authenticated users can read reference data" on public.areas for select to authenticated using (true);
create policy "Authenticated users can read periods" on public.vacation_periods for select to authenticated using (true);
create policy "Authenticated users can read holidays" on public.holidays for select to authenticated using (true);
create policy "Users can read their own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.current_role() = 'superuser');
create policy "Superusers manage profiles" on public.profiles for all to authenticated using (public.current_role() = 'superuser') with check (public.current_role() = 'superuser');
create policy "Superusers manage areas" on public.areas for all to authenticated using (public.current_role() = 'superuser') with check (public.current_role() = 'superuser');
create policy "Superusers manage periods" on public.vacation_periods for all to authenticated using (public.current_role() = 'superuser') with check (public.current_role() = 'superuser');
create policy "Superusers manage holidays" on public.holidays for all to authenticated using (public.current_role() = 'superuser') with check (public.current_role() = 'superuser');

create policy "Employees see their requests" on public.vacation_requests for select to authenticated using (employee_id = auth.uid() or (public.current_role() = 'admin' and area_id = public.current_area()) or public.current_role() = 'superuser');
create policy "Employees create own requests" on public.vacation_requests for insert to authenticated with check (employee_id = auth.uid() and area_id = public.current_area() and status = 'pending');
create policy "Admins review their area" on public.vacation_requests for update to authenticated using (public.current_role() = 'admin' and area_id = public.current_area() and status = 'pending') with check (public.current_role() = 'admin' and area_id = public.current_area());
create policy "Superusers manage requests" on public.vacation_requests for all to authenticated using (public.current_role() = 'superuser') with check (public.current_role() = 'superuser');

create policy "Request days follow request access" on public.request_days for select to authenticated using (exists (select 1 from public.vacation_requests r where r.id = request_id and (r.employee_id = auth.uid() or (public.current_role() = 'admin' and r.area_id = public.current_area()) or public.current_role() = 'superuser')));
create policy "Employees add days to own pending request" on public.request_days for insert to authenticated with check (exists (select 1 from public.vacation_requests r where r.id = request_id and r.employee_id = auth.uid() and r.status = 'pending'));
create policy "Audit is visible by scope" on public.approval_audit for select to authenticated using (exists (select 1 from public.vacation_requests r where r.id = request_id and (r.employee_id = auth.uid() or (public.current_role() = 'admin' and r.area_id = public.current_area()) or public.current_role() = 'superuser')));
create policy "Admins add audit entries" on public.approval_audit for insert to authenticated with check (actor_id = auth.uid() and public.current_role() = 'admin');

-- Validación de días hábiles y transición de aprobación en la base de datos.
create or replace function public.review_vacation_request(p_request_id uuid, p_approved boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_request public.vacation_requests;
begin
  select * into v_request from public.vacation_requests where id = p_request_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if public.current_role() <> 'admin' or v_request.area_id <> public.current_area() then raise exception 'No autorizado'; end if;
  if v_request.status <> 'pending' then raise exception 'La solicitud ya fue revisada'; end if;
  if not p_approved and coalesce(trim(p_reason), '') = '' then raise exception 'El rechazo requiere un motivo'; end if;
  update public.vacation_requests set status = (case when p_approved then 'approved' else 'rejected' end)::public.request_status, reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = case when p_approved then null else trim(p_reason) end where id = p_request_id;
  insert into public.approval_audit(request_id, actor_id, action, reason) values (p_request_id, auth.uid(), case when p_approved then 'approved' else 'rejected' end, case when p_approved then null else trim(p_reason) end);
end;
$$;

revoke all on function public.review_vacation_request(uuid, boolean, text) from public;
grant execute on function public.review_vacation_request(uuid, boolean, text) to authenticated;
