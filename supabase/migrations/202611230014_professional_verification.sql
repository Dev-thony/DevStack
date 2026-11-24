-- Professional application evidence is separate from workspace-discovery data.
create table public.professional_applications (
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('mentor', 'company')),
  company_id uuid unique references public.companies(id) on delete cascade,
  details jsonb not null check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 16384),
  status text not null default 'pending'
    check (status in ('draft', 'pending', 'under_review', 'approved', 'rejected', 'resubmission_required', 'suspended')),
  submitted_at timestamptz not null default now(),
  feedback text,
  primary key (applicant_id, kind),
  check ((kind = 'company') = (company_id is not null))
);

create table public.professional_review_history (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null,
  kind text not null,
  reviewer_id uuid references public.profiles(id) on delete set null,
  decision text not null,
  feedback text,
  internal_notes text,
  reviewed_at timestamptz not null default now(),
  foreign key (applicant_id, kind) references public.professional_applications(applicant_id, kind) on delete cascade
);

alter table public.professional_applications enable row level security;
alter table public.professional_review_history enable row level security;
revoke all on public.professional_applications, public.professional_review_history from public, anon, authenticated;
grant select on public.professional_applications to authenticated;
create policy professional_applicant_read on public.professional_applications
  for select to authenticated using (applicant_id = (select auth.uid()));

alter function public.complete_registration(text, text, text, text, text)
  rename to bootstrap_registration;
revoke all on function public.bootstrap_registration(text, text, text, text, text) from public, anon, authenticated;

-- Administrative verification can update an existing company without moving it.
create or replace function public.prevent_company_workspace_mismatch()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  workspace_owner uuid;
begin
  select created_by into workspace_owner from public.workspaces
    where id = new.workspace_id and workspace_type = 'company';
  if not found then raise exception 'Company workspace must be a company workspace'; end if;
  if tg_op = 'UPDATE' and new.workspace_id = old.workspace_id and exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then return new; end if;
  if workspace_owner is distinct from auth.uid() and (auth.jwt() ->> 'role') is distinct from 'service_role' then
    raise exception 'Company workspace must belong to the authenticated owner';
  end if;
  return new;
end;
$$;

-- Membership rows must still belong to a company workspace, including pending rows.
create or replace function public.prevent_company_membership_mismatch()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.companies c
    join public.workspaces w on w.id = c.workspace_id and w.workspace_type = 'company'
    join public.workspace_memberships m on m.workspace_id = w.id and m.user_id = new.user_id
    where c.id = new.company_id
      and (new.membership_status <> 'active' or m.membership_status = 'active')
  ) then
    raise exception 'Company membership requires a matching workspace membership';
  end if;
  return new;
end;
$$;

create function public.complete_registration(
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
    update public.workspace_memberships set membership_status = 'pending'
      where workspace_id = company_workspace and user_id = actor;
  end if;

  insert into public.professional_applications(applicant_id, kind, company_id, details)
    values (actor, p_registration_type, target_company, p_application);
  return actor;
end;
$$;

revoke all on function public.complete_registration(text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.complete_registration(text,text,text,text,text,jsonb) to authenticated;

create function public.list_professional_applications()
returns setof public.professional_applications
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  return query select * from public.professional_applications order by submitted_at desc limit 100;
end;
$$;

create function public.review_professional_application(
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

  member_status := case p_decision when 'approved' then 'active' when 'under_review' then 'pending' else 'suspended' end;
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
      and (membership_status <> 'revoked' or member_status <> 'active');
  if not found then raise exception 'Workspace membership unavailable'; end if;

  if p_kind = 'company' and p_decision <> 'suspended' then
    update public.company_memberships set membership_status = member_status
      where company_id = application.company_id and user_id = p_applicant and membership_role = 'owner'
        and (membership_status <> 'revoked' or member_status <> 'active');
    if not found then raise exception 'Company ownership unavailable'; end if;
  end if;

  update public.professional_applications set status = p_decision, feedback = p_feedback
    where applicant_id = p_applicant and kind = p_kind;
  insert into public.professional_review_history(applicant_id,kind,reviewer_id,decision,feedback,internal_notes)
    values (p_applicant,p_kind,actor,p_decision,p_feedback,p_notes);
end;
$$;

revoke all on function public.list_professional_applications() from public, anon, authenticated;
revoke all on function public.review_professional_application(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.list_professional_applications() to authenticated;
grant execute on function public.review_professional_application(uuid,text,text,text,text) to authenticated;

create or replace function public.is_company_member(p_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.company_memberships m
    join public.companies c on c.id = m.company_id and c.verification_status = 'approved'
    join public.workspace_memberships w on w.workspace_id = c.workspace_id and w.user_id = m.user_id
    where m.company_id = p_company_id and m.user_id = auth.uid()
      and m.membership_status = 'active' and w.membership_status = 'active'
  );
$$;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_memberships m
    join public.workspaces w on w.id = m.workspace_id
    where m.workspace_id = p_workspace_id and m.user_id = auth.uid()
      and m.membership_status = 'active'
      and (w.workspace_type <> 'company' or exists (
        select 1 from public.companies c where c.workspace_id = w.id and public.is_company_member(c.id)
      ))
  );
$$;
