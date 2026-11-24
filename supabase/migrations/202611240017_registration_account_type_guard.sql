alter function public.complete_registration(text, text, text, text, text, jsonb)
  rename to complete_registration_without_type_guard;

revoke all on function public.complete_registration_without_type_guard(text, text, text, text, text, jsonb)
  from public, anon, authenticated;

create function public.complete_registration(
  p_registration_type text,
  p_username text,
  p_display_name text default null,
  p_company_name text default null,
  p_company_slug text default null,
  p_application jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  primary_type text;
  has_existing_access boolean := false;
  has_workspace_history boolean := false;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select account_type
  into primary_type
  from public.profiles
  where id = actor;

  if primary_type is null then
    select exists (
      select 1
      from public.workspace_memberships membership
      where membership.user_id = actor
    ) into has_workspace_history;
  end if;

  if primary_type is distinct from p_registration_type
     and (primary_type is not null or has_workspace_history) then
    case p_registration_type
      when 'developer' then
        select exists (
          select 1
          from public.workspace_memberships membership
          join public.workspaces workspace on workspace.id = membership.workspace_id
          where membership.user_id = actor
            and membership.membership_status = 'active'
            and workspace.workspace_type = 'personal'
        ) into has_existing_access;
      when 'mentor' then
        has_existing_access := public.is_approved_mentor(actor);
      when 'company' then
        select exists (
          select 1
          from public.companies company
          join public.company_memberships company_membership
            on company_membership.company_id = company.id
          join public.workspace_memberships workspace_membership
            on workspace_membership.workspace_id = company.workspace_id
            and workspace_membership.user_id = company_membership.user_id
          where company_membership.user_id = actor
            and company_membership.membership_status = 'active'
            and workspace_membership.membership_status = 'active'
            and company.verification_status <> 'suspended'
        ) into has_existing_access;
      else
        raise exception 'Invalid registration type' using errcode = '22023';
    end case;

    if not has_existing_access then
      raise exception 'Registration type is not authorized for this account'
        using errcode = '42501';
    end if;
  end if;

  return public.complete_registration_without_type_guard(
    p_registration_type,
    p_username,
    p_display_name,
    p_company_name,
    p_company_slug,
    p_application
  );
end;
$$;

revoke all on function public.complete_registration(text, text, text, text, text, jsonb)
  from public, anon;
grant execute on function public.complete_registration(text, text, text, text, text, jsonb)
  to authenticated;

comment on function public.complete_registration(text, text, text, text, text, jsonb)
  is 'Completes registration only for the primary account type or an independently authorized existing workspace.';
