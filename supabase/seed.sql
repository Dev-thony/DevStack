-- Local/demo-only deterministic fixtures. Create these users through Supabase
-- Auth first; this file never creates accounts or credentials.
begin;
set local request.jwt.claim.role = 'service_role';

insert into public.profiles (
  id, username, display_name, headline, bio, location,
  github_username, github_profile_url, role, is_public
)
select
  user_record.id,
  demo.username,
  demo.display_name,
  demo.headline,
  demo.bio,
  'Demo City',
  demo.username,
  'https://github.com/' || demo.username,
  demo.role,
  demo.is_public
from auth.users user_record
join (
  values
    ('demo-alex@example.test', 'demo-alex', 'Demo Alex',
     'Frontend and backend engineer · fictional demo profile',
     'A repeatable fictional passport fixture. Repository evidence below is synthetic demo data.',
     'developer', true),
    ('demo-morgan@example.test', 'demo-morgan', 'Demo Morgan',
     'Mentor · fictional demo profile',
     'A fictional mentor account for local review-flow demonstrations.',
     'mentor', true),
    ('demo-private@example.test', 'demo-private', 'Private Demo',
     'Private fictional profile',
     'This fixture verifies that private passports are not publicly visible.',
     'developer', false)
) as demo(email, username, display_name, headline, bio, role, is_public)
  on user_record.email = demo.email
on conflict (id) do update set
  username = excluded.username,
  display_name = excluded.display_name,
  headline = excluded.headline,
  bio = excluded.bio,
  location = excluded.location,
  github_username = excluded.github_username,
  github_profile_url = excluded.github_profile_url,
  role = excluded.role,
  is_public = excluded.is_public;

with fixture_rows as (
  select *
  from (values
    (
      'demo-alex', 'build-a-rate-limited-api', 'demo-rate-api',
      'backend', 60.00, '2026-11-18T10:15:00Z'::timestamptz,
      '2026-11-17T10:15:00Z'::timestamptz,
      '{"verificationVersion":"demo-fixture-v1","observedAt":"2026-11-18T10:15:00Z","demoFixture":true,"checks":[{"name":"Meaningful README","status":"unknown","summary":"Synthetic fixture only; no GitHub request was made.","observedAt":"2026-11-18T10:15:00Z"},{"name":"Workflow configured","status":"unknown","summary":"Synthetic fixture only; no GitHub request was made.","observedAt":"2026-11-18T10:15:00Z"},{"name":"Tests Verified","status":"unknown","summary":"No passing GitHub test job is asserted.","observedAt":"2026-11-18T10:15:00Z"}],"scoringComponents":{"readmeScore":100,"workflowConfiguredScore":100,"passingTestJobScore":0,"ciPassingScore":0,"recentActivityScore":100,"skillRelevanceScore":100,"metadataCompletenessScore":100},"repoEvidenceScore":60}'::jsonb
    ),
    (
      'demo-alex', 'optimize-react-virtual-list', 'demo-virtual-list',
      'frontend', 60.00, '2026-11-18T11:15:00Z'::timestamptz,
      '2026-11-17T11:15:00Z'::timestamptz,
      '{"verificationVersion":"demo-fixture-v1","observedAt":"2026-11-18T11:15:00Z","demoFixture":true,"checks":[{"name":"Meaningful README","status":"unknown","summary":"Synthetic fixture only; no GitHub request was made.","observedAt":"2026-11-18T11:15:00Z"},{"name":"Workflow configured","status":"unknown","summary":"Synthetic fixture only; no GitHub request was made.","observedAt":"2026-11-18T11:15:00Z"},{"name":"Tests Verified","status":"unknown","summary":"No passing GitHub test job is asserted.","observedAt":"2026-11-18T11:15:00Z"}],"scoringComponents":{"readmeScore":100,"workflowConfiguredScore":100,"passingTestJobScore":0,"ciPassingScore":0,"recentActivityScore":100,"skillRelevanceScore":100,"metadataCompletenessScore":100},"repoEvidenceScore":60}'::jsonb
    )
  ) as fixtures(
    username, challenge_slug, repo_name, skill_domain, evidence_score,
    synced_at, submitted_at, snapshot
  )
)
insert into public.submissions (
  id, user_id, challenge_id, repo_owner, repo_name, repo_full_name,
  repo_url, skill_domain, status, repo_evidence_score,
  verification_snapshot, verification_version, last_synced_at, submitted_at
)
select
  md5(profile.id::text || ':' || challenge.id::text)::uuid,
  profile.id,
  challenge.id,
  profile.username,
  fixture.repo_name,
  profile.username || '/' || fixture.repo_name,
  'https://github.com/' || profile.username || '/' || fixture.repo_name,
  fixture.skill_domain,
  'approved',
  fixture.evidence_score,
  fixture.snapshot,
  'demo-fixture-v1',
  fixture.synced_at,
  fixture.submitted_at
from fixture_rows fixture
join public.profiles profile on profile.username = fixture.username
join public.challenges challenge on challenge.slug = fixture.challenge_slug
on conflict (id) do update set
  status = excluded.status,
  repo_evidence_score = excluded.repo_evidence_score,
  verification_snapshot = excluded.verification_snapshot,
  verification_version = excluded.verification_version,
  last_synced_at = excluded.last_synced_at,
  submitted_at = excluded.submitted_at;

with fixture_reviews as (
  select *
  from (values
    ('demo-rate-api', 90.00, '2026-11-18T12:15:00Z'::timestamptz,
     '{"functionality":27,"codeQuality":23,"userExperience":18,"documentation":14,"originality":8}'::jsonb,
     'Fictional demo feedback: clear implementation and documented tradeoffs.'),
    ('demo-virtual-list', 84.00, '2026-11-18T13:15:00Z'::timestamptz,
     '{"functionality":25,"codeQuality":21,"userExperience":17,"documentation":13,"originality":8}'::jsonb,
     'Fictional demo feedback: responsive behavior is clear; retain benchmark evidence.')
  ) as fixtures(repo_name, total_score, created_at, criteria_scores, feedback)
)
insert into public.reviews (
  id, submission_id, reviewer_id, reviewee_id, reviewer_type,
  criteria_scores, total_score, feedback, decision, is_public, created_at
)
select
  md5(submission.id::text || ':' || reviewer.id::text)::uuid,
  submission.id,
  reviewer.id,
  submission.user_id,
  case when reviewer.role in ('mentor', 'admin') then 'mentor' else 'peer' end,
  fixture.criteria_scores,
  fixture.total_score,
  fixture.feedback,
  'approved',
  true,
  fixture.created_at
from fixture_reviews fixture
join public.submissions submission on submission.repo_name = fixture.repo_name
join public.profiles reviewer on reviewer.username = 'demo-morgan'
on conflict (submission_id, reviewer_id) do update set
  reviewer_type = excluded.reviewer_type,
  criteria_scores = excluded.criteria_scores,
  total_score = excluded.total_score,
  feedback = excluded.feedback,
  decision = excluded.decision,
  is_public = excluded.is_public,
  created_at = excluded.created_at;

insert into public.skill_scores (
  user_id, skill_domain, repo_evidence_score, challenge_score,
  review_score, composite_score, evidence_count, confidence, updated_at
)
select
  profile.id,
  scores.skill_domain,
  scores.repo_score,
  scores.challenge_score,
  scores.review_score,
  round((
    scores.repo_score * 0.50
    + scores.challenge_score * 0.30
    + scores.review_score * 0.20
  )::numeric, 2),
  3,
  'high',
  '2026-11-18T13:15:00Z'::timestamptz
from public.profiles profile
cross join (
  values
    ('backend', 60.00, 100.00, 90.00),
    ('frontend', 60.00, 100.00, 84.00)
) as scores(skill_domain, repo_score, challenge_score, review_score)
where profile.username = 'demo-alex'
on conflict (user_id, skill_domain) do update set
  repo_evidence_score = excluded.repo_evidence_score,
  challenge_score = excluded.challenge_score,
  review_score = excluded.review_score,
  composite_score = excluded.composite_score,
  evidence_count = excluded.evidence_count,
  confidence = excluded.confidence,
  updated_at = excluded.updated_at;

insert into public.skill_scores (
  user_id, skill_domain, repo_evidence_score, challenge_score,
  review_score, composite_score, evidence_count, confidence, updated_at
)
select profile.id, domain.skill_domain, 0, 0, 0, 0, 0, 'unverified',
       '2026-11-18T13:15:00Z'::timestamptz
from public.profiles profile
cross join (values ('data'), ('devops'), ('system_design'), ('product'))
  as domain(skill_domain)
where profile.username = 'demo-alex'
on conflict (user_id, skill_domain) do update set
  repo_evidence_score = excluded.repo_evidence_score,
  challenge_score = excluded.challenge_score,
  review_score = excluded.review_score,
  composite_score = excluded.composite_score,
  evidence_count = excluded.evidence_count,
  confidence = excluded.confidence,
  updated_at = excluded.updated_at;

commit;
