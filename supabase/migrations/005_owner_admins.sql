-- 005: Owners must be administrators. Users can pick an owner on the feedback form.
alter table public.owners add column if not exists email text;
create unique index if not exists owners_email_uidx on public.owners (lower(email)) where email is not null;

create or replace function public.is_valid_owner(owner_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.owners o
    join public.admin_emails a on lower(a.email) = lower(o.email)
    where o.name = owner_name and o.active and o.email is not null
  );
$$;

-- Only emails on the admin allow-list can become owners; the name comes from the admin's profile.
create or replace function public.owners_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare pname text;
begin
  if auth.uid() is null then return new; end if;  -- direct SQL (service role)
  if new.email is not null then new.email := lower(trim(new.email)); end if;
  if tg_op = 'INSERT' or new.email is distinct from old.email or (new.active and not old.active) then
    if new.email is null or not exists (select 1 from public.admin_emails where lower(email) = new.email) then
      raise exception 'Only users with admin access can be owners.' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'INSERT' or new.email is distinct from old.email then
    select nullif(trim(name), '') into pname from public.profiles where lower(email) = new.email;
    new.name := coalesce(pname, new.email);
  end if;
  return new;
end;
$$;
drop trigger if exists owners_guard_t on public.owners;
create trigger owners_guard_t before insert or update on public.owners
  for each row execute function public.owners_guard();

-- Removing admin access removes the person from the owner list.
create or replace function public.admin_removed_deactivate_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.owners set active = false where lower(email) = lower(old.email);
  return old;
end;
$$;
drop trigger if exists admin_emails_ad on public.admin_emails;
create trigger admin_emails_ad after delete on public.admin_emails
  for each row execute function public.admin_removed_deactivate_owner();

-- Signed-in users may read the active admin owners (needed for the form dropdown).
drop policy if exists owners_read_active on public.owners;
create policy owners_read_active on public.owners for select to authenticated
  using (active and email is not null);

-- Feedback: the reporter may choose an owner, but only an active admin owner.
create or replace function public.feedback_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
  shot_required boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  select * into p from public.profiles where id = auth.uid();
  if p.id is null then
    raise exception 'Profile not found for current user.' using errcode = '42501';
  end if;

  new.reported_by       := p.id;
  new.reported_by_name  := p.name;
  new.reported_by_email := p.email;
  new.status            := 'New';
  new.resolution        := null;
  new.admin_comments    := null;
  new.date_completed    := null;
  new.date_reported     := now();
  new.created_at        := now();
  new.updated_at        := now();

  if new.owner is not null and not public.is_valid_owner(new.owner) then
    raise exception 'Owner must be a user with admin access.' using errcode = '23514';
  end if;

  if new.business is null then
    raise exception 'Business is required.' using errcode = '23514';
  end if;

  select coalesce((value)::boolean, true) into shot_required from public.app_config where key = 'screenshot_required';
  if coalesce(shot_required, true) and new.screenshot_path is null then
    raise exception 'A screenshot is required.' using errcode = '23514';
  end if;
  if new.screenshot_path is not null and split_part(new.screenshot_path, '/', 1) <> p.id::text then
    raise exception 'Invalid screenshot path.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.feedback_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if (to_jsonb(new) - 'user_comments' - 'updated_at') is distinct from (to_jsonb(old) - 'user_comments' - 'updated_at') then
      raise exception 'You are not allowed to modify these fields.' using errcode = '42501';
    end if;
  end if;

  if auth.uid() is not null and new.owner is not null and new.owner is distinct from old.owner
     and not public.is_valid_owner(new.owner) then
    raise exception 'Owner must be a user with admin access.' using errcode = '23514';
  end if;

  new.id                := old.id;
  new.feedback_number   := old.feedback_number;
  new.reported_by       := old.reported_by;
  new.reported_by_name  := old.reported_by_name;
  new.reported_by_email := old.reported_by_email;
  new.date_reported     := old.date_reported;
  new.created_at        := old.created_at;

  if new.status = 'Completed' and old.status is distinct from 'Completed' then
    new.date_completed := now();
  elsif new.status is distinct from 'Completed' then
    new.date_completed := old.date_completed;
  else
    new.date_completed := coalesce(old.date_completed, now());
  end if;

  new.updated_at := now();
  return new;
end;
$$;
