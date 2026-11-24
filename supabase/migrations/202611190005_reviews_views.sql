create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_type text not null,
  criteria_scores jsonb not null,
  total_score numeric(5,2) not null,
  feedback text not null,
  decision text not null,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  constraint reviews_unique_submission_reviewer unique (submission_id, reviewer_id),
  constraint reviews_reviewer_type_check
    check (reviewer_type in ('peer', 'mentor')),
  constraint reviews_total_range check (total_score between 0 and 100),
  constraint reviews_decision_check
    check (decision in ('approved', 'revision_requested')),
  constraint reviews_criteria_object check (jsonb_typeof(criteria_scores) = 'object'),
  constraint reviews_feedback_length check (char_length(feedback) between 1 and 5000)
);

alter table public.reviews enable row level security;

create index if not exists reviews_submission_idx on public.reviews (submission_id);
create index if not exists reviews_reviewer_idx on public.reviews (reviewer_id);
create index if not exists reviews_reviewee_idx on public.reviews (reviewee_id);
create index if not exists reviews_queue_idx
  on public.reviews (reviewee_id, created_at desc);

create or replace function public.reviews_validate_reviewer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  submission_owner uuid;
  reviewer_profile_role text;
begin
  select user_id into submission_owner
  from public.submissions
  where id = new.submission_id;

  select role into reviewer_profile_role
  from public.profiles
  where id = new.reviewer_id;

  if submission_owner is null then
    raise exception 'Submission does not exist';
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
  return new;
end;
$$;

create trigger reviews_validate_reviewer
before insert or update on public.reviews
for each row execute function public.reviews_validate_reviewer();

create policy "reviews_select_own_submission"
on public.reviews for select
to authenticated
using (
  reviewee_id = (select auth.uid())
  or reviewer_id = (select auth.uid())
);

create policy "reviews_select_public"
on public.reviews for select
to anon, authenticated
using (
  is_public = true
  and exists (
    select 1
    from public.profiles profile
    where profile.id = reviews.reviewee_id
      and profile.is_public = true
  )
);

create policy "reviews_insert_authorized"
on public.reviews for insert
to authenticated
with check (reviewer_id = (select auth.uid()));

create policy "reviews_update_own"
on public.reviews for update
to authenticated
using (reviewer_id = (select auth.uid()))
with check (reviewer_id = (select auth.uid()));

revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant insert (
  submission_id, reviewer_id, reviewee_id, reviewer_type,
  criteria_scores, total_score, feedback, decision, is_public
) on public.reviews to authenticated;
grant update (
  criteria_scores, total_score, feedback, decision, is_public
) on public.reviews to authenticated;

create or replace view public.public_profiles
with (security_invoker = true)
as
select
  id,
  username,
  display_name,
  headline,
  bio,
  avatar_url,
  location,
  github_username,
  github_profile_url,
  role,
  created_at
from public.profiles
where is_public = true;

create or replace view public.public_skill_scores
with (security_invoker = true)
as
select
  score.user_id,
  score.skill_domain,
  score.repo_evidence_score,
  score.challenge_score,
  score.review_score,
  score.composite_score,
  score.evidence_count,
  score.confidence,
  score.updated_at
from public.skill_scores score
join public.profiles profile on profile.id = score.user_id
where profile.is_public = true;

create or replace view public.public_reviews
with (security_invoker = true)
as
select
  review.id,
  review.submission_id,
  review.reviewer_id,
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

grant select on public.public_profiles to anon, authenticated;
grant select on public.public_skill_scores to anon, authenticated;
grant select on public.public_reviews to anon, authenticated;
