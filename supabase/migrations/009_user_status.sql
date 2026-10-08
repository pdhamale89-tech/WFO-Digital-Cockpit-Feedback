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
