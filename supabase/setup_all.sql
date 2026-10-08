-- WFO Digital Cockpit Feedback — schema, triggers and functions.
-- Run migrations in order (001 -> 003) in the Supabase SQL editor or via `supabase db push`.


-- ---------------------------------------------------------------------------
-- Configuration tables
-- ---------------------------------------------------------------------------

-- Admin allow-list. Controlled ONLY in the database (never in frontend code).
create table if not exists public.admin_emails (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

create table if not exists public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_config (key, value) values ('screenshot_required', 'true'::jsonb)
  on conflict (key) do nothing;

create table if not exists public.owners (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(trim(name)) > 0),
  active     boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
insert into public.owners (name, sort_order) values
  ('Developer', 1), ('BI Developer', 2), ('Data Team', 3), ('UI Team', 4),
  ('Backend Team', 5), ('QA', 6), ('Other', 7)
  on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Profiles (role lives here, set only by database triggers)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  name       text not null default '',
  role       text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    case when exists (select 1 from public.admin_emails a where a.email = lower(new.email))
         then 'admin' else 'user' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep roles in sync with the admin allow-list.
create or replace function public.sync_admin_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set role = 'admin' where lower(email) = new.email;
    return new;
  else
    if auth.uid() is not null and exists (
      select 1 from public.profiles where id = auth.uid() and lower(email) = old.email
    ) then
      raise exception 'You cannot remove your own admin access.' using errcode = '42501';
    end if;
    update public.profiles set role = 'user' where lower(email) = old.email;
    return old;
  end if;
end;
$$;

drop trigger if exists admin_emails_sync on public.admin_emails;
create trigger admin_emails_sync after insert or delete on public.admin_emails
  for each row execute function public.sync_admin_role();

-- Backfill profiles for users that existed before this migration.
insert into public.profiles (id, email, name, role)
select u.id, u.email, split_part(u.email, '@', 1),
       case when exists (select 1 from public.admin_emails a where a.email = lower(u.email)) then 'admin' else 'user' end
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Feedback
-- ---------------------------------------------------------------------------

create sequence if not exists public.feedback_number_seq;

create table if not exists public.feedback (
  id                 uuid primary key default gen_random_uuid(),
  feedback_number    text not null unique default ('WF-' || lpad(nextval('public.feedback_number_seq')::text, 4, '0')),
  component_category text not null default 'Other' check (component_category in (
    'KPI Card','Chart','Graph','Table','Filter','Slicer','Dashboard Header','Navigation','Tooltip','Other')),
  card_graph_name    text not null check (length(trim(card_graph_name)) > 0),
  feedback_type      text not null check (feedback_type in (
    'Data Issue','Calculation Issue','UI Issue','Layout Issue','Label Issue',
    'Filter Issue','Performance Issue','Functional Issue','Enhancement','Other')),
  changes_required   text not null check (length(trim(changes_required)) > 0),
  screenshot_path    text,
  reported_by        uuid not null references public.profiles (id) on delete restrict,
  reported_by_name   text not null default '',
  reported_by_email  text not null default '',
  priority           text not null default 'Medium' check (priority in ('Critical','High','Medium','Low')),
  owner              text,
  status             text not null default 'New' check (status in (
    'New','Under Review','In Progress','Blocked','Completed','Rejected')),
  date_reported      timestamptz not null default now(),
  date_completed     timestamptz,
  resolution         text,
  admin_comments     text,
  user_comments      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.feedback add column if not exists business text
  check (business in ('Remote','Field','Care','BPA'));

create index if not exists feedback_business_idx on public.feedback (business);
create index if not exists feedback_reported_by_idx  on public.feedback (reported_by, date_reported desc);
create index if not exists feedback_status_idx       on public.feedback (status);
create index if not exists feedback_priority_idx     on public.feedback (priority);
create index if not exists feedback_owner_idx        on public.feedback (owner);
create index if not exists feedback_type_idx         on public.feedback (feedback_type);
create index if not exists feedback_date_reported_idx on public.feedback (date_reported desc);

create table if not exists public.feedback_history (
  history_id    uuid primary key default gen_random_uuid(),
  feedback_id   uuid not null references public.feedback (id) on delete cascade,
  changed_by    uuid references public.profiles (id) on delete set null,
  changed_at    timestamptz not null default now(),
  field_changed text not null,
  old_value     text,
  new_value     text
);
create index if not exists feedback_history_feedback_idx on public.feedback_history (feedback_id, changed_at desc);

-- BEFORE INSERT: the database, not the client, decides identity and workflow fields.
create or replace function public.feedback_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
  shot_required boolean;
begin
  -- Direct SQL (postgres/service role, e.g. demo seed) has no JWT; keep the supplied values.
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
  new.owner             := null;
  new.resolution        := null;
  new.admin_comments    := null;
  new.date_completed    := null;
  new.date_reported     := now();
  new.created_at        := now();
  new.updated_at        := now();

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

drop trigger if exists feedback_bi on public.feedback;
create trigger feedback_bi before insert on public.feedback
  for each row execute function public.feedback_before_insert();

-- BEFORE UPDATE: field-level authorization + Date Completed logic.
create or replace function public.feedback_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    -- Regular users may only change their own follow-up comment.
    if (to_jsonb(new) - 'user_comments' - 'updated_at') is distinct from (to_jsonb(old) - 'user_comments' - 'updated_at') then
      raise exception 'You are not allowed to modify these fields.' using errcode = '42501';
    end if;
  end if;

  -- Immutable columns, even for admins.
  new.id                := old.id;
  new.feedback_number   := old.feedback_number;
  new.reported_by       := old.reported_by;
  new.reported_by_name  := old.reported_by_name;
  new.reported_by_email := old.reported_by_email;
  new.date_reported     := old.date_reported;
  new.created_at        := old.created_at;

  -- Set Date Completed on transition into Completed. Reopening keeps the previous
  -- value (the audit trail records every status change); it is refreshed on re-completion.
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

drop trigger if exists feedback_bu on public.feedback;
create trigger feedback_bu before update on public.feedback
  for each row execute function public.feedback_before_update();

-- AFTER UPDATE: audit history.
create or replace function public.feedback_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  f text;
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
begin
  foreach f in array array['status','owner','priority','resolution','admin_comments',
                           'card_graph_name','feedback_type','changes_required','user_comments']
  loop
    if (o ->> f) is distinct from (n ->> f) then
      insert into public.feedback_history (feedback_id, changed_by, field_changed, old_value, new_value)
      values (new.id, auth.uid(), f, o ->> f, n ->> f);
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists feedback_audit_au on public.feedback;
create trigger feedback_audit_au after update on public.feedback
  for each row execute function public.feedback_audit();

-- ---------------------------------------------------------------------------
-- Admin analytics (single round trip, admin only)
-- ---------------------------------------------------------------------------

create or replace function public.admin_feedback_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total',         count(*),
    'new_count',     count(*) filter (where status = 'New'),
    'in_progress',   count(*) filter (where status = 'In Progress'),
    'completed',     count(*) filter (where status = 'Completed'),
    'critical_high', count(*) filter (where priority in ('Critical','High')),
    'by_status', (select coalesce(jsonb_agg(jsonb_build_object('name', k, 'count', c)), '[]'::jsonb)
                  from (select status k, count(*) c from public.feedback group by 1) s),
    'by_priority', (select coalesce(jsonb_agg(jsonb_build_object('name', k, 'count', c)), '[]'::jsonb)
                  from (select priority k, count(*) c from public.feedback group by 1) s),
    'by_type', (select coalesce(jsonb_agg(jsonb_build_object('name', k, 'count', c) order by c desc), '[]'::jsonb)
                  from (select feedback_type k, count(*) c from public.feedback group by 1) s),
    'by_owner', (select coalesce(jsonb_agg(jsonb_build_object('name', k, 'count', c) order by c desc), '[]'::jsonb)
                  from (select coalesce(owner, 'Unassigned') k, count(*) c from public.feedback group by 1) s),
    'reported_trend', (select coalesce(jsonb_agg(jsonb_build_object('week', k, 'count', c) order by k), '[]'::jsonb)
                  from (select date_trunc('week', date_reported)::date k, count(*) c from public.feedback group by 1) s),
    'completed_trend', (select coalesce(jsonb_agg(jsonb_build_object('week', k, 'count', c) order by k), '[]'::jsonb)
                  from (select date_trunc('week', date_completed)::date k, count(*) c
                        from public.feedback where status = 'Completed' and date_completed is not null group by 1) s)
  ) into r
  from public.feedback;

  return r;
end;
$$;
-- Row Level Security. The database enforces authorization; the UI only mirrors it.

alter table public.profiles         enable row level security;
alter table public.feedback         enable row level security;
alter table public.feedback_history enable row level security;
alter table public.admin_emails     enable row level security;
alter table public.app_config       enable row level security;
alter table public.owners           enable row level security;

-- Baseline privileges. Supabase's default privileges grant ALL on new public tables to anon/authenticated,
-- so reset them first and grant back only what is needed (RLS then narrows rows further).
-- In particular, `role` on profiles must never be client-writable.
revoke all on public.profiles, public.feedback, public.feedback_history,
              public.admin_emails, public.app_config, public.owners from anon, authenticated;
grant select, insert, update, delete on public.feedback, public.owners, public.admin_emails, public.app_config to authenticated;
grant select on public.feedback_history to authenticated;
grant select on public.profiles to authenticated;
grant update (name) on public.profiles to authenticated;   -- role can never be edited by clients
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_feedback_stats() to authenticated;
revoke execute on function public.admin_feedback_stats() from anon, public;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- feedback
drop policy if exists feedback_select_own on public.feedback;
create policy feedback_select_own on public.feedback for select to authenticated
  using (reported_by = auth.uid());
drop policy if exists feedback_select_admin on public.feedback;
create policy feedback_select_admin on public.feedback for select to authenticated
  using (public.is_admin());
drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback for insert to authenticated
  with check (reported_by = auth.uid());
-- Users may update their own rows, but the trigger restricts them to user_comments only.
drop policy if exists feedback_update_own on public.feedback;
create policy feedback_update_own on public.feedback for update to authenticated
  using (reported_by = auth.uid()) with check (reported_by = auth.uid());
drop policy if exists feedback_update_admin on public.feedback;
create policy feedback_update_admin on public.feedback for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists feedback_delete_admin on public.feedback;
create policy feedback_delete_admin on public.feedback for delete to authenticated
  using (public.is_admin());

-- feedback_history: written by triggers only; admins read.
drop policy if exists history_select_admin on public.feedback_history;
create policy history_select_admin on public.feedback_history for select to authenticated
  using (public.is_admin());

-- admin_emails: admins only
drop policy if exists admin_emails_all on public.admin_emails;
create policy admin_emails_all on public.admin_emails for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- app_config: everyone signed in can read (form needs it); admins write
drop policy if exists app_config_select on public.app_config;
create policy app_config_select on public.app_config for select to authenticated using (true);
drop policy if exists app_config_write on public.app_config;
create policy app_config_write on public.app_config for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- owners: admins manage; users do not need them
drop policy if exists owners_admin on public.owners;
create policy owners_admin on public.owners for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- Private screenshot bucket + Storage RLS. Object path convention: <user_id>/<uuid>.<ext>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-screenshots', 'feedback-screenshots', false, 10485760,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists "screenshots_insert_own_folder" on storage.objects;
create policy "screenshots_insert_own_folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'feedback-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "screenshots_select_own_or_admin" on storage.objects;
create policy "screenshots_select_own_or_admin" on storage.objects for select to authenticated
  using (bucket_id = 'feedback-screenshots'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- Users may delete only orphaned uploads (e.g. failed submission); admins may delete any.
drop policy if exists "screenshots_delete" on storage.objects;
create policy "screenshots_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'feedback-screenshots'
         and (public.is_admin()
              or ((storage.foldername(name))[1] = auth.uid()::text
                  and not exists (select 1 from public.feedback f where f.screenshot_path = name))));
-- Admin-configurable cascading dropdowns under Business (Business > Dashboard > Section > Sub-section ...).
-- A tree: root rows belong to a business (parent_id is null); children point at their parent.

create table if not exists public.dashboard_options (
  id         uuid primary key default gen_random_uuid(),
  business   text not null check (business in ('Remote','Field','Care','BPA')),
  parent_id  uuid references public.dashboard_options (id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  active     boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

create unique index if not exists dashboard_options_unique
  on public.dashboard_options (business, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index if not exists dashboard_options_parent_idx on public.dashboard_options (parent_id);

-- Selected path is stored as text (e.g. 'CSG > AHT') so history survives later renames/deletes.
alter table public.feedback add column if not exists dashboard_path text;

alter table public.dashboard_options enable row level security;
revoke all on public.dashboard_options from anon, authenticated;
grant select, insert, update, delete on public.dashboard_options to authenticated;

drop policy if exists dashboard_options_select on public.dashboard_options;
create policy dashboard_options_select on public.dashboard_options for select to authenticated using (true);
drop policy if exists dashboard_options_write on public.dashboard_options;
create policy dashboard_options_write on public.dashboard_options for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Initial configuration (Remote). Other businesses can be filled in from Settings.
do $$
declare
  csg uuid;
begin
  insert into public.dashboard_options (business, parent_id, name, sort_order) values
    ('Remote', null, 'Executive Dashboard', 1),
    ('Remote', null, 'CSG', 2),
    ('Remote', null, 'ISG', 3)
  on conflict do nothing;

  select id into csg from public.dashboard_options where business = 'Remote' and parent_id is null and name = 'CSG';

  insert into public.dashboard_options (business, parent_id, name, sort_order) values
    ('Remote', csg, 'Executive Dashboard', 1),
    ('Remote', csg, 'GenAI', 2),
    ('Remote', csg, 'Single pane of glass', 3),
    ('Remote', csg, 'SL Projection', 4),
    ('Remote', csg, 'What if Simulations', 5),
    ('Remote', csg, 'AHT', 6),
    ('Remote', csg, 'Administration', 7)
  on conflict do nothing;
end $$;
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
-- 006: admin tracking fields shown in the feedback table.
alter table public.feedback add column if not exists sub_owner  text check (sub_owner is null or length(sub_owner) <= 120);
alter table public.feedback add column if not exists eta        date;
alter table public.feedback add column if not exists challenges text check (challenges is null or length(challenges) <= 5000);

-- Reporters cannot set triage fields at submission time (updates are already admin-only).
create or replace function public.feedback_clear_tracking()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.sub_owner := null; new.eta := null; new.challenges := null;
  end if;
  return new;
end;
$$;
drop trigger if exists feedback_bi_tracking on public.feedback;
create trigger feedback_bi_tracking before insert on public.feedback
  for each row execute function public.feedback_clear_tracking();

create or replace function public.feedback_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  f text;
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
begin
  foreach f in array array['status','owner','sub_owner','eta','challenges','priority','resolution','admin_comments',
                           'card_graph_name','feedback_type','changes_required','user_comments']
  loop
    if (o ->> f) is distinct from (n ->> f) then
      insert into public.feedback_history (feedback_id, changed_by, field_changed, old_value, new_value)
      values (new.id, auth.uid(), f, o ->> f, n ->> f);
    end if;
  end loop;
  return new;
end;
$$;
-- 007: admin-managed assignee list. The chosen assignee is stored in feedback.sub_owner ("Sub Owner Name").
create table if not exists public.assignees (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0 and length(name) <= 120),
  active     boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);
create unique index if not exists assignees_name_uidx on public.assignees (lower(name));

alter table public.assignees enable row level security;
revoke all on public.assignees from anon, authenticated;
grant select, insert, update, delete on public.assignees to authenticated;

drop policy if exists assignees_read on public.assignees;
create policy assignees_read on public.assignees for select to authenticated
  using (active or public.is_admin());
drop policy if exists assignees_admin_write on public.assignees;
create policy assignees_admin_write on public.assignees for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.is_valid_assignee(assignee_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.assignees where name = assignee_name and active);
$$;

-- On submit the reporter may pick an assignee (active list only); ETA and challenges stay admin-only.
create or replace function public.feedback_clear_tracking()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.eta := null; new.challenges := null;
    if new.sub_owner is not null and not public.is_valid_assignee(new.sub_owner) then
      raise exception 'Assignee must be selected from the assignee list.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

-- Admins changing the assignee must also use the list (unchanged legacy values are allowed).
create or replace function public.feedback_check_assignee()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.sub_owner is not null and new.sub_owner is distinct from old.sub_owner
     and not public.is_valid_assignee(new.sub_owner) then
    raise exception 'Assignee must be selected from the assignee list.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists feedback_bu_assignee on public.feedback;
create trigger feedback_bu_assignee before update on public.feedback
  for each row execute function public.feedback_check_assignee();
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
-- 009: reporters may change the status of their OWN feedback (workflow transitions only).
-- Everything else (priority, owner, ETA, comments by the team, ...) stays admin-only.
create or replace function public.status_transition_allowed(from_status text, to_status text)
returns boolean language sql immutable as $$
  select from_status = to_status or (from_status, to_status) in (
    ('New','Under Review'), ('New','In Progress'), ('New','Rejected'),
    ('Under Review','In Progress'), ('Under Review','Rejected'), ('Under Review','Completed'),
    ('In Progress','Blocked'), ('In Progress','Completed'), ('In Progress','Under Review'),
    ('Blocked','In Progress'), ('Blocked','Rejected'),
    ('Completed','In Progress'), ('Completed','Under Review'),
    ('Rejected','Under Review')
  );
$$;

create or replace function public.feedback_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    -- Regular users may change only their follow-up comment and the status of their own feedback.
    if (to_jsonb(new) - 'user_comments' - 'status' - 'date_completed' - 'updated_at')
       is distinct from (to_jsonb(old) - 'user_comments' - 'status' - 'date_completed' - 'updated_at') then
      raise exception 'You are not allowed to modify these fields.' using errcode = '42501';
    end if;
    if not public.status_transition_allowed(old.status, new.status) then
      raise exception 'That status is not a valid next step.' using errcode = '23514';
    end if;
  end if;

  if auth.uid() is not null and new.owner is not null and new.owner is distinct from old.owner
     and not public.is_valid_owner(new.owner) then
    raise exception 'Owner must be selected from the owner list.' using errcode = '23514';
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
-- Designate administrators (database-controlled; never in frontend code).
-- Replace the email, then run once in the Supabase SQL editor.
-- Existing accounts are promoted immediately; future sign-ups with this email become admin automatically.
insert into public.admin_emails (email) values (lower('prashant.dhamale@alignedautomation.com'))
on conflict do nothing;
