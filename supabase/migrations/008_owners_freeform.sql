-- 008: Owners work like Assignees: names managed by admins in Settings, no admin-email requirement.
-- (Supersedes the admin-only restriction from 005.)
drop trigger if exists owners_guard_t on public.owners;
drop trigger if exists admin_emails_ad on public.admin_emails;

create unique index if not exists owners_name_lower_uidx on public.owners (lower(name));

create or replace function public.is_valid_owner(owner_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.owners where name = owner_name and active);
$$;

-- Signed-in users read the active list (feedback form dropdown); admins read everything.
drop policy if exists owners_read_active on public.owners;
create policy owners_read_active on public.owners for select to authenticated
  using (active);
