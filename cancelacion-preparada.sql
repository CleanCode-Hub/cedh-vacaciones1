-- PREPARADO, NO EJECUTADO. Requiere esquema existente y seguridad-acceso-20260922.sql.
-- Ejecutar la sección 1 y confirmar su transacción antes de ejecutar la sección 2.
-- SECCIÓN 1
alter type public.request_status add value if not exists 'cancelled';
alter type public.request_status add value if not exists 'cancellation_pending';

-- SECCIÓN 2 (en una ejecución posterior a la sección 1)
begin;
alter table public.vacation_requests
 add column if not exists cancellation_reason text,
 add column if not exists cancellation_requested_by uuid references public.profiles(id),
 add column if not exists cancellation_requested_at timestamptz,
 add column if not exists cancellation_previous_status text;

create or replace function public.cancel_vacation_request(
 p_request_id uuid, p_reason text default null, p_expected_status text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare r public.vacation_requests; first_day date;
begin
 if auth.uid() is null or not public.portal_account_active()
    or public.current_role()::text is distinct from 'employee' then
  raise exception 'No autorizado';
 end if;
 select * into r from public.vacation_requests where id=p_request_id for update;
 if not found or r.employee_id is distinct from auth.uid() then raise exception 'Solicitud no disponible'; end if;
 if r.status::text not in ('pending','approved') or r.status::text is distinct from p_expected_status then
  raise exception 'El estado cambió. Actualiza la pantalla antes de continuar';
 end if;
 select min(vacation_date) into first_day from public.request_days where request_id=r.id;
 if first_day is null or first_day <= (clock_timestamp() at time zone 'America/Monterrey')::date then
  raise exception 'No puedes cancelar vacaciones iniciadas o terminadas';
 end if;
 if length(trim(p_reason)) > 1000 then raise exception 'El motivo excede 1000 caracteres'; end if;
 update public.vacation_requests set
  status=(case when r.status::text='pending' then 'cancelled' else 'cancellation_pending' end)::public.request_status,
  cancellation_reason=nullif(trim(p_reason),''), cancellation_requested_by=auth.uid(),
  cancellation_requested_at=clock_timestamp(), cancellation_previous_status=r.status::text
 where id=r.id;
end $$;
revoke all on function public.cancel_vacation_request(uuid,text,text) from public;
grant execute on function public.cancel_vacation_request(uuid,text,text) to authenticated;
commit;

-- No se habilitan escrituras directas del colaborador ni se eliminan registros.
-- La autorización final de cancelaciones por RH/jefe es una etapa posterior.
