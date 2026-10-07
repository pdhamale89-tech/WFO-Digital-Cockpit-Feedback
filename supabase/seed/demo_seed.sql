-- DEMO DATA ONLY — for development/staging. Do NOT run against production.
-- Run manually in the SQL editor after at least one user has signed up.
-- Rows are attributed to the oldest profile. No screenshots are attached.

do $$
declare uid uuid; pname text; pemail text;
begin
  select id, name, email into uid, pname, pemail from public.profiles order by created_at limit 1;
  if uid is null then raise exception 'Sign up at least one user first.'; end if;

  insert into public.feedback (feedback_number, business, card_graph_name, feedback_type, changes_required, priority, owner, status,
                               reported_by, reported_by_name, reported_by_email, date_reported, date_completed)
  values
   ('WF-DEMO-0001', 'Remote', 'Contact Volume Trend', 'Data Issue', '[DEMO] Contact count is different from source', 'High', 'BI Developer', 'In Progress', uid, pname, pemail, now() - interval '5 days', null),
   ('WF-DEMO-0002', 'Field', 'SLA %', 'UI Issue', '[DEMO] Tooltip percentage is incorrect', 'Medium', null, 'New', uid, pname, pemail, now() - interval '3 days', null),
   ('WF-DEMO-0003', 'BPA', 'AHT Card', 'UI Issue', '[DEMO] Decimal formatting needs correction', 'Low', 'UI Team', 'Completed', uid, pname, pemail, now() - interval '9 days', now() - interval '2 days')
  on conflict (feedback_number) do nothing;
end $$;
