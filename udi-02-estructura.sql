-- Ejecutar después de udi-01-rol.sql. No borra solicitudes ni cuentas.
begin;
alter table public.profiles add column if not exists active boolean not null default true;

create or replace function public.can_manage_udi()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid()
    and active and role::text in ('udi', 'superuser'));
$$;
revoke all on function public.can_manage_udi() from public;
grant execute on function public.can_manage_udi() to authenticated;

create table if not exists public.udi_people (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete restrict,
  full_name text not null check(length(trim(full_name)) between 1 and 160),
  area_id uuid references public.areas(id) on delete restrict,
  biotime_id text unique check(biotime_id is null or length(trim(biotime_id)) between 1 and 80),
  source text not null default 'manual' check(source in ('manual','portal','biotime')),
  schedule text check(schedule in ('08-16','09-17','10-18','flex','exempt')),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists udi_people_area on public.udi_people(area_id);
alter table public.udi_people enable row level security;
revoke all on public.udi_people from anon, authenticated;
grant select on public.udi_people to authenticated;
drop policy if exists "UDI reads staff" on public.udi_people;
create policy "UDI reads staff" on public.udi_people for select to authenticated using(public.can_manage_udi());

-- Incorporar cuentas existentes y mantener nombre, área y estado sincronizados.
insert into public.udi_people(profile_id,full_name,area_id,source,active)
select id,full_name,area_id,'portal',active from public.profiles where role::text in ('employee','admin')
on conflict(profile_id) do nothing;
create or replace function public.sync_udi_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role::text in ('employee','admin') then
    insert into public.udi_people(profile_id,full_name,area_id,source,active)
    values(new.id,new.full_name,new.area_id,'portal',new.active)
    on conflict(profile_id) do update set full_name=excluded.full_name,
      area_id=excluded.area_id,active=excluded.active,updated_at=now();
  else
    update public.udi_people set active=false,updated_at=now() where profile_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_udi_profile() from public;
drop trigger if exists sync_udi_profile on public.profiles;
create trigger sync_udi_profile after insert or update on public.profiles
for each row execute function public.sync_udi_profile();

create table if not exists public.udi_changes (
  id bigint generated always as identity primary key,
  person_id uuid not null references public.udi_people(id),
  actor_id uuid not null references public.profiles(id),
  before_data jsonb, after_data jsonb not null, changed_at timestamptz not null default now()
);
alter table public.udi_changes enable row level security;
revoke all on public.udi_changes from anon,authenticated;
grant select on public.udi_changes to authenticated;
drop policy if exists "UDI reads changes" on public.udi_changes;
create policy "UDI reads changes" on public.udi_changes for select to authenticated using(public.can_manage_udi());

create or replace function public.udi_save_person(
  p_id uuid, p_name text, p_area uuid, p_schedule text, p_biotime_id text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_old public.udi_people; v_new public.udi_people;
begin
  if not public.can_manage_udi() then raise exception 'No autorizado'; end if;
  if coalesce(length(trim(p_name)),0) not between 1 and 160 then raise exception 'Revisa el nombre'; end if;
  if p_schedule is not null and p_schedule not in ('08-16','09-17','10-18','flex','exempt') then raise exception 'Horario no válido'; end if;
  if p_id is null then
    insert into public.udi_people(full_name,area_id,schedule,biotime_id)
    values(trim(p_name),p_area,p_schedule,nullif(trim(p_biotime_id),'')) returning * into v_new;
  else
    select * into v_old from public.udi_people where id=p_id for update;
    if not found or not v_old.active then raise exception 'Persona no disponible'; end if;
    if v_old.profile_id is not null then
      -- Conserva roles y solicitudes históricas; actualiza el área para solicitudes nuevas.
      update public.profiles set area_id=p_area where id=v_old.profile_id;
    end if;
    update public.udi_people set full_name=case when profile_id is null then trim(p_name) else v_old.full_name end,
      area_id=p_area,schedule=p_schedule,biotime_id=nullif(trim(p_biotime_id),''),updated_at=now()
      where id=p_id returning * into v_new;
  end if;
  insert into public.udi_changes(person_id,actor_id,before_data,after_data)
  values(v_new.id,auth.uid(),case when p_id is null then null else to_jsonb(v_old) end,to_jsonb(v_new));
  return v_new.id;
end;
$$;
revoke all on function public.udi_save_person(uuid,text,uuid,text,text) from public;
grant execute on function public.udi_save_person(uuid,text,uuid,text,text) to authenticated;

create or replace function public.udi_create_area(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.can_manage_udi() then raise exception 'No autorizado'; end if;
  if coalesce(length(trim(p_name)),0) not between 1 and 100 then raise exception 'Revisa el nombre del área'; end if;
  if exists(select 1 from public.areas where lower(name)=lower(trim(p_name))) then raise exception 'El área ya existe'; end if;
  insert into public.areas(name) values(trim(p_name)) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.udi_create_area(text) from public;
grant execute on function public.udi_create_area(text) to authenticated;

-- UDI consulta vacaciones para el dashboard, sin aprobar ni cambiar roles.
drop policy if exists "UDI reads requests" on public.vacation_requests;
create policy "UDI reads requests" on public.vacation_requests for select to authenticated using(public.can_manage_udi());
drop policy if exists "UDI reads days" on public.request_days;
create policy "UDI reads days" on public.request_days for select to authenticated using(public.can_manage_udi());
drop policy if exists "UDI reads audit" on public.approval_audit;
create policy "UDI reads audit" on public.approval_audit for select to authenticated using(public.can_manage_udi());
commit;
