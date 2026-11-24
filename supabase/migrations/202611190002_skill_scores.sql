create table if not exists public.skill_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_domain text not null,
  repo_evidence_score numeric(5,2) not null default 0,
  challenge_score numeric(5,2) not null default 0,
  review_score numeric(5,2) not null default 0,
  composite_score numeric(5,2) not null default 0,
  evidence_count integer not null default 0,
  confidence text not null default 'unverified',
  updated_at timestamptz not null default now(),
  constraint skill_scores_user_domain_key unique (user_id, skill_domain),
  constraint skill_scores_domain_check
    check (skill_domain in ('frontend', 'backend', 'data', 'devops', 'system_design', 'product')),
  constraint skill_scores_repo_range check (repo_evidence_score between 0 and 100),
  constraint skill_scores_challenge_range check (challenge_score between 0 and 100),
  constraint skill_scores_review_range check (review_score between 0 and 100),
  constraint skill_scores_composite_range check (composite_score between 0 and 100),
  constraint skill_scores_evidence_count_range check (evidence_count >= 0),
  constraint skill_scores_confidence_check
    check (confidence in ('unverified', 'low', 'medium', 'high'))
);

alter table public.skill_scores enable row level security;

create index if not exists skill_scores_user_idx on public.skill_scores (user_id);
create index if not exists skill_scores_domain_idx on public.skill_scores (skill_domain);
create index if not exists skill_scores_public_lookup_idx
  on public.skill_scores (user_id, evidence_count, skill_domain);

create trigger skill_scores_set_updated_at
before update on public.skill_scores
for each row execute function public.set_updated_at();

create policy "skill_scores_select_own"
on public.skill_scores for select
to authenticated
using (user_id = (select auth.uid()));

create policy "skill_scores_select_public"
on public.skill_scores for select
to anon, authenticated
using (
  exists (
    select 1
    from public.profiles profile
    where profile.id = skill_scores.user_id
      and profile.is_public = true
  )
);

-- Score writes are server-authorized only. There are intentionally no client policies.
revoke all on public.skill_scores from anon, authenticated;
grant select on public.skill_scores to anon, authenticated;
