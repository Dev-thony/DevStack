insert into public.challenges (
  slug,
  title,
  description,
  instructions,
  skill_domain,
  difficulty,
  xp_reward,
  estimated_hours,
  rubric,
  is_published
) values
  (
    'build-a-rate-limited-api',
    'Build a Rate-Limited API',
    'Design and implement an API that protects resource-intensive endpoints with predictable rate limits.',
    '["Define a rate-limit policy and limits", "Implement enforcement at the API boundary", "Expose retry and remaining-rate metadata", "Add success, limit, and reset tests"]'::jsonb,
    'backend',
    'intermediate',
    300,
    4.0,
    '{"max_score":100,"criteria":[{"key":"policy","label":"Policy design","max":25},{"key":"implementation","label":"Implementation","max":30},{"key":"headers","label":"Rate-limit metadata","max":20},{"key":"tests","label":"Tests","max":25}]}'::jsonb,
    true
  ),
  (
    'optimize-react-virtual-list',
    'Optimize React Virtual List',
    'Build a virtualized list that remains responsive while handling large datasets and frequent updates.',
    '["Measure a baseline render cost", "Implement windowing or virtualization", "Preserve keyboard and scroll behavior", "Add performance-oriented tests"]'::jsonb,
    'frontend',
    'advanced',
    400,
    6.0,
    '{"max_score":100,"criteria":[{"key":"measurement","label":"Baseline measurement","max":20},{"key":"virtualization","label":"Virtualization implementation","max":35},{"key":"ux","label":"Scroll and keyboard behavior","max":25},{"key":"tests","label":"Tests","max":20}]}'::jsonb,
    true
  ),
  (
    'design-an-event-driven-job-queue',
    'Design an Event-Driven Job Queue',
    'Create a resilient job queue using explicit events, retries, dead-letter handling, and observability.',
    '["Model jobs and lifecycle events", "Implement retries and backoff", "Add a dead-letter path", "Demonstrate observability and recovery"]'::jsonb,
    'system_design',
    'advanced',
    500,
    8.0,
    '{"max_score":100,"criteria":[{"key":"architecture","label":"Architecture","max":30},{"key":"reliability","label":"Retries and recovery","max":30},{"key":"observability","label":"Observability","max":20},{"key":"tradeoffs","label":"Tradeoffs","max":20}]}'::jsonb,
    true
  ),
  (
    'implement-a-jwt-refresh-flow',
    'Implement a JWT Refresh Flow',
    'Implement secure access-token renewal, refresh rotation, and invalid-session handling.',
    '["Define token lifetimes and claims", "Implement refresh-token rotation", "Handle invalid and reused tokens", "Document threat mitigations and tests"]'::jsonb,
    'backend',
    'intermediate',
    350,
    5.0,
    '{"max_score":100,"criteria":[{"key":"claims","label":"Token and claims design","max":20},{"key":"rotation","label":"Refresh rotation","max":35},{"key":"revocation","label":"Invalid-session handling","max":25},{"key":"tests","label":"Tests and threat coverage","max":20}]}'::jsonb,
    true
  )
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  instructions = excluded.instructions,
  skill_domain = excluded.skill_domain,
  difficulty = excluded.difficulty,
  xp_reward = excluded.xp_reward,
  estimated_hours = excluded.estimated_hours,
  rubric = excluded.rubric,
  is_published = true,
  updated_at = now();

create or replace function public.prevent_submission_verification_client_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
  jwt_role text;
begin
  jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');

  if jwt_role = 'service_role' then
    return new;
  end if;

  select role into caller_role
  from public.profiles
  where id = auth.uid();

  if new.status is distinct from old.status
     or new.repo_evidence_score is distinct from old.repo_evidence_score
     or new.verification_snapshot is distinct from old.verification_snapshot
     or new.verification_version is distinct from old.verification_version
     or new.last_synced_at is distinct from old.last_synced_at
  then
    if caller_role not in ('mentor', 'admin') then
      raise exception 'Verification fields are server-authorized';
    end if;
  end if;
  return new;
end;
$$;
