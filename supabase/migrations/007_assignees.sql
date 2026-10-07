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
