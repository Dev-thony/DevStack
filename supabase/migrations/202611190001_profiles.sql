create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text,
  headline text,
  bio text,
  avatar_url text,
  location text,
  github_username text,
  github_profile_url text,
  role text not null default 'developer',
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_key unique (username),
  constraint profiles_username_format check (username ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{2,30}$'),
  constraint profiles_role_check check (role in ('developer', 'mentor', 'admin'))
);

alter table public.profiles enable row level security;

create index if not exists profiles_username_idx on public.profiles (username);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_public_idx on public.profiles (is_public) where is_public = true;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
begin
  if new.role is distinct from old.role then
    select role into caller_role
    from public.profiles
    where id = auth.uid();

    if caller_role is distinct from 'admin' then
      raise exception 'Only administrators may change profile roles';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
before update on public.profiles
for each row execute function public.prevent_profile_role_escalation();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  candidate_username text;
  suffix integer := 0;
  metadata_username text;
  github_username text;
  github_profile_url text;
begin
  metadata_username := nullif(trim(coalesce(new.raw_user_meta_data ->> 'preferred_username',
                                              new.raw_user_meta_data ->> 'user_name',
                                              new.raw_user_meta_data ->> 'username')), '');
  github_username := nullif(trim(coalesce(new.raw_user_meta_data ->> 'user_name',
                                           new.raw_user_meta_data ->> 'preferred_username')), '');

  base_username := lower(regexp_replace(coalesce(metadata_username, split_part(coalesce(new.email, ''), '@', 1), 'user'), '[^a-zA-Z0-9_-]', '-', 'g'));
  base_username := regexp_replace(base_username, '^[^a-zA-Z0-9]+', '');
  base_username := left(base_username, 24);
  if length(base_username) < 3 then
    base_username := 'user';
  end if;

  candidate_username := base_username;
  while exists (select 1 from public.profiles where username = candidate_username) loop
    suffix := suffix + 1;
    candidate_username := left(base_username, 24) || '-' || suffix::text;
  end loop;

  if github_username is not null then
    github_profile_url := 'https://github.com/' || github_username;
  end if;

  insert into public.profiles (
    id, username, display_name, avatar_url, github_username, github_profile_url
  ) values (
    new.id,
    candidate_username,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name',
                         new.raw_user_meta_data ->> 'name')), ''),
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    github_username,
    github_profile_url
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

create policy "profiles_select_public"
on public.profiles for select
to anon, authenticated
using (is_public = true);

create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (
  id = (select auth.uid())
  and role = 'developer'
);

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (
  id = (select auth.uid())
);

grant select on public.profiles to anon, authenticated;
grant insert (id, username, display_name, headline, bio, avatar_url, location, github_username, github_profile_url, is_public)
on public.profiles to authenticated;
grant update (username, display_name, headline, bio, avatar_url, location, github_username, github_profile_url, is_public)
on public.profiles to authenticated;
