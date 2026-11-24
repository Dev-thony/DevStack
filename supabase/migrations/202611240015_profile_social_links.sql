alter table public.profiles
  add column if not exists linkedin_url text,
  add column if not exists x_url text,
  add column if not exists website_url text;

alter table public.profiles
  add constraint profiles_linkedin_url_check
    check (
      linkedin_url is null
      or linkedin_url ~ '^https://(www\.)?linkedin\.com/in/[A-Za-z0-9._%-]+/?$'
    ),
  add constraint profiles_x_url_check
    check (
      x_url is null
      or x_url ~ '^https://(www\.)?(x\.com|twitter\.com)/[A-Za-z0-9_]{1,15}/?$'
    ),
  add constraint profiles_website_url_check
    check (
      website_url is null
      or website_url ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?(/[^[:space:]@]*)?(\?[^[:space:]@]*)?(#[^[:space:]@]*)?$'
    );

grant update (github_username, github_profile_url, linkedin_url, x_url, website_url)
on public.profiles to authenticated;

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
  profile.linkedin_url,
  profile.x_url,
  profile.website_url,
  profile.created_at
from public.profiles profile
where profile.is_public = true;

comment on column public.public_profiles.id is 'Public passport profile UUID.';
grant select on public.public_profiles to anon, authenticated;
