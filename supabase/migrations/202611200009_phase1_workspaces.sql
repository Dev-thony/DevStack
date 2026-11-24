create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  workspace_type text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_type_check
    check (workspace_type in ('personal', 'mentor', 'company')),
  constraint workspaces_name_length check (char_length(name) between 1 and 100),
  constraint workspaces_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  membership_role text not null,
  membership_status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_memberships_unique unique (workspace_id, user_id),
  constraint workspace_memberships_role_check
    check (membership_role in ('owner', 'admin', 'mentor', 'member', 'developer')),
  constraint workspace_memberships_status_check
    check (membership_status in ('pending', 'active', 'suspended', 'revoked'))
);

create table if not exists public.mentor_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  expertise text[] not null default '{}'::text[],
  biography text,
  availability_status text not null default 'unavailable',
  verification_status text not null default 'pending',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mentor_profiles_availability_check
    check (availability_status in ('available', 'limited', 'unavailable')),
  constraint mentor_profiles_verification_check
    check (verification_status in ('pending', 'approved', 'rejected', 'suspended'))
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null unique,
  logo_url text,
  website text,
  industry text,
  description text,
  location text,
  contact_name text,
  contact_email text,
  contact_phone text,
  verification_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_name_length check (char_length(name) between 1 and 150),
  constraint companies_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint companies_verification_check
    check (verification_status in ('pending', 'approved', 'rejected', 'suspended'))
);

create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  membership_role text not null,
  membership_status text not null,
  created_at timestamptz not null default now(),
  constraint company_memberships_unique unique (company_id, user_id),
  constraint company_memberships_role_check
    check (membership_role in ('owner', 'admin', 'recruiter', 'member')),
  constraint company_memberships_status_check
    check (membership_status in ('pending', 'active', 'suspended', 'revoked'))
);

create index if not exists workspaces_type_idx on public.workspaces (workspace_type);
create index if not exists workspaces_created_by_idx on public.workspaces (created_by);
create index if not exists workspace_memberships_user_idx
  on public.workspace_memberships (user_id, membership_status);
create index if not exists workspace_memberships_workspace_idx
  on public.workspace_memberships (workspace_id, membership_status);
create index if not exists mentor_profiles_verification_idx
  on public.mentor_profiles (verification_status, availability_status);
create index if not exists companies_verification_idx
  on public.companies (verification_status);
create index if not exists company_memberships_user_idx
  on public.company_memberships (user_id, membership_status);

alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.mentor_profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_memberships enable row level security;

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

drop trigger if exists workspace_memberships_set_updated_at on public.workspace_memberships;
create trigger workspace_memberships_set_updated_at
before update on public.workspace_memberships
for each row execute function public.set_updated_at();

drop trigger if exists mentor_profiles_set_updated_at on public.mentor_profiles;
create trigger mentor_profiles_set_updated_at
before update on public.mentor_profiles
for each row execute function public.set_updated_at();

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_memberships membership
    where membership.workspace_id = p_workspace_id
      and membership.user_id = auth.uid()
      and membership.membership_status = 'active'
  );
$$;

create or replace function public.is_approved_mentor(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.mentor_profiles mentor
    join public.workspace_memberships membership
      on membership.workspace_id = mentor.workspace_id
     and membership.user_id = mentor.user_id
    where mentor.user_id = p_user_id
      and mentor.verification_status = 'approved'
      and membership.membership_status = 'active'
  );
$$;

create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = p_company_id
      and membership.user_id = auth.uid()
      and membership.membership_status = 'active'
  );
$$;

create or replace function public.complete_registration(
  p_registration_type text,
  p_username text,
  p_display_name text default null,
  p_company_name text default null,
  p_company_slug text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_auth_user record;
  v_profile public.profiles%rowtype;
  v_username text;
  v_personal_slug text;
  v_personal_workspace_id uuid;
  v_mentor_workspace_id uuid;
  v_company_workspace_id uuid;
  v_company_id uuid;
  v_company_slug text;
  v_suffix integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_registration_type not in ('developer', 'mentor', 'company') then
    raise exception 'Invalid registration type';
  end if;

  select * into v_auth_user
  from auth.users
  where id = v_user_id;

  if v_auth_user.id is null then
    raise exception 'Authenticated user not found';
  end if;

  v_username := lower(trim(coalesce(p_username, '')));
  v_username := lower(regexp_replace(v_username, '[^a-zA-Z0-9_-]', '-', 'g'));
  v_username := regexp_replace(v_username, '^[^a-zA-Z0-9]+', '');
  v_username := left(v_username, 24);
  if length(v_username) < 3 then
    v_username := split_part(coalesce(v_auth_user.email, ''), '@', 1);
    v_username := lower(regexp_replace(v_username, '[^a-zA-Z0-9_-]', '-', 'g'));
    v_username := left(v_username, 24);
  end if;
  if length(v_username) < 3 then
    v_username := 'user-' || substr(v_user_id::text, 1, 8);
  end if;

  while exists (
    select 1 from public.profiles profile
    where profile.username = v_username
      and profile.id is distinct from v_user_id
  ) loop
    v_suffix := v_suffix + 1;
    v_username := left(v_username, 24) || '-' || v_suffix::text;
  end loop;

  insert into public.profiles (
    id,
    username,
    display_name,
    role,
    is_public
  )
  values (
    v_user_id,
    v_username,
    nullif(trim(coalesce(p_display_name, '')), ''),
    'developer',
    true
  )
  on conflict (id) do update set
    display_name = coalesce(excluded.display_name, public.profiles.display_name);

  select * into v_profile
  from public.profiles
  where id = v_user_id;

  v_personal_slug := v_profile.username;
  while exists (
    select 1 from public.workspaces workspace
    where workspace.slug = v_personal_slug
      and workspace.created_by is distinct from v_user_id
  ) loop
    v_suffix := v_suffix + 1;
    v_personal_slug := v_profile.username || '-' || v_suffix::text;
  end loop;

  insert into public.workspaces (
    name,
    slug,
    workspace_type,
    created_by
  )
  values (
    coalesce(nullif(trim(coalesce(p_display_name, '')), ''), v_profile.username),
    v_personal_slug,
    'personal',
    v_user_id
  )
  on conflict (slug) do update set
    name = excluded.name,
    updated_at = now()
  returning id into v_personal_workspace_id;

  insert into public.workspace_memberships (
    workspace_id,
    user_id,
    membership_role,
    membership_status
  )
  values (
    v_personal_workspace_id,
    v_user_id,
    'developer',
    'active'
  )
  on conflict (workspace_id, user_id) do update set
    membership_role = 'developer',
    membership_status = 'active',
    updated_at = now();

  if p_registration_type = 'mentor' then
    v_suffix := 0;
    v_username := v_profile.username || '-mentor';
    while exists (
      select 1 from public.workspaces workspace
      where workspace.slug = v_username
    ) loop
      v_suffix := v_suffix + 1;
      v_username := left(v_profile.username, 24) || '-mentor-' || v_suffix::text;
    end loop;

    insert into public.workspaces (
      name,
      slug,
      workspace_type,
      created_by
    )
    values (
      coalesce(nullif(trim(coalesce(p_display_name, '')), ''), v_profile.username) || ' Mentor',
      v_username,
      'mentor',
      v_user_id
    )
    on conflict (slug) do update set
      updated_at = now()
    returning id into v_mentor_workspace_id;

    insert into public.workspace_memberships (
      workspace_id,
      user_id,
      membership_role,
      membership_status
    )
    values (
      v_mentor_workspace_id,
      v_user_id,
      'mentor',
      'pending'
    )
    on conflict (workspace_id, user_id) do nothing;

    insert into public.mentor_profiles (
      user_id,
      workspace_id,
      availability_status,
      verification_status
    )
    values (
      v_user_id,
      v_mentor_workspace_id,
      'unavailable',
      'pending'
    )
    on conflict (user_id) do nothing;
  end if;

  if p_registration_type = 'company' then
    if coalesce(trim(p_company_name), '') = '' then
      raise exception 'Company name is required';
    end if;

    v_company_slug := lower(trim(coalesce(p_company_slug, p_company_name)));
    v_company_slug := lower(regexp_replace(v_company_slug, '[^a-zA-Z0-9_-]', '-', 'g'));
    v_company_slug := left(v_company_slug, 100);
    v_suffix := 0;
    while exists (
      select 1 from public.companies company
      where company.slug = v_company_slug
      union all
      select 1 from public.workspaces workspace
      where workspace.slug = v_company_slug
    ) loop
      v_suffix := v_suffix + 1;
      v_company_slug := left(v_company_slug, 100) || '-' || v_suffix::text;
    end loop;

    insert into public.workspaces (
      name,
      slug,
      workspace_type,
      created_by
    )
    values (
      p_company_name,
      v_company_slug,
      'company',
      v_user_id
    )
    on conflict (slug) do update set
      name = excluded.name,
      updated_at = now()
    returning id into v_company_workspace_id;

    insert into public.companies (
      workspace_id,
      name,
      slug,
      verification_status
    )
    values (
      v_company_workspace_id,
      p_company_name,
      v_company_slug,
      'pending'
    )
    on conflict (workspace_id) do update set
      name = excluded.name,
      slug = excluded.slug,
      updated_at = now()
    returning id into v_company_id;

    insert into public.workspace_memberships (
      workspace_id,
      user_id,
      membership_role,
      membership_status
    )
    values (
      v_company_workspace_id,
      v_user_id,
      'owner',
      'active'
    )
    on conflict (workspace_id, user_id) do update set
      membership_role = 'owner',
      membership_status = 'active',
      updated_at = now();

    insert into public.company_memberships (
      company_id,
      user_id,
      membership_role,
      membership_status
    )
    values (
      v_company_id,
      v_user_id,
      'owner',
      'active'
    )
    on conflict (company_id, user_id) do update set
      membership_role = 'owner',
      membership_status = 'active';
  end if;

  return v_user_id;
end;
$$;

revoke all on function public.complete_registration(text, text, text, text, text) from public;
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
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
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
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
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

drop trigger if exists mentor_profiles_restrict_verification on public.mentor_profiles;
create trigger mentor_profiles_restrict_verification
before update on public.mentor_profiles
for each row execute function public.prevent_mentor_verification_client_writes();

drop trigger if exists companies_restrict_verification on public.companies;
create trigger companies_restrict_verification
before update on public.companies
for each row execute function public.prevent_company_verification_client_writes();

create policy "workspaces_select_member"
on public.workspaces for select
to authenticated
using (public.is_workspace_member(id));

create policy "workspace_memberships_select_own"
on public.workspace_memberships for select
to authenticated
using (user_id = (select auth.uid()));

create policy "mentor_profiles_select_own"
on public.mentor_profiles for select
to authenticated
using (user_id = (select auth.uid()) or public.is_approved_mentor(user_id));

create policy "companies_select_member"
on public.companies for select
to authenticated
using (public.is_company_member(id));

create policy "company_memberships_select_member"
on public.company_memberships for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_company_member(company_id)
);

revoke all on public.workspaces from anon, authenticated;
revoke all on public.workspace_memberships from anon, authenticated;
revoke all on public.mentor_profiles from anon, authenticated;
revoke all on public.companies from anon, authenticated;
revoke all on public.company_memberships from anon, authenticated;

grant select on public.workspaces to authenticated;
grant select on public.workspace_memberships to authenticated;
grant select on public.mentor_profiles to authenticated;
grant select on public.companies to authenticated;
grant select on public.company_memberships to authenticated;

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_own_only"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

revoke select on public.profiles from anon;

drop policy if exists "skill_scores_select_public" on public.skill_scores;
create policy "skill_scores_select_own_only"
on public.skill_scores for select
to authenticated
using (user_id = (select auth.uid()));

revoke select on public.skill_scores from anon;

drop policy if exists "reviews_select_public" on public.reviews;
create policy "reviews_select_participants_only"
on public.reviews for select
to authenticated
using (
  reviewee_id = (select auth.uid())
  or reviewer_id = (select auth.uid())
);

revoke select on public.reviews from anon;

drop view if exists public.public_profiles;
create view public.public_profiles
with (security_invoker = false)
as
select
  profile.id,
  profile.username,
  profile.display_name,
  profile.headline,
  profile.bio,
  profile.avatar_url,
  profile.location,
  profile.github_username,
  profile.github_profile_url,
  profile.created_at
from public.profiles profile
where profile.is_public = true;

grant select on public.public_profiles to anon, authenticated;

drop view if exists public.public_skill_scores;
create view public.public_skill_scores
with (security_invoker = false)
as
select
  score.user_id,
  score.skill_domain,
  score.composite_score,
  score.evidence_count,
  score.confidence,
  score.updated_at
from public.skill_scores score
join public.profiles profile on profile.id = score.user_id
where profile.is_public = true;

grant select on public.public_skill_scores to anon, authenticated;

drop view if exists public.public_reviews;
create view public.public_reviews
with (security_invoker = false)
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

create or replace function public.prevent_submission_verification_client_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
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
