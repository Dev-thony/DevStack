-- Phase 1.5 hardening: idempotent registration, normalized slugs,
-- verified mentor authorization, and synchronized company memberships.

create or replace function public.normalize_workspace_slug(p_value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  with normalized as (
    select trim(both '-' from regexp_replace(
      lower(coalesce(p_value, '')),
      '[^a-z0-9]+',
      '-',
      'g'
    )) as slug
  ),
  truncated as (
    select trim(both '-' from left(slug, 100)) as slug
    from normalized
  )
  select case
    when slug = '' then 'workspace'
    else slug
  end
  from truncated;
$$;

revoke all on function public.normalize_workspace_slug(text) from public;
grant execute on function public.normalize_workspace_slug(text) to authenticated;

create or replace function public.normalize_unique_workspace_slug(
  p_value text,
  p_suffix integer
)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  with base as (
    select public.normalize_workspace_slug(p_value) as slug
  ),
  collision as (
    select trim(both '-' from (
      left(slug, greatest(1, 100 - length(p_suffix::text) - 1))
      || '-' || p_suffix::text
    )) as slug
    from base
  )
  select trim(both '-' from left(slug, 100))
  from collision;
$$;

revoke all on function public.normalize_unique_workspace_slug(text, integer) from public;
grant execute on function public.normalize_unique_workspace_slug(text, integer) to authenticated;

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
  v_workspace_slug text;
  v_personal_workspace_id uuid;
  v_mentor_workspace_id uuid;
  v_company_workspace_id uuid;
  v_company_id uuid;
  v_company_slug text;
  v_company_owner_status text;
  v_company_workspace_status text;
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
  v_username := regexp_replace(v_username, '[^a-zA-Z0-9_-]', '-', 'g');
  v_username := trim(both '-' from v_username);
  v_username := left(v_username, 24);
  if length(v_username) < 3 then
    v_username := split_part(coalesce(v_auth_user.email, ''), '@', 1);
    v_username := lower(regexp_replace(v_username, '[^a-zA-Z0-9_-]', '-', 'g'));
    v_username := trim(both '-' from v_username);
    v_username := left(v_username, 24);
  end if;
  if length(v_username) < 3 then
    v_username := 'user-' || substr(v_user_id::text, 1, 8);
  end if;

  while exists (
    select 1
    from public.profiles profile
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

  select workspace.id
  into v_personal_workspace_id
  from public.workspaces workspace
  where workspace.created_by = v_user_id
    and workspace.workspace_type = 'personal'
  order by workspace.created_at, workspace.id
  limit 1;

  if v_personal_workspace_id is null then
    v_workspace_slug := public.normalize_workspace_slug(v_profile.username);
    v_suffix := 0;
    while exists (
      select 1
      from public.workspaces workspace
      where workspace.slug = v_workspace_slug
        and workspace.created_by is distinct from v_user_id
    ) loop
      v_suffix := v_suffix + 1;
      v_workspace_slug :=
        public.normalize_unique_workspace_slug(v_workspace_slug, v_suffix);
    end loop;

    insert into public.workspaces (
      name,
      slug,
      workspace_type,
      created_by
    )
    values (
      coalesce(nullif(trim(coalesce(p_display_name, '')), ''), v_profile.username),
      v_workspace_slug,
      'personal',
      v_user_id
    )
    returning id into v_personal_workspace_id;
  end if;

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
    updated_at = now();

  if p_registration_type = 'mentor' then
    select workspace.id
    into v_mentor_workspace_id
    from public.workspaces workspace
    where workspace.created_by = v_user_id
      and workspace.workspace_type = 'mentor'
    order by workspace.created_at, workspace.id
    limit 1;

    if v_mentor_workspace_id is null then
      v_workspace_slug :=
        public.normalize_workspace_slug(v_profile.username || '-mentor');
      v_suffix := 0;
      while exists (
        select 1
        from public.workspaces workspace
        where workspace.slug = v_workspace_slug
      ) loop
        v_suffix := v_suffix + 1;
        v_workspace_slug :=
          public.normalize_unique_workspace_slug(
            v_profile.username || '-mentor',
            v_suffix
          );
      end loop;

      insert into public.workspaces (
        name,
        slug,
        workspace_type,
        created_by
      )
      values (
        coalesce(nullif(trim(coalesce(p_display_name, '')), ''), v_profile.username)
          || ' Mentor',
        v_workspace_slug,
        'mentor',
        v_user_id
      )
      returning id into v_mentor_workspace_id;
    end if;

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

    v_company_slug := public.normalize_workspace_slug(
      coalesce(nullif(trim(p_company_slug), ''), p_company_name)
    );

    select company.id,
           company.workspace_id,
           ownership.membership_status
    into v_company_id,
         v_company_workspace_id,
         v_company_owner_status
    from public.companies company
    join public.company_memberships ownership
      on ownership.company_id = company.id
     and ownership.user_id = v_user_id
     and ownership.membership_role = 'owner'
    where company.slug = v_company_slug
    order by company.created_at, company.id
    limit 1;

    v_company_workspace_status := null;
    if v_company_id is not null then
      select membership.membership_status
      into v_company_workspace_status
      from public.workspace_memberships membership
      where membership.workspace_id = v_company_workspace_id
        and membership.user_id = v_user_id;
    end if;

    if v_company_id is not null
       and v_company_owner_status is distinct from 'active'
    then
      raise exception 'Company ownership is suspended or revoked';
    end if;
    if v_company_id is not null
       and v_company_workspace_status is distinct from 'active'
    then
      raise exception 'Company workspace membership is suspended or revoked';
    end if;

    if v_company_id is null then
      v_suffix := 0;
      while exists (
        select 1
        from public.companies company
        where company.slug = v_company_slug
        union all
        select 1
        from public.workspaces workspace
        where workspace.slug = v_company_slug
      ) loop
        v_suffix := v_suffix + 1;
        v_company_slug :=
          public.normalize_unique_workspace_slug(
            coalesce(nullif(trim(p_company_slug), ''), p_company_name),
            v_suffix
          );
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
      returning id into v_company_id;
    else
      update public.companies
      set
        name = p_company_name,
        updated_at = now()
      where id = v_company_id;
    end if;

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
      membership_role = public.company_memberships.membership_role;
  end if;

  return v_user_id;
end;
$$;

revoke all on function public.complete_registration(text, text, text, text, text) from public;
revoke all on function public.complete_registration(text, text, text, text, text) from anon;
grant execute on function public.complete_registration(text, text, text, text, text) to authenticated;

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
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

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

revoke all on function public.prevent_mentor_workspace_mismatch() from public;

create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_memberships company_membership
    join public.companies company
      on company.id = company_membership.company_id
    join public.workspace_memberships workspace_membership
      on workspace_membership.workspace_id = company.workspace_id
     and workspace_membership.user_id = company_membership.user_id
    where company_membership.company_id = p_company_id
      and company_membership.user_id = auth.uid()
      and company_membership.membership_status = 'active'
      and workspace_membership.membership_status = 'active'
  );
$$;

revoke all on function public.is_company_member(uuid) from public;
revoke all on function public.is_company_member(uuid) from anon;
revoke all on function public.is_company_member(uuid) from authenticated;
grant execute on function public.is_company_member(uuid) to authenticated;

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

revoke all on function public.is_approved_mentor(uuid) from public;
revoke all on function public.is_approved_mentor(uuid) from anon;
revoke all on function public.is_approved_mentor(uuid) from authenticated;
grant execute on function public.is_approved_mentor(uuid) to authenticated;

create or replace function public.synchronize_company_membership_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_workspace_id uuid;
begin
  if tg_table_name = 'workspace_memberships' then
    if tg_op = 'DELETE' then
      select company.id
      into v_company_id
      from public.companies company
      where company.workspace_id = old.workspace_id;

      if v_company_id is not null then
        update public.company_memberships
        set membership_status = 'revoked'
        where company_id = v_company_id
          and user_id = old.user_id
          and membership_status is distinct from 'revoked';
      end if;
      return old;
    end if;

    select company.id
    into v_company_id
    from public.companies company
    where company.workspace_id = new.workspace_id;

    if v_company_id is not null then
      update public.company_memberships
      set membership_status = new.membership_status
      where company_id = v_company_id
        and user_id = new.user_id
        and membership_status is distinct from new.membership_status;
    end if;
  elsif tg_table_name = 'company_memberships' then
    if tg_op = 'DELETE' then
      select company.workspace_id
      into v_workspace_id
      from public.companies company
      where company.id = old.company_id;

      if v_workspace_id is not null then
        update public.workspace_memberships
        set membership_status = 'revoked'
        where workspace_id = v_workspace_id
          and user_id = old.user_id
          and membership_status is distinct from 'revoked';
      end if;
      return old;
    end if;

    select company.workspace_id
    into v_workspace_id
    from public.companies company
    where company.id = new.company_id;

    if v_workspace_id is not null then
      update public.workspace_memberships
      set membership_status = new.membership_status
      where workspace_id = v_workspace_id
        and user_id = new.user_id
        and membership_status is distinct from new.membership_status;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.synchronize_company_membership_status() from public;

drop trigger if exists workspace_memberships_company_sync on public.workspace_memberships;
create trigger workspace_memberships_company_sync
after insert or update on public.workspace_memberships
for each row execute function public.synchronize_company_membership_status();

drop trigger if exists workspace_memberships_company_delete_sync on public.workspace_memberships;
create trigger workspace_memberships_company_delete_sync
after delete on public.workspace_memberships
for each row execute function public.synchronize_company_membership_status();

drop trigger if exists company_memberships_workspace_sync on public.company_memberships;
create trigger company_memberships_workspace_sync
after insert or update on public.company_memberships
for each row execute function public.synchronize_company_membership_status();

drop trigger if exists company_memberships_workspace_delete_sync on public.company_memberships;
create trigger company_memberships_workspace_delete_sync
after delete on public.company_memberships
for each row execute function public.synchronize_company_membership_status();

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
join public.profiles profile
  on profile.id = score.user_id
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
join public.profiles profile
  on profile.id = review.reviewee_id
where review.is_public = true
  and profile.is_public = true;

grant select on public.public_reviews to anon, authenticated;

drop view if exists public.public_submissions;
create view public.public_submissions
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
join public.profiles profile
  on profile.id = submission.user_id
where submission.status in ('verified', 'approved')
  and profile.is_public = true;

grant select on public.public_submissions to anon, authenticated;
