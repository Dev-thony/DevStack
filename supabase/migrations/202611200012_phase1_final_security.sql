-- Phase 1.5 final security corrections.
-- Forward-only migration. It assumes migrations 001-011 are applied.

-- Profiles: remove broad public table SELECT policy/grant. Public access is
-- intentionally limited to public_profiles.
drop policy if exists "profiles_select_public" on public.profiles;
revoke select on public.profiles from anon;

-- Keep an explicit owner read policy.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

-- Skill scores: remove broad public table SELECT policy/grant. Public access
-- is intentionally limited to public_skill_scores.
drop policy if exists "skill_scores_select_public" on public.skill_scores;
revoke select on public.skill_scores from anon;

drop policy if exists "skill_scores_select_own" on public.skill_scores;
create policy "skill_scores_select_own"
on public.skill_scores for select
to authenticated
using (user_id = (select auth.uid()));

-- Reviews: remove public anonymous table policy/grant. Public access is
-- intentionally limited to public_reviews.
drop policy if exists "reviews_select_public" on public.reviews;
revoke select on public.reviews from anon;

drop policy if exists "reviews_select_own_submission" on public.reviews;
create policy "reviews_select_own_submission"
on public.reviews for select
to authenticated
using (
  reviewee_id = (select auth.uid())
  or reviewer_id = (select auth.uid())
);

-- Submissions: add only owner/public-approved view access. Direct anonymous
-- submission SELECT remains denied.
revoke select on public.submissions from anon;

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
    select company.id
    into v_company_id
    from public.companies company
    where company.workspace_id =
      case when tg_op = 'DELETE' then old.workspace_id else new.workspace_id end;

    if v_company_id is not null then
      if tg_op = 'DELETE' then
        update public.company_memberships
        set membership_status = 'revoked'
        where company_id = v_company_id
          and user_id = old.user_id
          and membership_status is distinct from 'revoked';
        return old;
      end if;

      if new.membership_status in ('suspended', 'revoked') then
        update public.company_memberships
        set membership_status = new.membership_status
        where company_id = v_company_id
          and user_id = new.user_id
          and membership_status is distinct from new.membership_status;
      elsif new.membership_status = 'pending' then
        update public.company_memberships
        set membership_status = 'pending'
        where company_id = v_company_id
          and user_id = new.user_id
          and membership_status is distinct from 'pending';
      end if;
    end if;
  elsif tg_table_name = 'company_memberships' then
    select company.workspace_id
    into v_workspace_id
    from public.companies company
    where company.id =
      case when tg_op = 'DELETE' then old.company_id else new.company_id end;

    if v_workspace_id is not null then
      if tg_op = 'DELETE' then
        update public.workspace_memberships
        set membership_status = 'revoked'
        where workspace_id = v_workspace_id
          and user_id = old.user_id
          and membership_status is distinct from 'revoked';
        return old;
      end if;

      if new.membership_status in ('suspended', 'revoked') then
        update public.workspace_memberships
        set membership_status = new.membership_status
        where workspace_id = v_workspace_id
          and user_id = new.user_id
          and membership_status is distinct from new.membership_status;
      elsif new.membership_status = 'pending' then
        update public.workspace_memberships
        set membership_status = 'pending'
        where workspace_id = v_workspace_id
          and user_id = new.user_id
          and membership_status is distinct from 'pending';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.synchronize_company_membership_status() from public;

create or replace function public.activate_company_membership(
  p_company_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'Company membership activation requires service-role authorization';
  end if;

  select workspace_id
  into v_workspace_id
  from public.companies
  where id = p_company_id;

  if v_workspace_id is null then
    raise exception 'Company not found';
  end if;

  if not exists (
    select 1
    from public.company_memberships
    where company_id = p_company_id
      and user_id = p_user_id
  ) then
    raise exception 'Company membership not found';
  end if;

  if not exists (
    select 1
    from public.workspace_memberships
    where workspace_id = v_workspace_id
      and user_id = p_user_id
  ) then
    raise exception 'Company workspace membership not found';
  end if;

  if not exists (
    select 1
    from public.company_memberships
    where company_id = p_company_id
      and user_id = p_user_id
  ) then
    raise exception 'Company membership not found';
  end if;

  if not exists (
    select 1
    from public.workspace_memberships
    where workspace_id = v_workspace_id
      and user_id = p_user_id
  ) then
    raise exception 'Company workspace membership not found';
  end if;

  update public.company_memberships
  set membership_status = 'active'
  where company_id = p_company_id
    and user_id = p_user_id;

  update public.workspace_memberships
  set membership_status = 'active'
  where workspace_id = v_workspace_id
    and user_id = p_user_id;
end;
$$;

revoke all on function public.activate_company_membership(uuid, uuid) from public;
revoke all on function public.activate_company_membership(uuid, uuid) from anon;
revoke all on function public.activate_company_membership(uuid, uuid) from authenticated;
grant execute on function public.activate_company_membership(uuid, uuid) to service_role;

drop trigger if exists workspace_memberships_company_sync on public.workspace_memberships;
create trigger workspace_memberships_company_sync
after insert or update of membership_status on public.workspace_memberships
for each row execute function public.synchronize_company_membership_status();

drop trigger if exists workspace_memberships_company_delete_sync on public.workspace_memberships;
create trigger workspace_memberships_company_delete_sync
after delete on public.workspace_memberships
for each row execute function public.synchronize_company_membership_status();

drop trigger if exists company_memberships_workspace_sync on public.company_memberships;
create trigger company_memberships_workspace_sync
after insert or update of membership_status on public.company_memberships
for each row execute function public.synchronize_company_membership_status();

drop trigger if exists company_memberships_workspace_delete_sync on public.company_memberships;
create trigger company_memberships_workspace_delete_sync
after delete on public.company_memberships
for each row execute function public.synchronize_company_membership_status();

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

revoke all on function public.prevent_mentor_workspace_mismatch() from public;

drop trigger if exists mentor_profiles_workspace_integrity on public.mentor_profiles;
create trigger mentor_profiles_workspace_integrity
before insert or update on public.mentor_profiles
for each row execute function public.prevent_mentor_workspace_mismatch();

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

  v_username := public.normalize_public_username(p_username);
  if v_username is null then
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
      v_workspace_slug := public.normalize_unique_workspace_slug(v_workspace_slug, v_suffix);
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
      v_workspace_slug := public.normalize_workspace_slug(
        v_profile.username || '-mentor'
      );
      v_suffix := 0;
      while exists (
        select 1
        from public.workspaces workspace
        where workspace.slug = v_workspace_slug
      ) loop
        v_suffix := v_suffix + 1;
        v_workspace_slug :=
          public.normalize_unique_workspace_slug(v_profile.username || '-mentor', v_suffix);
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

    if v_company_id is not null then
      select membership.membership_status
      into v_company_workspace_status
      from public.workspace_memberships membership
      where membership.workspace_id = v_company_workspace_id
        and membership.user_id = v_user_id;

      if v_company_owner_status is distinct from 'active'
         or v_company_workspace_status is distinct from 'active'
      then
        raise exception 'Company ownership or workspace membership is suspended or revoked';
      end if;

      update public.companies
      set name = p_company_name, updated_at = now()
      where id = v_company_id;
    else
      if exists (
        select 1
        from public.companies company
        where company.slug = v_company_slug
        union all
        select 1
        from public.workspaces workspace
        where workspace.slug = v_company_slug
      ) then
        raise exception 'Slug unavailable';
      end if;

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
      );

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
      );
    end if;
  end if;

  return v_user_id;
end;
$$;

revoke all on function public.complete_registration(text, text, text, text, text) from public;
revoke all on function public.complete_registration(text, text, text, text, text) from anon;
grant execute on function public.complete_registration(text, text, text, text, text) to authenticated;

create or replace function public.normalize_public_username(p_value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  with normalized as (
    select trim(both '-' from regexp_replace(
      lower(coalesce(p_value, '')),
      '[^a-z0-9_-]+',
      '-',
      'g'
    )) as username
  )
  select case
    when length(username) < 3 then null
    else left(username, 24)
  end
  from normalized;
$$;

revoke all on function public.normalize_public_username(text) from public;
grant execute on function public.normalize_public_username(text) to authenticated;

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

comment on column public.public_profiles.id is 'Public passport profile UUID.';
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

comment on column public.public_skill_scores.user_id is 'Public passport profile UUID.';
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

comment on column public.public_reviews.id is 'Public review record UUID.';
comment on column public.public_reviews.reviewee_id is 'Public passport profile UUID.';
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

comment on column public.public_submissions.id is 'Public submission record UUID.';
comment on column public.public_submissions.user_id is 'Public passport profile UUID.';
comment on column public.public_submissions.challenge_id is 'Public challenge record UUID.';
grant select on public.public_submissions to anon, authenticated;
