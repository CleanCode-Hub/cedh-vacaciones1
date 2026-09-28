begin;
alter table public.vacation_requests
 add column if not exists cancellation_resolved_by uuid references public.profiles(id),
 add column if not exists cancellation_resolved_at timestamptz,
 add column if not exists cancellation_resolution_reason text;

create or replace function public.admin_cancel_vacation_request(p_request_id uuid,p_reason text,p_expected_status text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.vacation_requests; first_day date;
begin
 if auth.uid() is null or not public.portal_account_active() or public.current_role()::text is distinct from 'admin' then raise exception 'No autorizado'; end if;
 select * into r from public.vacation_requests where id=p_request_id for update;
 if not found or r.area_id is distinct from public.current_area() then raise exception 'Solo puedes cancelar solicitudes de tu área'; end if;
 if r.status::text not in ('pending','approved','cancellation_pending') or r.status::text is distinct from p_expected_status then raise exception 'El estado cambió. Actualiza la pantalla'; end if;
 select min(vacation_date) into first_day from public.request_days where request_id=r.id;
 if first_day is null or first_day <= (clock_timestamp() at time zone 'America/Monterrey')::date then raise exception 'No se pueden cancelar vacaciones iniciadas o terminadas'; end if;
 if coalesce(length(trim(p_reason)),0) not between 1 and 1000 then raise exception 'El motivo requiere entre 1 y 1000 caracteres'; end if;
 update public.vacation_requests set status='cancelled',
 cancellation_reason=case when r.status::text='cancellation_pending' then r.cancellation_reason else trim(p_reason) end,
 cancellation_requested_by=case when r.status::text='cancellation_pending' then r.cancellation_requested_by else auth.uid() end,
 cancellation_requested_at=case when r.status::text='cancellation_pending' then r.cancellation_requested_at else clock_timestamp() end,
 cancellation_previous_status=case when r.status::text='cancellation_pending' then r.cancellation_previous_status else r.status::text end,
 cancellation_resolved_by=auth.uid(),cancellation_resolved_at=clock_timestamp(),cancellation_resolution_reason=trim(p_reason)
 where id=r.id;
end $$;
revoke all on function public.admin_cancel_vacation_request(uuid,text,text) from public;
grant execute on function public.admin_cancel_vacation_request(uuid,text,text) to authenticated;

create or replace function public.remove_empty_area(p_area_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.portal_account_active() or public.current_role()::text is distinct from 'superuser' then raise exception 'Solo el superusuario puede quitar áreas'; end if;
 perform 1 from public.areas where id=p_area_id for update;
 if not found then raise exception 'El área ya no existe'; end if;
 if exists(select 1 from public.profiles where area_id=p_area_id) then raise exception 'El área tiene usuarios asignados, incluso desactivados. Reasígnalos primero'; end if;
 if exists(select 1 from public.udi_people where area_id=p_area_id) then raise exception 'El área tiene personal de RH asignado. Reasígnalo primero'; end if;
 if exists(select 1 from public.vacation_requests where area_id=p_area_id) then raise exception 'El área tiene historial de vacaciones y debe conservarse'; end if;
 delete from public.areas where id=p_area_id;
end $$;
revoke all on function public.remove_empty_area(uuid) from public;
grant execute on function public.remove_empty_area(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
