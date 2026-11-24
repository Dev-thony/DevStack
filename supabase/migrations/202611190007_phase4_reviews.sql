alter table public.reviews
  drop constraint if exists reviews_decision_check;

alter table public.reviews
  add constraint reviews_decision_check
    check (decision in ('approved', 'revision_requested'));

alter table public.submissions
  drop constraint if exists submissions_status_check;

alter table public.submissions
  add constraint submissions_status_check
    check (status in ('pending', 'verified', 'failed', 'unknown', 'approved'));

create policy "submissions_select_review_queue"
on public.submissions for select
to authenticated
using (
  user_id is distinct from (select auth.uid())
  and status in ('verified', 'approved')
);

create or replace function public.reviews_validate_reviewer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  submission_owner uuid;
  submission_status text;
  reviewer_profile_role text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
    return new;
  end if;

  select user_id, status
  into submission_owner, submission_status
  from public.submissions
  where id = new.submission_id;

  select role into reviewer_profile_role
  from public.profiles
  where id = new.reviewer_id;

  if submission_owner is null then
    raise exception 'Submission does not exist';
  end if;
  if submission_status not in ('verified', 'approved') then
    raise exception 'Only verified or approved submissions may be reviewed';
  end if;
  if new.reviewee_id is distinct from submission_owner then
    raise exception 'Reviewee must be the submission owner';
  end if;
  if new.reviewer_id = submission_owner then
    raise exception 'Users cannot review their own submissions';
  end if;
  if new.reviewer_id is distinct from auth.uid() then
    raise exception 'Reviewers must create reviews as themselves';
  end if;
  if new.reviewer_type = 'mentor' and reviewer_profile_role not in ('mentor', 'admin') then
    raise exception 'Only mentor or admin profiles may submit mentor reviews';
  end if;
  if new.reviewer_type = 'peer' and reviewer_profile_role is null then
    raise exception 'Reviewers must have an application profile';
  end if;
  return new;
end;
$$;
