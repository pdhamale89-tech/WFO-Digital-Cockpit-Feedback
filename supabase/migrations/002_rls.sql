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
