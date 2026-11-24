-- Basic workspace access and professional approval have independent lifecycles.
alter table public.profiles add column account_type text
  check (account_type in ('developer','mentor','company'));

create function public.protect_profile_account_type()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon','authenticated') then
    if tg_op = 'INSERT' then
      if new.account_type is not null then raise insufficient_privilege; end if;
    elsif new.account_type is distinct from old.account_type then
      raise insufficient_privilege;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_profile_account_type() from public, anon, authenticated;
create trigger profiles_protect_account_type before insert or update on public.profiles
  for each row execute function public.protect_profile_account_type();

-- A personal workspace created in the same transaction as a professional
-- workspace is a legacy bootstrap artifact unless independent activity exists.
with professional_owner as (
  select distinct on (w.created_by) w.created_by, w.workspace_type, w.created_at
  from public.workspaces w
  where w.workspace_type in ('mentor','company')
  order by w.created_by,w.created_at,w.id
), bootstrap_only as (
  select w.id, w.created_by, w.created_at
  from public.workspaces w
  join professional_owner p on p.created_by=w.created_by and p.created_at=w.created_at
  where w.workspace_type='personal'
    and not exists (select 1 from public.profiles a where a.id=w.created_by and a.role='admin')
    and not exists (select 1 from public.submissions s where s.user_id=w.created_by)
    and not exists (select 1 from public.challenge_progress c where c.user_id=w.created_by)
    and not exists (select 1 from public.skill_scores s where s.user_id=w.created_by and s.evidence_count>0)
    and not exists (select 1 from public.reviews r where r.reviewer_id=w.created_by and r.reviewer_type='peer')
)
update public.workspace_memberships m set membership_status='revoked'
from bootstrap_only b
where m.workspace_id=b.id and m.user_id=b.created_by and m.created_at=b.created_at and m.membership_role='developer'
  and m.membership_status='active';

update public.profiles p set account_type=coalesce(
  (select case w.workspace_type when 'personal' then 'developer' else w.workspace_type end
    from public.workspaces w where w.created_by=p.id
      and (w.workspace_type <> 'personal' or exists (
        select 1 from public.workspace_memberships m where m.workspace_id=w.id and m.user_id=p.id
          and m.membership_status='active'
      ))
    order by w.created_at,(w.workspace_type='personal'),w.id limit 1),
  'developer'
)
where p.account_type is null and exists (select 1 from public.workspaces w where w.created_by=p.id);

-- Existing pending applicants gain basic membership; explicit suspension and
-- revocation are preserved. Phase 3.9 company rows are synchronized in order.
update public.workspace_memberships m set membership_status='active'
from public.mentor_profiles p
where p.workspace_id=m.workspace_id and p.user_id=m.user_id
  and p.verification_status='pending' and m.membership_status='pending';

update public.workspace_memberships m set membership_status='active'
from public.companies c join public.company_memberships cm on cm.company_id=c.id
join public.workspaces w on w.id=c.workspace_id and w.created_by=cm.user_id
where c.workspace_id=m.workspace_id and cm.user_id=m.user_id and cm.membership_role='owner'
  and c.verification_status='pending' and cm.membership_status='pending'
  and m.membership_status='pending';

update public.company_memberships cm set membership_status='active'
from public.companies c join public.workspace_memberships m on m.workspace_id=c.workspace_id
join public.workspaces w on w.id=c.workspace_id and w.created_by=m.user_id
where cm.company_id=c.id and cm.user_id=m.user_id and cm.membership_role='owner'
  and c.verification_status='pending'
  and cm.membership_status='pending' and m.membership_status='active';

create or replace function public.bootstrap_registration(
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
    is_public,
    account_type
  )
  values (
    v_user_id,
    v_username,
    nullif(trim(coalesce(p_display_name, '')), ''),
    'developer',
    true,
    p_registration_type
  )
  on conflict (id) do update set
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    account_type = coalesce(public.profiles.account_type, excluded.account_type);

  select * into v_profile
  from public.profiles
  where id = v_user_id;

  if p_registration_type = 'developer' then
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

  end if;

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
      'active'
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

create or replace function public.complete_registration(
  p_registration_type text, p_username text, p_display_name text default null,
  p_company_name text default null, p_company_slug text default null,
  p_application jsonb default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  existing public.professional_applications;
  target_company uuid;
  company_workspace uuid;
  required_fields text[];
  optional_fields text[];
  field text;
begin
  if actor is null or p_registration_type is null
    or p_registration_type not in ('developer','mentor','company') then
    raise exception 'Registration is unavailable' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 14));
  if p_registration_type = 'developer' then
    if exists (select 1 from public.profiles where id = actor and account_type in ('mentor','company')) then
      if exists (
        select 1 from public.workspace_memberships m join public.workspaces w on w.id=m.workspace_id
        where m.user_id=actor and m.membership_status='active' and w.workspace_type='personal'
      ) then return actor; end if;
      raise exception 'Developer membership requires independent authorization' using errcode = '42501';
    end if;
    return public.bootstrap_registration('developer', p_username, p_display_name, null, null);
  end if;

  if jsonb_typeof(p_application) is distinct from 'object' or pg_column_size(p_application) > 16384 then
    raise exception 'Professional evidence is required' using errcode = '22023';
  end if;

  required_fields := case p_registration_type when 'mentor' then
    array['headline','biography','expertise','yearsExperience','linkedin','github','portfolio']
    else array['companyName','position','website','linkedin','industry','size','description','representativeLinkedin'] end;
  optional_fields := case p_registration_type when 'mentor' then
    array['stackOverflow','social','otherLink','mentoring','certifications']
    else array['github','social','otherLink','registrationNumber'] end;
  if exists (select 1 from jsonb_object_keys(p_application) as keys(key)
    where key <> all(required_fields || optional_fields)) then
    raise exception 'Unexpected application field' using errcode = '22023';
  end if;
  if p_registration_type = 'mentor' and (
    jsonb_typeof(p_application -> 'yearsExperience') is distinct from 'number'
    or coalesce(p_application ->> 'yearsExperience','') !~ '^([0-9]|[1-7][0-9]|80)$'
  ) then
    raise exception 'Invalid years of experience' using errcode = '22023';
  end if;
  foreach field in array required_fields loop
    if length(trim(coalesce(p_application ->> field, ''))) < 1 or
      (field <> 'yearsExperience' and jsonb_typeof(p_application -> field) is distinct from 'string') then
      raise exception 'Required application field is missing' using errcode = '22023';
    end if;
  end loop;
  foreach field in array array['linkedin','github','portfolio','website','representativeLinkedin','social','otherLink','stackOverflow'] loop
    if coalesce(p_application ->> field, '') <> ''
      and (length(p_application ->> field) > 500 or (p_application ->> field) !~ '^https://[^/@[:space:]]+([/?#]|$)') then
      raise exception 'Invalid application URL' using errcode = '22023';
    end if;
  end loop;

  select * into existing from public.professional_applications
    where applicant_id = actor and kind = p_registration_type for update;
  if found then
    if existing.status not in ('draft','resubmission_required','rejected') then
      if existing.details = p_application then return actor; end if;
      raise exception 'Application is already submitted' using errcode = '23505';
    end if;
    if existing.submitted_at > now() - interval '1 minute' then
      raise exception 'Wait before resubmitting' using errcode = 'P0001';
    end if;
    update public.professional_applications
      set details = p_application, status = 'pending', submitted_at = now(), feedback = null
      where applicant_id = actor and kind = p_registration_type;
    return actor;
  end if;

  if p_registration_type = 'company' and p_application ->> 'companyName' is distinct from p_company_name then
    raise exception 'Company name must match the application' using errcode = '22023';
  end if;

  if p_registration_type = 'mentor' then
    perform public.bootstrap_registration('mentor', p_username, p_display_name, null, null);
    if not exists (select 1 from public.mentor_profiles where user_id = actor and verification_status = 'pending') then
      raise exception 'Existing mentor status must be handled by an administrator' using errcode = '42501';
    end if;
  else
    select c.id, c.workspace_id into target_company, company_workspace
      from public.companies c join public.company_memberships m on m.company_id = c.id
      join public.workspace_memberships w on w.workspace_id = c.workspace_id and w.user_id = m.user_id
      where m.user_id = actor and m.membership_role = 'owner' and c.verification_status = 'pending'
        and m.membership_status in ('active','pending') and w.membership_status in ('active','pending')
      order by c.created_at, c.id limit 1;
    if target_company is null then
      if exists (select 1 from public.company_memberships where user_id = actor and membership_role = 'owner') then
        raise exception 'Existing company must be handled by an administrator' using errcode = '42501';
      end if;
      -- Use the full authenticated ID so retries and similarly named companies cannot collide.
      p_company_slug := left(rtrim(public.normalize_workspace_slug(p_company_name), '-'), 60)
        || '-' || replace(actor::text, '-', '');
      perform public.bootstrap_registration('company', p_username, p_display_name, p_company_name, p_company_slug);
      select c.id, c.workspace_id into strict target_company, company_workspace
        from public.companies c where c.slug = p_company_slug;
    end if;
    update public.workspace_memberships set membership_status = 'active'
      where workspace_id = company_workspace and user_id = actor and membership_status = 'pending';
    update public.company_memberships set membership_status = 'active'
      where company_id = target_company and user_id = actor and membership_status = 'pending';
  end if;

  insert into public.professional_applications(applicant_id, kind, company_id, details)
    values (actor, p_registration_type, target_company, p_application);
  return actor;
end;
$$;

create or replace function public.review_professional_application(
  p_applicant uuid, p_kind text, p_decision text, p_feedback text, p_notes text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  application public.professional_applications;
  workspace uuid;
  member_status text;
  entity_status text;
begin
  if actor is null or actor = p_applicant or not exists (
    select 1 from public.profiles where id = actor and role = 'admin'
  ) then raise exception 'Administrator required' using errcode = '42501'; end if;

  if p_decision is null or p_decision not in ('approved','rejected','resubmission_required','under_review','suspended')
    or length(coalesce(p_feedback,'')) > 500 or length(coalesce(p_notes,'')) > 3000
    or (p_decision in ('rejected','resubmission_required') and coalesce(trim(p_feedback),'') = '') then
    raise exception 'Invalid review' using errcode = '22023';
  end if;

  select * into application from public.professional_applications
    where applicant_id = p_applicant and kind = p_kind for update;
  if not found then raise exception 'Application not found' using errcode = 'P0002'; end if;
  if not ((application.status in ('pending','under_review')
    and p_decision in ('approved','rejected','resubmission_required','under_review'))
    or (application.status = 'approved' and p_decision = 'suspended')) then
    raise exception 'Application status changed' using errcode = '23505';
  end if;

  member_status := case p_decision when 'suspended' then 'suspended' else 'active' end;
  entity_status := case p_decision when 'approved' then 'approved' when 'suspended' then 'suspended'
    when 'under_review' then 'pending' else 'rejected' end;

  if p_kind = 'mentor' then
    update public.mentor_profiles set
      verification_status = entity_status,
      verified_at = case when p_decision = 'approved' then now() else null end,
      expertise = string_to_array(application.details ->> 'expertise', ','),
      biography = application.details ->> 'biography'
      where user_id = p_applicant returning workspace_id into strict workspace;
    if p_decision = 'approved' then
      update public.profiles set role = 'mentor' where id = p_applicant and role = 'developer';
    elsif p_decision = 'suspended' then
      update public.profiles set role = 'developer' where id = p_applicant and role = 'mentor';
    end if;
  else
    update public.companies set verification_status = entity_status
      where id = application.company_id returning workspace_id into strict workspace;
  end if;

  update public.workspace_memberships set membership_status = member_status
    where workspace_id = workspace and (user_id = p_applicant or (p_kind = 'company' and p_decision = 'suspended'))
      and (membership_status in ('active','pending'));
  if not found then raise exception 'Workspace membership unavailable'; end if;

  if p_kind = 'company' and p_decision <> 'suspended' then
    update public.company_memberships set membership_status = member_status
      where company_id = application.company_id and user_id = p_applicant and membership_role = 'owner'
        and (membership_status in ('active','pending'));
    if not found then raise exception 'Company ownership unavailable'; end if;
  end if;

  update public.professional_applications set status = p_decision, feedback = p_feedback
    where applicant_id = p_applicant and kind = p_kind;
  insert into public.professional_review_history(applicant_id,kind,reviewer_id,decision,feedback,internal_notes)
    values (p_applicant,p_kind,actor,p_decision,p_feedback,p_notes);
end;
$$;


-- The approved-company predicate remains unchanged for privileged callers.
create function public.has_company_workspace_access(p_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.company_memberships cm
    join public.companies c on c.id=cm.company_id
    join public.workspace_memberships wm on wm.workspace_id=c.workspace_id and wm.user_id=cm.user_id
    where cm.company_id=p_company_id and cm.user_id=auth.uid()
      and c.verification_status <> 'suspended' and cm.membership_status='active' and wm.membership_status='active'
  )
$$;
revoke all on function public.has_company_workspace_access(uuid) from public, anon, authenticated;
grant execute on function public.has_company_workspace_access(uuid) to authenticated;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_memberships m
    join public.workspaces w on w.id=m.workspace_id
    where w.id=p_workspace_id and m.user_id=auth.uid() and m.membership_status='active'
      and (w.workspace_type <> 'mentor' or exists (
        select 1 from public.mentor_profiles mp where mp.workspace_id=w.id and mp.user_id=m.user_id
          and mp.verification_status <> 'suspended'
      ))
      and (w.workspace_type <> 'company' or exists (
        select 1 from public.companies c where c.workspace_id=w.id and public.has_company_workspace_access(c.id)
      ))
  )
$$;

-- Keep raw company rows and contact columns behind the original policy.
create function public.get_company_workspace_summary(p_workspace_id uuid)
returns table (id uuid, name text, slug text, verification_status text)
language sql stable security definer set search_path = '' as $$
  select c.id,c.name,c.slug,c.verification_status
  from public.companies c where c.workspace_id=p_workspace_id
    and public.has_company_workspace_access(c.id)
$$;
revoke all on function public.get_company_workspace_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_company_workspace_summary(uuid) to authenticated;
alter policy mentor_profiles_select_own on public.mentor_profiles
  using (user_id = (select auth.uid()));

create function public.discover_public_mentors(p_company_id uuid, p_query text default '', p_expertise text default '')
returns table (
  username text, display_name text, headline text, biography text, expertise text[],
  availability_status text, github_url text, linkedin_url text
)
language sql stable security definer set search_path = '' as $$
  select p.username,p.display_name,p.headline,coalesce(p.bio,m.biography),
    m.expertise,m.availability_status,p.github_profile_url,p.linkedin_url
  from public.mentor_profiles m
  join public.profiles p on p.id=m.user_id and p.is_public
  where public.has_company_workspace_access(p_company_id)
    and public.is_approved_mentor(m.user_id)
    and (coalesce(p_query,'') = '' or strpos(lower(concat_ws(' ',p.username,p.display_name,p.headline)),lower(left(p_query,100))) > 0)
    and (coalesce(p_expertise,'') = '' or exists (
      select 1 from unnest(m.expertise) as skill
      where strpos(lower(skill),lower(left(p_expertise,100))) > 0
    ))
  order by p.username
  limit 50
$$;
revoke all on function public.discover_public_mentors(uuid,text,text) from public, anon, authenticated;
grant execute on function public.discover_public_mentors(uuid,text,text) to authenticated;


-- The review queue contains owner-private evidence. Only eligible reviewers
-- may use it; Company Discovery and public passports use public projections.
alter policy submissions_select_review_queue on public.submissions using (
  user_id is distinct from (select auth.uid()) and status in ('verified','approved')
  and (public.is_approved_mentor((select auth.uid())) or exists (
    select 1 from public.workspace_memberships m join public.workspaces w on w.id=m.workspace_id
    where m.user_id=(select auth.uid()) and m.membership_status='active' and w.workspace_type='personal'
  ))
);

create or replace function public.reviews_validate_reviewer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  submission_owner uuid;
  submission_status text;
begin
  if new.reviewer_type = 'mentor' and not public.is_approved_mentor(new.reviewer_id) then
    raise insufficient_privilege;
  end if;
  if new.reviewer_type = 'peer' and not exists (
    select 1 from public.workspace_memberships m join public.workspaces w on w.id=m.workspace_id
    where m.user_id=new.reviewer_id and m.membership_status='active' and w.workspace_type='personal'
  ) then raise insufficient_privilege; end if;
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
    return new;
  end if;

  select user_id, status
  into submission_owner, submission_status
  from public.submissions
  where id = new.submission_id;

  if submission_owner is null then
    raise exception 'Submission does not exist';
  end if;
  if submission_status not in ('verified', 'approved') then
    raise exception 'Only verified or approved submissions may be reviewed';
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
  return new;
end;
$$;

-- A stale profile role cannot administer challenges after Mentor access is revoked.
alter policy challenges_manage_mentor_admin on public.challenges
  using (
    public.is_approved_mentor((select auth.uid()))
    or exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin')
  )
  with check (
    public.is_approved_mentor((select auth.uid()))
    or exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin')
  );
