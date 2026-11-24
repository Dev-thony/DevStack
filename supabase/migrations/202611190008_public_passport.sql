drop view if exists public.public_reviews;

create view public.public_reviews
with (security_invoker = true)
as
select
  review.id,
  review.reviewee_id,
  review.reviewer_type,
  review.criteria_scores,
  review.total_score,
  review.feedback,
  review.decision,
  review.created_at
from public.reviews review
join public.profiles profile on profile.id = review.reviewee_id
where review.is_public = true
  and profile.is_public = true;

grant select on public.public_reviews to anon, authenticated;

create or replace view public.public_submissions
with (security_invoker = false)
as
select
  submission.id,
  submission.user_id,
  submission.challenge_id,
  submission.repo_full_name,
  submission.repo_url,
  submission.skill_domain,
  submission.status,
  submission.repo_evidence_score,
  submission.last_synced_at,
  submission.submitted_at
from public.submissions submission
join public.profiles profile on profile.id = submission.user_id
where submission.status in ('verified', 'approved')
  and profile.is_public = true;

grant select on public.public_submissions to anon, authenticated;

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role then
    select role into caller_role
    from public.profiles
    where id = auth.uid();

    if caller_role is distinct from 'admin' then
      raise exception 'Only administrators may change profile roles';
    end if;
  end if;
  return new;
end;
$$;
