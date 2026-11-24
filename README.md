# DevStack --- Verifiable Skills Passport

> **Don't just claim your skills. Prove them.** DevStack turns
> practical engineering work, GitHub repository evidence, and trusted
> peer/mentor feedback into a living developer passport that developers
> can share.

## Product overview

DevStack is an evidence-first developer portfolio and skills
assessment platform. Developers connect GitHub, complete practical
engineering challenges, submit public repositories for transparent
checks, receive structured peer or mentor reviews, and build a **Live
Skill Passport** that updates as evidence is approved.

### The problem

CVs list technologies, portfolios show projects, and certificates show
course completion. None alone makes it easy to assess the quality,
recency, or context of a developer's practical engineering work.

### The solution

1. **Identity:** create a profile and connect GitHub.
2. **Challenges:** complete practical tasks with clear instructions and
    rubrics.
3. **Repository evidence:** submit a public GitHub repository for
    transparent metadata, README, workflow, check, and activity
    inspection.
4. **Human review:** receive structured peer or mentor assessments.
5. **Passport:** publish a shareable profile with skill dimensions,
    verified repositories, reviews, and an explainable score.

### The Live Skill Passport

The passport is not a static portfolio. Repository syncs, approved
challenges, and reviews trigger server-side score recalculation.

It includes: - **Live Skill Score:** 0--1000, derived from
evidence-bearing skill domains. - **Skill Radar:** six-domain Recharts
radar chart. - **Verified repositories:** timestamped evidence snapshots
and transparent check statuses. - **Challenge history:** practical work
and outcomes. - **Peer/mentor reviews:** reviewer type, rubric scores,
feedback, and decision. - **Evidence trail:** links from score changes
to contributing evidence. - **Public URL:** for example, `/u/alexchen`.

> **Trust rule:** GitHub metadata checks are not the same as executing
> arbitrary code. Never claim DevStack ran code unless a trusted
> GitHub Actions workflow/check reports that result. A SHA-256
> fingerprint detects changes to a stored evidence snapshot; it does not
> prove GitHub authorship or provide blockchain guarantees.

## Product principles

- Evidence before claims; self-declared skills are distinct from
    reviewed achievements.
- Every score has a visible source and deterministic calculation.
- Human judgment complements automation.
- MVP GitHub integration is read-only and supports public
    repositories.
- Private profile fields, email, and OAuth tokens never appear on
    public passports.
- Complete the developer → challenge → submission → review → passport
    journey before optional features.

## Technology stack

  -----------------------------------------------------------------------------------
  Layer                   Technology              Responsibility
  ----------------------- ----------------------- -----------------------------------
  Framework               Next.js App Router      Routing, layouts, Server
                                                  Components, route handlers

  Language                TypeScript              Shared contracts and safer code

  Styling                 Tailwind CSS            Responsive styling and tokens

  UI                      shadcn/ui + Radix UI    Accessible forms, dialogs, cards

  Charts                  Recharts                Skill Radar and score visuals

  Database                Supabase PostgreSQL     Relational data, migrations, RLS

  Authentication          Supabase Auth           Email/password and GitHub OAuth

  GitHub                  GitHub REST API         Public repository metadata and CI
                                                  evidence

  Validation              Zod                     Validate requests and external data

  Forms                   React Hook Form         Form state

  Icons                   Lucide React            Interface icons

  Fonts                   Inter + JetBrains Mono  UI and technical metadata

Coding agent            GitHub Copilot in VS    Agent Mode guided by
                          Code                    `.github/copilot-instructions.md`
  -----------------------------------------------------------------------------------

Use npm and commit `package-lock.json`.

## Sitemap

### Public and authentication

  -----------------------------------------------------------------------
  Route                   Screen                  Main contents
  ----------------------- ----------------------- -----------------------
  `/`                     Landing                 Public navbar,
                                                  headline, CTAs,
                                                  passport preview,
                                                  benefits

  `/login`                Log In                  GitHub OAuth CTA and
                                                  email fallback

  `/signup`               Get Started             Account creation

`/u/[username]`         Public Passport         Public identity, score,
                                                  radar, repos, reviews,
                                                  evidence, Contact/Hire
                                                  CTA
  -----------------------------------------------------------------------

### Authenticated application

  -----------------------------------------------------------------------
  Route                   Screen                  Main contents
  ----------------------- ----------------------- -----------------------
  `/app`                  Overview                KPIs, activity, score
                                                  changes, challenge
                                                  progress, sync events,
                                                  quick actions

  `/app/passport`         Skill Passport          Score, radar, skills,
                                                  repositories, reviews,
                                                  share actions

  `/app/proofs`           Proofs / Challenges     Challenge catalog,
                                                  filters, difficulty,
                                                  XP, submission panel

  `/app/projects`         Projects / Verified     Repositories, Sync &
                          Repos                   Verify, audit status,
                                                  tech stack, sync time

  `/app/mentors`          Mentors Transition      Transition card guiding
                                                  developers to the Mentor
                                                  Workspace

  `/mentor`               Mentor Overview         Mentor identity and verification,
                                                  review activity, profile

  `/mentor/pending`       Pending Mentor Status   Pending verification review
                                                  status and declared domains

  `/mentor/mentors`       Mentor Profile          Expertise, availability,
                                                  verification state

  `/mentor/votes`         Mentor Votes            Phase 4 placeholder

  `/mentor/reviews`       Mentor Reviews          Accessible submitted reviews

  `/company/[slug]`       Company Overview        Company identity,
                                                  membership, public discovery

  `/company/[slug]/passport`
                          Public Passport Search  Username validation and
                                                  public passport navigation

  `/company/[slug]/projects`
                          Public Projects         Public verified/approved
                                                  submission records

`/company/[slug]/mentors`
                          Mentor Discovery        Public verified mentor list,
                                                  expertise badges, bio
  -----------------------------------------------------------------------

### Lightweight modals/drawers

Do not build full-page products for these in the six-day MVP.

  -----------------------------------------------------------------------
  UI surface              Trigger                 MVP behavior
  ----------------------- ----------------------- -----------------------
  Pricing                 Landing navbar          Explain free MVP/future
                                                  plans; no payments

  Opportunities           App navigation          Curated placeholder or
                                                  coming soon; no
                                                  scraping

  Notifications           Header bell             Recent events and
                                                  read/unread state

Account Settings        Avatar menu             Social links, profile
                                                  visibility, username,
                                                  GitHub connection,
                                                  sign out
  -----------------------------------------------------------------------

Marketing pages use a public top navbar. Authenticated pages use a slim
sidebar and compact header. Public passports have no app sidebar. Mobile
navigation uses a drawer.

## Architecture

``` mermaid
flowchart TD
    USER[Developer / Mentor / Recruiter] --> NEXT[Next.js App Router]
    NEXT --> UI[Tailwind + shadcn/ui + Recharts]
    NEXT --> AUTH[Supabase Auth]
    NEXT --> API[Route Handlers / Server Actions]
    API --> DB[(Supabase PostgreSQL)]
    API --> GH[GitHub REST API - read only]
    DB --> RLS[Postgres Row Level Security]
    API --> VERIFY[Repository Evidence Service]
    VERIFY --> DB
    API --> SCORE[Deterministic Scoring Service]
    SCORE --> DB
    DB --> PASS[Live Skill Passport]
    PASS --> PUBLIC[Public /u/username route]
```

Flow: authenticate → submit public repository → fetch GitHub evidence
server-side → store timestamped snapshot → review submission →
recalculate scores server-side → render public-safe passport.

Never call GitHub with a token from a Client Component. Never expose
Supabase service-role credentials or GitHub tokens to the browser.

## Database overview

Supabase migrations are the source of truth.

  -----------------------------------------------------------------------
  Table                               Purpose
  ----------------------------------- -----------------------------------
  `profiles`                          Public identity/settings linked to
                                      `auth.users`

  `skill_scores`                      Per-user/per-domain component and
                                      aggregate scores

  `challenges`                        Practical tasks, difficulty,
                                      domain, XP, rubric

  `submissions`                       Challenge/repository submissions
                                      and evidence snapshots

`reviews`                           Peer/mentor rubric assessments and
                                      decisions
  -----------------------------------------------------------------------

Rules: - `profiles.id` references `auth.users.id`; `username` is unique
and URL-safe. - `skill_scores` unique on `(user_id, skill_domain)`. -
`challenges.slug` unique. - `reviews` unique on
`(submission_id, reviewer_id)`. - Use `jsonb` for versioned
snapshots/rubrics and relational columns for ownership. - Use
`timestamptz`; index usernames, challenge filters, submissions by
owner/status, and review queue. - Roles are `developer`, `mentor`,
`admin`; users cannot elevate their own role.

### Row Level Security

Enable RLS on every application table: - Users update only their own
profile; public reads expose safe fields only for public profiles. -
Users read their own skill scores; public reads only safe scores for
public profiles. - Published challenges are readable; management is
mentor/admin-only. - Submission owners create/read their own;
verification fields are server-authorized. - Reviewers cannot review
their own submission or submit twice; public passports expose only
public reviews. - Prefer user-scoped Supabase clients and RLS.
Service-role access is server-only and used only when necessary.

## Evidence and scoring model

All authoritative scores are computed on the server.

### Repository Evidence Score (0--100)

``` text
repoEvidenceScore =
    0.10 * readmeScore
  + 0.10 * workflowConfiguredScore
  + 0.25 * passingTestJobScore
  + 0.15 * ciPassingScore
  + 0.15 * recentActivityScore
  + 0.20 * skillRelevanceScore
  + 0.05 * metadataCompletenessScore
```

Each component is normalized to 0--100: - README: 100 when meaningful
project/setup README exists, otherwise 0. - Workflow configured: 100
when GitHub Actions workflow exists, otherwise 0. - Passing test job:
100 only when a completed successful workflow has an identifiable test
job. If unknown, record `unknown`. - CI: 100 for latest relevant
completed success, 50 queued/in progress, 0 failed/no completed run. -
Recent activity: 100 ≤7 days, 80 ≤30 days, 50 ≤90 days, 25 ≤180 days,
otherwise 0. - Skill relevance: deterministic mapping from languages,
manifests, and topics. - Metadata completeness: 100 if description,
default branch, and useful topics exist; 50 if partial; 0 if none.

Rate limits or missing permissions produce `unknown`, never a silent
pass. Preserve raw evidence and timestamps.

### Challenge Score (0--100)

``` text
challengeScore = (approvedRubricScore / rubricMaxScore) * 100
```

Only approved submissions count.

### Review Score (0--100)

Average valid review totals normalized to 100. A valid review requires
an authenticated authorized reviewer, no self-review, complete criteria,
and one review per reviewer/submission.

### Per-domain Skill Score (0--100)

``` text
skillScore = weightedMean(
  repoEvidenceScore: 0.50,
  challengeScore:    0.30,
  reviewScore:       0.20
)
```

Use only available evidence sources and renormalize weights. With no
evidence, score is 0, evidence count is 0, confidence is `unverified`.

Six domains: `frontend`, `backend`, `data`, `devops`, `system_design`,
`product`.

### Live Skill Score (0--1000)

``` text
liveSkillScore =
  round(10 * average(skillScore for domains where evidence_count > 0))
```

If no domain has evidence, return 0. Radar always renders six axes;
domains without evidence render zero/unverified. Show evidence-bearing
domain count and total evidence count.

Recalculate after repository sync, approved challenge result, review
submission, or review invalidation. XP is separate and never changes
evidence-based scores.

## Four-person team split

  -----------------------------------------------------------------------
  Developer               Ownership               Deliverables
  ----------------------- ----------------------- -----------------------
  Dev 1 --- Frontend/UI   Design tokens, shared   Responsive layouts,
                          components, app shell,  cards, navigation
                          landing/auth/overview

  Dev 2 --- Backend/Auth  Supabase clients,       Database, sessions,
                          migrations, RLS, auth   profile bootstrap
                          callbacks, DB types

  Dev 3 ---               Proofs/Projects, GitHub Challenge catalog,
  Challenges/GitHub       REST service, evidence  submission, sync API
                          checks

Dev 4 ---               Mentors, review APIs,   Review queue, score
  Reviews/Passport        scoring, passport       recalculation, radar,
                          routes                  public passport
  -----------------------------------------------------------------------

### Conflict prevention

- Protect `main`; use feature branches and focused PRs into `develop`.
- Dev 1 owns shared UI primitives/global CSS.
- Dev 2 owns migrations and generated DB types; others request schema
    changes.
- Dev 3 owns GitHub service contracts and evidence extraction.
- Dev 4 owns final score aggregation; Dev 3 must not write final Live
    Skill Score.
- Avoid simultaneous edits to global layout, shared types, package
    scripts, and migrations.
- Pull/rebase from `develop` twice daily. No direct pushes or force
    pushes to `main`.

## Day 1--6 execution schedule

Day 5 must end with a deployed end-to-end MVP. Day 6 is reserved for
polish, regression testing, and pitch rehearsal.

  -------------------------------------------------------------------------------------------------------------------------
  Day                    Dev 1 --- UI                  Dev 2 ---       Dev 3 ---           Dev 4 ---          Gate
                                                       Supabase/Auth   Challenges/GitHub   Reviews/Passport
  ---------------------- ----------------------------- --------------- ------------------- ------------------ -------------
  1 Foundation           Shell, fonts, tokens, cards,  Project,        API contract,       Rubric, score      App boots;
                         landing                       migrations,     challenge contract, contract,          contracts
                                                       RLS,            URL validation      wireframes         agreed
                                                       clients/types

  2 Auth/screens         Landing, auth, sidebar,       OAuth, profile  Seed challenges;    Mentors/Passport   User signs in
                         Overview shell                bootstrap,      list/detail         shells
                                                       protected
                                                       routes

  3 Workflows            Proofs/Projects UI and forms  Secure data     Submission API,     Review UI and      Repo
                                                       access and      GitHub metadata     persistence        submission
                                                       policies        checks                                 stored

  4 Verification/scoring Wire dashboard to data        RLS/security    CI/check            Review             Scores
                                                       review          inspection,         authorization and  recalculate
                                                                       evidence snapshot   score aggregation  

  5 MVP                  Responsive screens and share  Fix auth/data,  Sync flow, rate     Public passport,   Deployed demo
                         action                        deploy config   limits, demo repo   radar, review      works
                                                                                           trail

6 Polish/pitch         Visual/accessibility/mobile   Security and    Verify sample       Demo audit and     Feature
                         QA                            smoke test      evidence            pitch              freeze;
                                                                                                              rehearse
  -------------------------------------------------------------------------------------------------------------------------

Daily cadence: short morning stand-up, midday integration sync, evening
smoke test. Freeze optional features on Day 4 evening. No new
architecture on Day 5.

## Local setup

Prerequisites: Node.js LTS, npm, Git, Supabase project, GitHub OAuth App
configured as a Supabase Auth provider, VS Code with GitHub Copilot
Chat/Agent mode.

Create the app only if the repository is empty:

``` bash
npx create-next-app@latest devstack --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd devstack
```

Install dependencies:

``` bash
npm install @supabase/supabase-js @supabase/ssr @octokit/rest recharts lucide-react zod react-hook-form @hookform/resolvers date-fns clsx tailwind-merge class-variance-authority
npx shadcn@latest init
npx shadcn@latest add button card badge dialog input label textarea tabs progress avatar dropdown-menu separator skeleton tooltip sonner table
```

Ensure package scripts include:

``` json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

Configure `.env.local` from `.env.example`. In Supabase, enable GitHub
under Authentication → Providers, add the Supabase callback URL to the
GitHub OAuth App, add local/production redirect URLs, apply migrations,
and test developer/mentor accounts.

Run:

``` bash
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

### Phase 2: Supabase and GitHub setup

Create `.env.local` from `.env.example` and provide the Supabase project's
URL and browser anon/publishable key. Keep `SUPABASE_SERVICE_ROLE_KEY` and
`GITHUB_READONLY_TOKEN` server-only; they are not required for Phase 2.

Apply the ordered SQL migrations with Supabase CLI or the dashboard SQL
editor:

```bash
supabase db push
```

The migrations create `profiles`, `skill_scores`, `challenges`,
`submissions`, `reviews`, public-safe views, indexes, constraints, triggers,
and RLS policies. Do not run these migrations against an existing production
database until they have been reviewed and backed up.

In the Supabase dashboard:

1. Open **Authentication → Providers → GitHub** and enable it.
2. Create or select a GitHub OAuth App. Set its callback URL to the exact
   Supabase Auth callback shown by the dashboard, normally
   `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Enter the GitHub OAuth Client ID and secret in Supabase. Never commit
   either credential.
4. Open **Authentication → URL Configuration**. Allow local development
   redirects such as `http://localhost:3000/auth/callback` and
   `http://localhost:3000/app`. Add the deployed origin plus
   `/auth/callback` and `/app` for production.
5. Create separate developer and mentor test accounts. Promote the mentor
   account to `mentor` only through a controlled server/dashboard operation;
   end users cannot elevate their own role.

Email/password sign-up, GitHub OAuth, session refresh, profile bootstrap,
sign-out, and `/app` route protection are implemented. External Supabase
credentials are still required to exercise live authentication or RLS.

### Phase 3: Challenge and GitHub verification

Apply migration `202611220013_practical_challenge_platform.sql` after the
Phase 2 migrations and migration `202611190006_challenge_seed.sql`. The forward
migration extends the challenge catalog to exactly 120 published challenges,
preserves and upgrades the four original seed challenges, adds searchable
challenge metadata and per-user challenge progress, and leaves submission
verification writes server-authorized.

The authenticated `/app/proofs` route provides database-backed search,
domain/difficulty/status/sort filters, pagination, per-user progress, challenge
detail routes, repository submission, historical attempts, and read-only
GitHub evidence synchronization. `/app/proofs/[slug]` exposes the structured
problem, scenario, requirements, acceptance criteria, technologies, and rubric.
Submission ownership is checked against the profile's linked GitHub username;
repository code is never cloned or executed.

Set `SUPABASE_SERVICE_ROLE_KEY` and optionally
`GITHUB_READONLY_TOKEN` only in the server environment. The GitHub token is
read-only, and no OAuth or service credentials are bundled into client code.

Phase 3 fixture tests use:

```bash
npm run test:phase3
```

### Phase 4: Peer and mentor reviews

Apply migration `202611190007_phase4_reviews.sql` after the Phase 3 migrations.
It updates review decisions to `approved` or `revision_requested` and adds the
authenticated submission review-queue policy.

Phase 4 fixture tests use:

```bash
npm run test:phase4
```

### Phase 5: Passport and local demo fixtures

Apply migrations through `202611190008_public_passport.sql` before using
the public passport. In a local Supabase instance, create three accounts
through `/signup` with these fictional addresses (choose local-only
passwords; this repository contains no demo credentials):

- `demo-alex@example.test` — developer and public passport
- `demo-morgan@example.test` — fictional reviewer
- `demo-private@example.test` — private-visibility fixture

After the accounts exist and their profiles have been bootstrapped, load
the deterministic fixtures with `supabase db seed --local`. The seed runs
only against local Supabase, uses a transaction-scoped service-role claim
for controlled fixture writes, and never creates auth users. Do not run
demo fixtures against production or use them as real GitHub verification.
All repository checks are explicitly unknown; the stored scores are
fictional demonstration data, not evidence about the linked GitHub user.

Run the app and visit `/app/passport`, `/app`, and `/u/demo-alex`. Visit
`/u/demo-private` to confirm that private and nonexistent profiles share
the same not-found state. The local seed assigns the mentor role to the
fictional `demo-morgan` account through its transaction-scoped
service-role claim; never grant roles through a user-editable profile field.

Phase 5 fixture tests use:

```bash
npm run test:phase5
```

## Environment template

``` dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Server-only. Never expose to browser.
SUPABASE_SERVICE_ROLE_KEY=

# Optional server-only fine-grained GitHub token, read-only public repo access.
GITHUB_READONLY_TOKEN=
```

GitHub OAuth provider credentials belong in Supabase Auth provider
settings. Never commit `.env.local` or expose secrets through
`NEXT_PUBLIC_*`.

## DevStack 2.0 Phase 1: Registration and workspaces

The signup flow supports Developer, Mentor, and Company registration.
Mentor status is pending until an approved administrator changes
`mentor_profiles.verification_status`. Company and mentor workspaces use
authenticated workspace memberships; frontend workspace selection is not
authorization.

Forward migration `202611200009_phase1_workspaces.sql` adds workspace,
workspace membership, mentor profile, company, and company membership
tables. It also narrows public profile, skill-score, and review views and
restricts verification and role changes.

Do not apply forward migrations to a production database automatically.
After reviewing and backing up the target database, apply migrations in
filename order only in an authorized local/staging environment.

## Suggested repository structure

``` text
devstack/
├── README.md
├── .env.example
├── .github/
│   ├── copilot-instructions.md
│   └── prompts/
│       ├── phase-1-foundation.prompt.md
│       ├── phase-2-supabase-auth.prompt.md
│       ├── phase-3-challenges-github.prompt.md
│       ├── phase-4-reviews-scoring.prompt.md
│       └── phase-5-passport-demo.prompt.md
├── supabase/migrations/
├── supabase/seed.sql
└── src/
    ├── app/
    ├── components/
    ├── lib/supabase/
    ├── lib/github/
    ├── lib/scoring/
    └── types/
```

## Phase 3.5: Stabilization and pitch deliverables

Phase 3.5 source/audit deliverables are:

- `FULL_SITE_AUDIT.md`
- `PROJECT_PITCH.md`

The audit confirms source routes and implementation boundaries, but migration
application, live RLS, real OAuth, and authorized browser flows remain manual
staging validation. Migration 013 has not been applied remotely and the
120-record catalog is not represented as a live database count.

## Phase 3.6: Product refinements and responsive design

Phase 3.6 delivers core product polish, theme support, and workspace access corrections:

- **Mentor Approval Lifecycle:** Pending status screen at `/mentor/pending` and server-enforced administrator approval endpoint (`POST /api/admin/mentors/verify`) with self-approval disallowance (`SELF_APPROVAL_DISALLOWED`).
- **Developer Navigation:** Cleared of `Mentors` item; `/app/mentors` provides a smooth transition card to the dedicated Mentor Workspace.
- **Company Workspace Isolation:** Dedicated company navigation (Overview, Passport Search, Projects, Mentors), new Company Mentor Directory at `/company/[slug]/mentors`, and automatic redirection of company-only accounts away from developer routes.
- **Responsive Layout:** Audited across 320px–1440px viewports with dismissable mobile navigation drawer.
- **Themes:** First-class Dark, Light, and System themes with CSS tokens, zero hydration flash, and accessible theme toggles.
- **Expanded Landing Page:** Pitch-aligned hero (*"Your Skills Deserve More Than a CV."*), interactive demo passport link, 4-step workflow, 6 domains, 120 challenges distribution, and GitHub read-only verification explanation.

Run regression test suite:

```bash
npm run test:phase3_6
```

## Phase 3.8: Local browser QA

Run `npm run test:e2e` with Chrome or Playwright Chromium installed. The
suite builds and starts Next.js in a temporary copy with a loopback fixture backend.
It exercises the real routes with fictional accounts and evidence. It needs
no Supabase project, GitHub token, or credential file. Keep ports 4318 and
4319 available. Playwright writes screenshots and failure traces under
`test-results/`.

See [the Phase 3.8 report](PHASE_3_8_RESPONSIVE_OVERHAUL_REPORT.md) for browser
coverage and the staging authorization checks required for release.

## Demo walkthrough

Prepare one developer and one mentor account: 1. Explain the
evidence-first problem on Landing. 2. Sign in and show Overview. 3.
Select a seeded challenge. 4. Submit a public GitHub repository. 5. Show
real timestamped verification checks and explain unknown states. 6.
Complete a review with the mentor account. 7. Show the Live Skill Score
and radar updating from persisted evidence. 8. Open `/u/[username]`
logged out. 9. Inspect a repository and its evidence trail.

Use real sample evidence and clearly labeled demo data. Never fabricate
passing CI checks or mentor credentials.

## Hackathon checklist

- [ ] Landing/auth match approved mockups.
- [ ] Sign-in and GitHub connection work.
- [ ] Challenges load from Supabase.
- [ ] Public repository submission works.
- [ ] Evidence checks persist with timestamps.
- [ ] Unknown checks are not mislabeled as passed.
- [ ] Reviews persist and are authorized.
- [ ] Scores recalculate server-side.
- [ ] Radar uses persisted scores.
- [ ] Public passport respects visibility and RLS.
- [ ] Day 5 deployment works with demo data.
- [ ] Day 6 regression and pitch rehearsal complete.

## Phase 3.9 registration

See the [registration and verification guide](REGISTRATION_AND_VERIFICATION_GUIDE.md) for the account flows, administrative review and manual staging setup.

## Phase 4.0 workspace onboarding

Developer accounts open their personal workspace. Mentor and Company applicants
enter their own basic workspace immediately after submitting their information.
Company members can switch to read-only Mentor Discovery, which shows approved
public profiles. Verified privileges remain tied to professional approval.
Account type is fixed at registration; additional workspace access requires an
independently active membership, and secondary Mentor access requires approval.
Review and apply migrations 016 and 017 in controlled staging before hosted
verification. See the
[Phase 4.0 report](PHASE_4_0_WORKSPACE_ONBOARDING_REPORT.md) and
[registration guide](REGISTRATION_AND_VERIFICATION_GUIDE.md).
