-- Phase 1 security hardening for workspace/entity authorization.

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_member(uuid) from anon;
revoke all on function public.is_workspace_member(uuid) from authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;

revoke all on function public.is_approved_mentor(uuid) from public;
revoke all on function public.is_approved_mentor(uuid) from anon;
revoke all on function public.is_approved_mentor(uuid) from authenticated;
grant execute on function public.is_approved_mentor(uuid) to authenticated;

revoke all on function public.is_company_member(uuid) from public;
revoke all on function public.is_company_member(uuid) from anon;
revoke all on function public.is_company_member(uuid) from authenticated;
grant execute on function public.is_company_member(uuid) to authenticated;

revoke all on function public.complete_registration(text, text, text, text, text) from public;
revoke all on function public.complete_registration(text, text, text, text, text) from anon;
grant execute on function public.complete_registration(text, text, text, text, text) to authenticated;

create or replace function public.prevent_mentor_verification_client_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

  if new.verification_status is distinct from old.verification_status
     or new.verified_at is distinct from old.verified_at
  then
    select role into caller_role
    from public.profiles
    where id = auth.uid();

    if caller_role is distinct from 'admin' then
      raise exception 'Only administrators may change mentor verification';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_company_verification_client_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

  if new.verification_status is distinct from old.verification_status
  then
    select role into caller_role
    from public.profiles
    where id = auth.uid();

    if caller_role is distinct from 'admin' then
      raise exception 'Only administrators may change company verification';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_submission_verification_client_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

  if new.status is distinct from old.status
     or new.repo_evidence_score is distinct from old.repo_evidence_score
     or new.verification_snapshot is distinct from old.verification_snapshot
     or new.verification_version is distinct from old.verification_version
     or new.last_synced_at is distinct from old.last_synced_at
  then
    raise exception 'Verification fields are restricted to trusted server operations';
  end if;
  return new;
end;
$$;

drop trigger if exists mentor_profiles_restrict_verification on public.mentor_profiles;
create trigger mentor_profiles_restrict_verification
before update on public.mentor_profiles
for each row execute function public.prevent_mentor_verification_client_writes();

drop trigger if exists companies_restrict_verification on public.companies;
create trigger companies_restrict_verification
before update on public.companies
for each row execute function public.prevent_company_verification_client_writes();

drop trigger if exists submissions_protect_verification on public.submissions;
create trigger submissions_protect_verification
before update on public.submissions
for each row execute function public.prevent_submission_verification_client_writes();

revoke all on function public.prevent_mentor_verification_client_writes() from public;
revoke all on function public.prevent_company_verification_client_writes() from public;
revoke all on function public.prevent_submission_verification_client_writes() from public;
revoke all on function public.prevent_profile_role_escalation() from public;

create or replace function public.prevent_mentor_workspace_mismatch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_type text;
  workspace_owner uuid;
begin
  select workspaces.workspace_type, workspaces.created_by
  into workspace_type, workspace_owner
  from public.workspaces
  where id = new.workspace_id;

  if workspace_type is distinct from 'mentor' then
    raise exception 'Mentor profile workspace must be a mentor workspace';
  end if;
  if workspace_owner is distinct from new.user_id then
    raise exception 'Mentor profile must belong to the mentor workspace owner';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_company_workspace_mismatch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_type text;
  workspace_owner uuid;
begin
  select workspaces.workspace_type, workspaces.created_by
  into workspace_type, workspace_owner
  from public.workspaces
  where id = new.workspace_id;

  if workspace_type is distinct from 'company' then
    raise exception 'Company workspace must be a company workspace';
  end if;
  if workspace_owner is distinct from auth.uid()
     and coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role'
  then
    raise exception 'Company workspace must belong to the authenticated owner';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_company_membership_mismatch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  company_workspace_id uuid;
  active_workspace_membership boolean;
  company_workspace_type text;
begin
  select companies.workspace_id
  into company_workspace_id
  from public.companies
  where id = new.company_id;

  select workspaces.workspace_type
  into company_workspace_type
  from public.workspaces
  where id = company_workspace_id;

  if company_workspace_type is distinct from 'company' then
    raise exception 'Company membership must reference a company workspace';
  end if;

  select exists (
    select 1
    from public.workspace_memberships membership
    where membership.workspace_id = company_workspace_id
      and membership.user_id = new.user_id
      and membership.membership_status = 'active'
  ) into active_workspace_membership;

  if not active_workspace_membership then
    raise exception 'Company membership requires an active company workspace membership';
  end if;
  return new;
end;
$$;

drop trigger if exists mentor_profiles_workspace_integrity on public.mentor_profiles;
create trigger mentor_profiles_workspace_integrity
before insert or update on public.mentor_profiles
for each row execute function public.prevent_mentor_workspace_mismatch();

drop trigger if exists companies_workspace_integrity on public.companies;
create trigger companies_workspace_integrity
before insert or update on public.companies
for each row execute function public.prevent_company_workspace_mismatch();

drop trigger if exists company_memberships_workspace_integrity on public.company_memberships;
create trigger company_memberships_workspace_integrity
before insert or update on public.company_memberships
for each row execute function public.prevent_company_membership_mismatch();

revoke all on function public.prevent_mentor_workspace_mismatch() from public;
revoke all on function public.prevent_company_workspace_mismatch() from public;
revoke all on function public.prevent_company_membership_mismatch() from public;

create unique index if not exists workspaces_one_personal_per_owner_idx
  on public.workspaces (created_by)
  where workspace_type = 'personal';

create unique index if not exists workspaces_one_mentor_per_owner_idx
  on public.workspaces (created_by)
  where workspace_type = 'mentor';
