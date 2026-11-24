create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id),
  repo_owner text not null,
  repo_name text not null,
  repo_full_name text not null,
  repo_url text not null,
  skill_domain text not null,
  status text not null default 'pending',
  repo_evidence_score numeric(5,2),
  verification_snapshot jsonb not null default '{}'::jsonb,
  verification_version text not null,
  last_synced_at timestamptz,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint submissions_full_name_format
    check (repo_full_name ~ '^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9._-]+$'),
  constraint submissions_repo_url_format
    check (repo_url ~ '^https://github\.com/[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9._-]+/?$'),
  constraint submissions_domain_check
    check (skill_domain in ('frontend', 'backend', 'data', 'devops', 'system_design', 'product')),
  constraint submissions_status_check
    check (status in ('pending', 'verified', 'failed', 'unknown', 'approved')),
  constraint submissions_evidence_range
    check (repo_evidence_score is null or repo_evidence_score between 0 and 100),
  constraint submissions_snapshot_object
    check (jsonb_typeof(verification_snapshot) = 'object')
);

alter table public.submissions enable row level security;

create index if not exists submissions_owner_idx on public.submissions (user_id);
create index if not exists submissions_status_idx on public.submissions (status);
create index if not exists submissions_challenge_idx on public.submissions (challenge_id);
create index if not exists submissions_owner_status_idx on public.submissions (user_id, status);

create trigger submissions_set_updated_at
before update on public.submissions
for each row execute function public.set_updated_at();

create or replace function public.prevent_submission_verification_client_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
begin
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

create trigger submissions_protect_verification
before update on public.submissions
for each row execute function public.prevent_submission_verification_client_writes();

create policy "submissions_select_own"
on public.submissions for select
to authenticated
using (user_id = (select auth.uid()));

create policy "submissions_insert_own"
on public.submissions for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and repo_evidence_score is null
  and verification_snapshot = '{}'::jsonb
  and last_synced_at is null
);

create policy "submissions_update_own_pending"
on public.submissions for update
to authenticated
using (user_id = (select auth.uid()) and status = 'pending')
with check (
  user_id = (select auth.uid())
  and status = 'pending'
);

revoke all on public.submissions from anon, authenticated;
grant select on public.submissions to authenticated;
grant insert (
  user_id, challenge_id, repo_owner, repo_name, repo_full_name,
  repo_url, skill_domain, status, verification_snapshot,
  verification_version
) on public.submissions to authenticated;
grant update (
  challenge_id, repo_owner, repo_name, repo_full_name,
  repo_url, skill_domain
) on public.submissions to authenticated;
