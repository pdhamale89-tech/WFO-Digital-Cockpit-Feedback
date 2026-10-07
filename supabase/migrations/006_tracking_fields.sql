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
