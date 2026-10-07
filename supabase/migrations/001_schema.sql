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
