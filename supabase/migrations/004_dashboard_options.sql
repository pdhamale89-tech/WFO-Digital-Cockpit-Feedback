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
