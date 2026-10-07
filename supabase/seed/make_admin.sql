-- Designate administrators (database-controlled; never in frontend code).
-- Replace the email, then run once in the Supabase SQL editor.
-- Existing accounts are promoted immediately; future sign-ups with this email become admin automatically.
insert into public.admin_emails (email) values (lower('prashant.dhamale@alignedautomation.com'))
on conflict do nothing;
