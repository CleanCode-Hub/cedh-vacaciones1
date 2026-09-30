-- Ejecutar UNA vez en Supabase SQL Editor.
-- Permite desactivar usuarios sin borrar solicitudes ni historiales de años anteriores.
alter table public.profiles
  add column if not exists active boolean not null default true;

update public.profiles
set active = true
where active is null;

alter table public.profiles
  add column if not exists email text;

update public.profiles as profile
set email = auth_user.email
from auth.users as auth_user
where profile.id = auth_user.id
  and profile.email is null;

create unique index if not exists profiles_email_unique
  on public.profiles (lower(email));
