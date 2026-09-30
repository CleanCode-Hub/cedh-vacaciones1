-- Ejecutar DESPUÉS del esquema y de udi-02-estructura.sql.
-- No reactiva ni desactiva cuentas existentes.
begin;
alter table public.profiles add column if not exists active boolean not null default true;
create or replace function public.portal_account_active()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active is true)
$$;
revoke all on function public.portal_account_active() from public;
grant execute on function public.portal_account_active() to authenticated;
create or replace function public.current_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
 select role from public.profiles where id=auth.uid() and active is true
$$;
create or replace function public.current_area()
returns uuid language sql stable security definer set search_path = '' as $$
 select area_id from public.profiles where id=auth.uid() and active is true
$$;
-- Restrictiva: se combina con AND, también para políticas basadas solo en auth.uid().
do $$ declare t text; begin
 foreach t in array array['profiles','areas','holidays','vacation_periods','vacation_requests','request_days','approval_audit','udi_people','udi_changes'] loop
  if to_regclass('public.'||t) is not null then
   execute format('alter table public.%I enable row level security',t);
   execute format('drop policy if exists "Active portal account required" on public.%I',t);
   execute format('create policy "Active portal account required" on public.%I as restrictive for all to authenticated using (public.portal_account_active()) with check (public.portal_account_active())',t);
  end if;
 end loop;
end $$;
-- Proteger todos los superusuarios evita también carreras al retirar el último.
create or replace function public.protect_portal_account()
returns trigger language plpgsql set search_path = '' as $$
begin
 if tg_op='DELETE' then
  if old.id=auth.uid() or old.role::text='superuser' then
   raise exception 'No se puede eliminar la cuenta propia ni un superusuario';
  end if;
  return old;
 end if;
 if (old.id=auth.uid() and new.active is not true)
    or (old.role::text='superuser' and (new.active is not true or new.role is distinct from old.role)) then
  raise exception 'No se puede desactivar la cuenta propia ni retirar un superusuario';
 end if;
 return new;
end $$;
drop trigger if exists protect_portal_account on public.profiles;
create trigger protect_portal_account before update or delete on public.profiles
for each row execute function public.protect_portal_account();
-- SECURITY DEFINER omite RLS: validar explícitamente y rechazar NULL.
create or replace function public.review_vacation_request(p_request_id uuid, p_approved boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_request public.vacation_requests;
begin
 if not public.portal_account_active() or public.current_role() is distinct from 'admin'::public.app_role then raise exception 'No autorizado'; end if;
 select * into v_request from public.vacation_requests where id=p_request_id for update;
 if not found then raise exception 'Solicitud no encontrada'; end if;
 if v_request.area_id is distinct from public.current_area() then raise exception 'No autorizado'; end if;
 if v_request.status <> 'pending' then raise exception 'La solicitud ya fue revisada'; end if;
 if p_approved is null then raise exception 'Decisión no válida'; end if;
 if not p_approved and coalesce(trim(p_reason),'')='' then raise exception 'El rechazo requiere un motivo'; end if;
 update public.vacation_requests set status=(case when p_approved then 'approved' else 'rejected' end)::public.request_status,reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=case when p_approved then null else trim(p_reason) end where id=p_request_id;
 insert into public.approval_audit(request_id,actor_id,action,reason) values(p_request_id,auth.uid(),case when p_approved then 'approved' else 'rejected' end,case when p_approved then null else trim(p_reason) end);
end $$;
revoke all on function public.review_vacation_request(uuid,boolean,text) from public;
grant execute on function public.review_vacation_request(uuid,boolean,text) to authenticated;
commit;
