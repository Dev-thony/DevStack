create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  description text not null,
  instructions jsonb not null default '[]'::jsonb,
  skill_domain text not null,
  difficulty text not null,
  xp_reward integer not null default 0,
  estimated_hours numeric(4,1),
  rubric jsonb not null,
  is_published boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint challenges_slug_key unique (slug),
  constraint challenges_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint challenges_domain_check
    check (skill_domain in ('frontend', 'backend', 'data', 'devops', 'system_design', 'product')),
  constraint challenges_difficulty_check
    check (difficulty in ('beginner', 'intermediate', 'advanced')),
  constraint challenges_xp_range check (xp_reward >= 0),
  constraint challenges_hours_range check (estimated_hours is null or estimated_hours >= 0),
  constraint challenges_instructions_object check (jsonb_typeof(instructions) = 'array'),
  constraint challenges_rubric_object check (jsonb_typeof(rubric) = 'object')
);

alter table public.challenges enable row level security;

create index if not exists challenges_published_idx on public.challenges (is_published, created_at desc);
create index if not exists challenges_domain_idx on public.challenges (skill_domain);
create index if not exists challenges_difficulty_idx on public.challenges (difficulty);

create trigger challenges_set_updated_at
before update on public.challenges
for each row execute function public.set_updated_at();

create policy "challenges_select_published"
on public.challenges for select
to anon, authenticated
using (is_published = true);

create policy "challenges_manage_mentor_admin"
on public.challenges for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('mentor', 'admin')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('mentor', 'admin')
  )
);

grant select on public.challenges to anon, authenticated;
grant insert (
  slug, title, description, instructions, skill_domain, difficulty,
  xp_reward, estimated_hours, rubric, is_published, created_by
) on public.challenges to authenticated;
grant update (
  slug, title, description, instructions, skill_domain, difficulty,
  xp_reward, estimated_hours, rubric, is_published, created_by
) on public.challenges to authenticated;
