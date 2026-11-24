alter table public.challenges
  add column if not exists short_description text,
  add column if not exists problem_statement text,
  add column if not exists scenario text,
  add column if not exists learning_objectives jsonb not null default '[]'::jsonb,
  add column if not exists requirements jsonb not null default '[]'::jsonb,
  add column if not exists acceptance_criteria jsonb not null default '[]'::jsonb,
  add column if not exists submission_requirements jsonb not null default '{}'::jsonb,
  add column if not exists technologies text[] not null default '{}'::text[],
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists estimated_minutes integer,
  add column if not exists is_platform_seed boolean not null default false;

alter table public.challenges
  add column if not exists difficulty_rank smallint generated always as (
    case difficulty when 'beginner' then 1 when 'intermediate' then 2 else 3 end
  ) stored,
  add column if not exists search_document tsvector;

alter table public.challenges
  add constraint challenges_learning_objectives_array
    check (jsonb_typeof(learning_objectives) = 'array'),
  add constraint challenges_requirements_array
    check (jsonb_typeof(requirements) = 'array'),
  add constraint challenges_acceptance_criteria_array
    check (jsonb_typeof(acceptance_criteria) = 'array'),
  add constraint challenges_submission_requirements_object
    check (jsonb_typeof(submission_requirements) = 'object'),
  add constraint challenges_estimated_minutes_positive
    check (estimated_minutes is null or estimated_minutes between 15 and 10080);

create index if not exists challenges_platform_catalog_idx
  on public.challenges (is_platform_seed, is_published, skill_domain, difficulty, created_at desc);
create index if not exists challenges_technologies_gin_idx
  on public.challenges using gin (technologies);
create index if not exists challenges_tags_gin_idx
  on public.challenges using gin (tags);
create index if not exists challenges_search_document_gin_idx
  on public.challenges using gin (search_document);

-- Trigger function to maintain weighted search_document tsvector.
-- Uses to_tsvector('simple', ...) which is IMMUTABLE-safe inside a trigger.
create or replace function public.challenges_update_search_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.search_document :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.description, '') || ' ' || coalesce(new.short_description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(new.technologies, ' '), '') || ' ' || coalesce(array_to_string(new.tags, ' '), '')), 'C');
  return new;
end;
$$;

revoke all on function public.challenges_update_search_document() from public, anon, authenticated;

create trigger challenges_set_search_document
before insert or update of title, description, short_description, technologies, tags
on public.challenges
for each row execute function public.challenges_update_search_document();

-- Backfill search_document for any existing challenge rows.
update public.challenges
set search_document =
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(description, '') || ' ' || coalesce(short_description, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(array_to_string(technologies, ' '), '') || ' ' || coalesce(array_to_string(tags, ' '), '')), 'C')
where search_document is null;

create table if not exists public.challenge_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  status text not null default 'in_progress',
  verified_score numeric(5,2),
  awarded_xp integer not null default 0,
  started_at timestamptz not null default now(),
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint challenge_progress_unique_user_challenge unique (user_id, challenge_id),
  constraint challenge_progress_status_check
    check (status in ('in_progress', 'submitted', 'verifying', 'verified', 'needs_revision', 'rejected')),
  constraint challenge_progress_score_range
    check (verified_score is null or verified_score between 0 and 100),
  constraint challenge_progress_xp_range check (awarded_xp >= 0),
  constraint challenge_progress_verification_consistency
    check (
      (status = 'verified' and verified_score is not null and verified_at is not null and awarded_xp >= 0)
      or (status <> 'verified' and verified_at is null and awarded_xp = 0)
    )
);

create or replace function public.award_verified_challenge_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
  challenge_xp integer;
begin
  caller_role := coalesce(current_setting('request.jwt.claim.role', true), '');

  if tg_op = 'UPDATE' and old.status = 'verified' then
    if new.status <> 'verified' then
      raise exception 'Verified challenge progress cannot be downgraded';
    end if;
    new.awarded_xp := old.awarded_xp;
    new.verified_at := old.verified_at;
    return new;
  end if;

  if new.status = 'verified' then
    if caller_role <> 'service_role' and session_user <> 'postgres' then
      raise exception 'Challenge verification is server-authorized';
    end if;
    if new.verified_score is null then
      raise exception 'A verified challenge requires an approved rubric score';
    end if;

    select challenge.xp_reward into challenge_xp
    from public.challenges challenge
    where challenge.id = new.challenge_id and challenge.is_published = true;

    if challenge_xp is null then
      raise exception 'Published challenge was not found';
    end if;

    new.awarded_xp := challenge_xp;
    new.verified_at := now();
  else
    new.awarded_xp := 0;
    new.verified_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.award_verified_challenge_xp() from public, anon, authenticated;

create trigger challenge_progress_award_verified_xp
before insert or update on public.challenge_progress
for each row execute function public.award_verified_challenge_xp();

alter table public.challenge_progress enable row level security;
revoke all on public.challenge_progress from anon, authenticated;
grant select, insert on public.challenge_progress to authenticated;

create policy "challenge_progress_select_own"
on public.challenge_progress for select
to authenticated
using (user_id = (select auth.uid()));

create policy "challenge_progress_insert_own"
on public.challenge_progress for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'in_progress'
  and verified_score is null
  and awarded_xp = 0
  and verified_at is null
);

create index if not exists challenge_progress_owner_status_idx
  on public.challenge_progress (user_id, status, updated_at desc);
create index if not exists challenge_progress_challenge_idx
  on public.challenge_progress (challenge_id, status);

create or replace function public.set_challenge_progress_after_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.challenge_progress (user_id, challenge_id, status)
  values (new.user_id, new.challenge_id, 'submitted')
  on conflict (user_id, challenge_id) do update
    set status = case
      when public.challenge_progress.status = 'verified' then 'verified'
      else 'submitted'
    end,
    updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_challenge_progress_after_submission() from public, anon, authenticated;

create trigger submissions_update_challenge_progress
after insert on public.submissions
for each row execute function public.set_challenge_progress_after_submission();

-- Each pipe-delimited record is original catalog content:
-- slug | title | domain | difficulty | minutes | xp | focus | scenario | technologies | tags
do $$
declare
  platform_count integer;
begin
  if exists (
    select 1
    from public.challenges challenge
    where challenge.slug in (
      select split_part(line.raw, '|', 1)
      from (values
        ($catalog$
responsive-engineering-profile|Build a Responsive Engineering Profile|frontend|beginner|120|100|Create a responsive profile that presents skills, projects, and contact details without sacrificing keyboard access or small-screen readability|A hiring team reviews portfolios on phones and desktops and needs the same essential evidence to remain easy to scan|HTML,CSS,TypeScript|responsive,accessibility,content-design
accessible-signup-validation|Create Accessible Sign-up Validation|frontend|beginner|150|100|Implement inline validation that announces errors, preserves entered values, and guides keyboard and screen-reader users to corrections|A community product sees avoidable account abandonment because form errors appear only after submission and are not announced|HTML,CSS,JavaScript,ARIA|forms,validation,accessibility
filterable-inventory-table|Build a Filterable Inventory Table|frontend|beginner|180|100|Create a sortable, searchable inventory table with empty, loading, and no-match states using a small local dataset|A repair shop needs staff to locate parts by name, category, and stock level during busy counter service|TypeScript,React,HTML,CSS|tables,search,sorting
design-token-theme-switcher|Add a Design-token Theme Switcher|frontend|beginner|120|100|Build a light and dark theme switcher using semantic design tokens and a preference that survives page reloads|A documentation site needs a comfortable theme choice without duplicating component styles or reducing contrast|CSS,TypeScript,localStorage|design-tokens,theming,accessibility
keyboard-friendly-modal|Create a Keyboard-friendly Modal|frontend|beginner|150|100|Implement a modal that manages focus, closes with Escape, restores focus, and prevents background interaction|A support portal needs a confirmation dialog that works reliably for keyboard-only users|React,TypeScript,ARIA,HTML|dialogs,focus-management,accessibility
reusable-pagination-controls|Build Reusable Pagination Controls|frontend|beginner|120|100|Create reusable previous, next, and page-selection controls with disabled states and announced result ranges|A public directory has enough entries to require pagination but must keep navigation understandable to assistive technology|React,TypeScript,ARIA|pagination,navigation,accessibility
client-side-form-state|Model Client-side Form States|frontend|beginner|120|100|Create a form that clearly represents idle, submitting, success, and recoverable failure states|A volunteer signup form must prevent duplicate clicks and explain whether a request was accepted|React,TypeScript,HTML|forms,async-state,feedback
optimistic-task-board|Build an Optimistic Task Board|frontend|intermediate|300|250|Implement optimistic task moves with pending indicators, server rejection recovery, and state reconciliation|A small delivery team needs board updates to feel immediate while preserving the server as the source of truth|React,TypeScript,fetch,testing-library|optimistic-ui,recovery,state-management
virtualized-activity-feed|Optimize a Virtualized Activity Feed|frontend|intermediate|360|250|Render a long activity feed with windowing while preserving stable item identity, scroll position, and accessible reading order|An operations console must display thousands of events without blocking interaction on mid-range laptops|React,TypeScript,virtualization,Playwright|performance,virtualization,accessibility
accessible-command-palette|Implement an Accessible Command Palette|frontend|intermediate|300|250|Build a searchable command palette with keyboard navigation, grouped results, focus handling, and no-results feedback|A multi-section application needs fast navigation that remains usable without a pointer|React,TypeScript,ARIA,Vitest|command-palette,keyboard,search
real-time-notification-center|Build a Real-time Notification Center|frontend|intermediate|360|250|Design a live notification list with reconnecting state, duplicate-event handling, and an accessible unread summary|A team dashboard receives bursty updates and must communicate connection loss without losing the user's place|React,TypeScript,WebSocket,ARIA|realtime,resilience,notifications
resilient-image-upload|Create a Resilient Image Upload Flow|frontend|intermediate|300|250|Implement file validation, progress, retry, cancellation, and preview cleanup for a multi-image upload workflow|A field service tool is used on unreliable mobile networks and must make partial upload outcomes clear|React,TypeScript,File API,Vitest|uploads,retry,forms
multi-step-checkout-state|Model a Multi-step Checkout|frontend|intermediate|360|250|Build a checkout state machine that validates each step and safely restores non-sensitive progress|A subscription team wants fewer checkout errors without persisting payment secrets in browser storage|React,TypeScript,Zod,Vitest|state-machine,validation,privacy
frontend-error-boundaries|Design Frontend Error Boundaries|frontend|intermediate|240|250|Isolate widget failures with useful recovery actions and structured, privacy-safe error context|A reporting page has independently loaded panels and one broken chart should not blank the entire page|React,TypeScript,ErrorBoundary,Vitest|reliability,error-handling,observability
nextjs-performance-budget|Optimize a Large Next.js Application Budget|frontend|advanced|600|400|Measure route bundles and rendering costs, then enforce a realistic performance budget with regression checks|A content-heavy application has growing client bundles and inconsistent navigation performance across routes|Next.js,TypeScript,Playwright,Lighthouse|nextjs,performance,budgets
conflict-aware-optimistic-editor|Implement Conflict-aware Optimistic Editing|frontend|advanced|540|400|Build an optimistic editor that detects stale versions, explains conflicts, and lets users reconcile without losing drafts|Editors collaborate on shared operational notes while network latency and concurrent changes are common|React,TypeScript,HTTP ETag,Vitest|concurrency,optimistic-ui,conflict-recovery
offline-first-work-queue|Create an Offline-first Work Queue|frontend|advanced|600|400|Queue offline user actions, retry safely, expose synchronization state, and reconcile server conflicts|Technicians capture work in areas with intermittent connectivity and need predictable recovery after reconnect|React,TypeScript,IndexedDB,Service Worker|offline-first,synchronization,reliability
accessible-data-visualization|Build an Accessible Data Visualization System|frontend|advanced|480|400|Present the same analytical story through a chart, a keyboard-accessible table, and concise textual summaries|A public-interest dashboard must communicate trends to users with varied vision and interaction needs|React,TypeScript,SVG,ARIA|data-visualization,accessibility,design
microfrontend-navigation-contract|Define a Microfrontend Navigation Contract|frontend|advanced|420|400|Implement typed route ownership, shared navigation events, and resilient fallbacks across independently deployed frontends|A growing product splits teams by domain but must preserve direct links, browser history, and consistent access states|TypeScript,Next.js,Web Components,Playwright|microfrontends,routing,contracts
crud-api-pagination|Build a CRUD API with Pagination|backend|beginner|180|100|Implement a small resource API with validated create, read, update, delete, and bounded pagination behavior|A reading group needs a simple service to manage shared book recommendations without returning unbounded lists|Node.js,TypeScript,HTTP,Zod|rest-api,pagination,validation
validated-file-metadata-api|Create a File Metadata API|backend|beginner|150|100|Build endpoints that validate file names, MIME metadata, and declared sizes without accepting file contents|A records service catalogs attachments while keeping binary storage outside the API challenge scope|Node.js,TypeScript,Zod,SQLite|api-design,validation,metadata
sql-backed-bookmark-service|Build a SQL-backed Bookmark Service|backend|beginner|180|100|Model users and bookmarks with safe parameterized queries and predictable duplicate handling|A small research team needs saved links that can be tagged and listed by creation time|TypeScript,SQL,SQLite,Vitest|sql,crud,data-modeling
api-error-contract|Define a Consistent API Error Contract|backend|beginner|120|100|Create a response convention for validation, missing resources, conflicts, and unexpected failures|Two frontend clients consume the same service and currently interpret inconsistent error payloads|TypeScript,HTTP,Zod,Vitest|errors,api-contract,testing
idempotent-contact-endpoint|Implement an Idempotent Contact Endpoint|backend|beginner|150|100|Accept a client request key and ensure retries do not create duplicate contact requests|A community website retries form submissions after timeouts and staff receive duplicate messages|Node.js,TypeScript,SQL,Vitest|idempotency,retries,api-design
basic-token-bucket|Build a Basic Token-bucket Limiter|backend|beginner|180|100|Implement a deterministic in-memory token bucket with clear capacity, refill, and rejection behavior|A prototype API needs a small local limiter before its traffic model is known|TypeScript,Node.js,Vitest|rate-limiting,algorithms,testing
webhook-signature-verifier|Verify Webhook Signatures Safely|backend|beginner|180|100|Validate timestamped HMAC webhook signatures using constant-time comparison and replay-window checks|A local integration receives event callbacks and must reject modified or stale payloads|Node.js,TypeScript,Web Crypto,Vitest|webhooks,cryptography,replay-protection
tenant-rbac-api|Build a Tenant-scoped RBAC API|backend|intermediate|360|250|Enforce role and tenant boundaries consistently across resource reads and writes|A B2B service adds organization roles and must prevent identifiers from crossing tenant boundaries|TypeScript,PostgreSQL,Zod,Vitest|rbac,multitenancy,authorization
background-job-retries|Implement Background Job Retries|backend|intermediate|360|250|Process jobs with bounded exponential backoff, idempotent handlers, and an inspectable dead-letter state|An invoice export worker encounters temporary partner failures and cannot duplicate completed exports|TypeScript,PostgreSQL,worker,Vitest|jobs,retries,idempotency
webhook-delivery-ledger|Create a Webhook Delivery Ledger|backend|intermediate|360|250|Track delivery attempts, response classes, retry scheduling, and eventual terminal outcomes|A partner integration needs support staff to diagnose whether an event was delivered or exhausted retries|TypeScript,PostgreSQL,HTTP,Vitest|webhooks,reliability,observability
session-refresh-rotation|Build a Session Refresh Rotation Service|backend|intermediate|420|250|Rotate refresh credentials, detect reuse, and revoke the affected session family|A security review finds long-lived sessions that cannot identify copied refresh tokens|TypeScript,PostgreSQL,Web Crypto,Vitest|authentication,session-security,rotation
auditable-change-log-api|Create an Auditable Change-log API|backend|intermediate|300|250|Record actor, target, action, and timestamp for mutations while preventing ordinary update/delete access|A compliance team needs a trustworthy history for configuration changes|TypeScript,PostgreSQL,Zod,Vitest|audit,immutability,authorization
idempotent-order-workflow|Design an Idempotent Order Workflow|backend|advanced|600|400|Coordinate order creation, inventory reservation, and retry-safe completion with explicit failure recovery|A commerce service receives duplicate requests and downstream timeouts during peak demand|TypeScript,PostgreSQL,outbox,Vitest|distributed-transactions,idempotency,recovery
distributed-rate-limiter|Build a Distributed Rate Limiting Service|backend|advanced|600|400|Design shared rate state, bounded storage, clock assumptions, and graceful degradation across API instances|A public API scales horizontally and needs consistent per-tenant limits without a single process bottleneck|Go,Redis,HTTP,load-testing|distributed-systems,rate-limiting,scalability
tenant-isolated-api|Implement a Secure Multi-tenant API|backend|advanced|600|400|Enforce tenant scoping in query construction, background jobs, exports, and authorization tests|A SaaS team must prove that every access path respects organization isolation|TypeScript,PostgreSQL,RLS,Vitest|multitenancy,security,testing
resilient-webhook-platform|Design a Resilient Webhook Platform|backend|advanced|540|400|Support signing-key rotation, at-least-once delivery, replay protection, and operational recovery|Customers depend on outbound events during partial outages and need actionable delivery controls|TypeScript,PostgreSQL,queues,OpenTelemetry|webhooks,reliability,security
zero-downtime-schema-evolution|Plan Zero-downtime Schema Evolution|backend|advanced|480|400|Demonstrate an expand-migrate-contract rollout with compatibility checks and rollback criteria|A high-traffic service must rename a field without coordinating every consumer release|PostgreSQL,TypeScript,ADR,CI|database-migrations,compatibility,operations
authorization-policy-engine|Build a Testable Authorization Policy Engine|backend|advanced|540|400|Represent resource, action, subject, and context policies with explainable denial reasons|Several services apply subtly different permission rules and need a shared, auditable contract|TypeScript,OPA,Rego,Vitest|authorization,policy,security
csv-cleaning-pipeline|Build a CSV Cleaning Pipeline|data|beginner|150|100|Parse a messy CSV, normalize dates and categories, report rejected rows, and produce a repeatable clean output|A community survey exports inconsistent headers, blank values, and mixed date formats each month|Python,pandas,pytest,CSV|etl,cleaning,data-quality
sql-cohort-analysis|Write SQL Cohort Analysis Queries|data|beginner|180|100|Use grouped SQL queries to calculate signup cohorts, retention windows, and clearly defined denominators|A product team wants to compare first-week retention without confusing users and sessions|SQL,SQLite,dbt,Markdown|sql,analytics,cohorts
relational-support-ticket-schema|Design a Relational Support-ticket Schema|data|beginner|180|100|Model customers, tickets, status history, and assignments with appropriate keys and constraints|A support team is moving from a spreadsheet to a small relational database|PostgreSQL,SQL,ERD|schema-design,normalization,relational
duplicate-record-detection|Detect Duplicate Customer Records|data|beginner|150|100|Normalize selected fields and produce explainable candidate duplicate groups without destructive merging|A mailing list contains spelling variants and inconsistent phone formats|Python,pandas,pytest|deduplication,matching,data-cleaning
daily-metrics-aggregation|Create Daily Metrics Aggregations|data|beginner|150|100|Aggregate timestamped events into daily counts with explicit timezone and missing-day behavior|A service owner needs a daily active-account chart from a small event table|SQL,SQLite,Python,pytest|aggregation,time-series,analytics
data-validation-report|Build a Data Validation Report|data|beginner|150|100|Check required columns, allowed ranges, and null thresholds and summarize failures for a human operator|A monthly import must be reviewed before its records feed a dashboard|Python,pandas,Great Expectations|validation,reporting,quality
normalize-nested-json|Normalize Nested JSON Records|data|beginner|180|100|Transform nested JSON events into typed flat records while preserving source identifiers and invalid-row context|A device export nests measurements and metadata at inconsistent depths|Python,pydantic,pytest,JSON|json,transformation,schemas
incremental-etl-pipeline|Build an Incremental ETL Pipeline|data|intermediate|360|250|Load source changes using a durable watermark, idempotent writes, and safe restart after partial failure|A sales export grows daily and full reloads are becoming slow and error-prone|Python,PostgreSQL,pytest,SQL|etl,incremental,idempotency
data-quality-contracts|Define Executable Data Quality Contracts|data|intermediate|300|250|Express freshness, uniqueness, null, and accepted-value expectations as repeatable pipeline checks|Analysts discover broken upstream records only after a weekly report ships|Python,SQL,dbt,pytest|data-contracts,quality,testing
analytics-star-warehouse|Design an Analytics Star Warehouse|data|intermediate|360|250|Create facts and dimensions with documented grain, slowly changing attributes, and representative analytical queries|A retail group wants consistent revenue reporting across stores and sales channels|SQL,dbt,PostgreSQL,ERD|warehouse,dimensional-modeling,analytics
late-arriving-event-handling|Handle Late-arriving Events|data|intermediate|360|250|Reconcile late events into time windows while keeping aggregates reproducible and corrections observable|Mobile clients upload activity after reconnecting, sometimes days after an event occurred|Python,SQL,pytest,Airflow|event-time,backfills,consistency
sensitive-data-masking-pipeline|Build a Sensitive-data Masking Pipeline|data|intermediate|300|250|Classify sensitive columns, mask or remove them deterministically, and test that exports omit protected values|A product analytics dataset must be shared with a research group under data minimization rules|Python,pandas,pytest,SQL|privacy,masking,governance
stream-event-deduplication|Deduplicate a Stream of Events|data|intermediate|360|250|Use event identifiers and bounded state to handle replayed messages without dropping distinct updates|A message broker redelivers after consumer restarts and downstream totals must remain stable|Python,Kafka,pytest,PostgreSQL|streaming,deduplication,reliability
cross-source-data-reconciliation|Reconcile Data Across Two Sources|data|intermediate|300|250|Compare keyed records across source extracts and emit explainable missing, changed, and matching results|Finance receives customer balances from two systems and must investigate discrepancies|SQL,Python,pytest,CSV|reconciliation,audit,quality
fault-tolerant-batch-pipeline|Build a Fault-tolerant Batch Pipeline|data|advanced|600|400|Design partitioned processing, checkpointing, idempotent outputs, and recovery from corrupted input partitions|A nightly transformation must finish within a window despite source gaps and worker restarts|Python,Spark,PostgreSQL,pytest|fault-tolerance,batch,scalability
data-lineage-catalog|Implement Data Lineage Tracking|data|advanced|480|400|Capture dataset and transformation relationships with versioned metadata and impact queries|A metric change affects multiple dashboards and analysts need to identify downstream consumers|Python,SQL,OpenLineage,PostgreSQL|lineage,metadata,governance
event-time-window-engine|Design an Event-time Window Aggregator|data|advanced|600|400|Implement event-time windows with watermarks, late-data policy, and deterministic correction behavior|Operations metrics arrive out of order from geographically distributed devices|Python,Flink,pytest,Kafka|stream-processing,event-time,windows
schema-evolution-compatibility|Enforce Data Schema Evolution Compatibility|data|advanced|480|400|Validate producer schema changes against compatibility rules and generate a migration impact report|Independent teams release event producers on different schedules|Python,JSON Schema,Avro,pytest|schema-registry,compatibility,events
privacy-preserving-analytics|Design Privacy-preserving Analytics Outputs|data|advanced|540|400|Set contribution limits and aggregation thresholds, then test that published reports resist simple disclosure|A small research consortium shares aggregate usage trends while minimizing participant exposure|Python,SQL,pytest,privacy-review|privacy,analytics,governance
multi-source-backfill-orchestrator|Create a Multi-source Backfill Orchestrator|data|advanced|600|400|Coordinate bounded backfills with checkpoints, source-specific rate controls, and resumable reconciliation|A historical migration combines archives from three systems with different retention gaps|Python,Airflow,PostgreSQL,pytest|backfill,orchestration,recovery
containerize-node-service|Containerize a Node.js Service|devops|beginner|120|100|Create a small non-root container image with a health check, predictable port, and documented local run command|A team hands a working service to another developer who has a different host setup|Docker,Node.js,TypeScript|containers,security,reproducibility
basic-ci-test-pipeline|Build a Basic CI Test Pipeline|devops|beginner|150|100|Run lint, type checks, and unit tests on pull requests with clear failure output|A small team often merges changes without running the same checks locally|GitHub Actions,Node.js,npm|ci,testing,automation
environment-config-matrix|Configure Environment-specific Deploy Settings|devops|beginner|150|100|Separate local, test, and production configuration names while failing safely when required values are absent|A service works locally but deployment setup currently relies on undocumented machine state|Docker,Node.js,GitHub Actions|configuration,environments,security
shell-log-rotation|Implement Safe Application Log Rotation|devops|beginner|120|100|Configure bounded log retention and demonstrate how operators inspect recent and archived service output|A single-host internal tool fills disk with unbounded logs|Linux,Shell,Docker|logging,operations,storage
service-health-endpoints|Add Service Health Endpoints|devops|beginner|150|100|Expose liveness and readiness checks with a documented dependency policy|A container orchestrator must distinguish a booting process from one able to serve requests|Node.js,HTTP,Docker|health-checks,reliability,containers
backup-restore-runbook|Write a Database Backup and Restore Runbook|devops|beginner|180|100|Document backup frequency, retention, restore steps, and a safe local restore drill|A small nonprofit needs to recover from accidental data deletion without purchasing a new service|PostgreSQL,Shell,Markdown|backup,recovery,documentation
infrastructure-diagram-baseline|Document a Basic Infrastructure Topology|devops|beginner|120|100|Create an architecture diagram showing application, database, network boundaries, and operational dependencies|New maintainers cannot determine which components are required to run the application|Mermaid,Markdown,Docker|architecture,documentation,operations
docker-compose-development-stack|Build a Docker Compose Development Stack|devops|intermediate|300|250|Coordinate app and database startup, health dependencies, persistent local data, and documented reset behavior|A team needs consistent onboarding without relying on individually installed database services|Docker,Compose,PostgreSQL|local-development,containers,reproducibility
deployment-rollback-workflow|Create a Deployment Rollback Workflow|devops|intermediate|360|250|Define release health gates, rollback triggers, and a tested previous-version recovery path|A failed application release causes elevated errors and operators need a safe response|GitHub Actions,Docker,HTTP|deployment,rollback,reliability
application-slo-monitoring|Implement Application SLO Monitoring|devops|intermediate|360|250|Define an availability and latency objective, instrument useful signals, and document alert thresholds|A team has dashboards but cannot tell whether user-facing reliability is deteriorating|OpenTelemetry,Prometheus,TypeScript|slo,monitoring,observability
secret-free-config-validation|Build Secret-free Configuration Validation|devops|intermediate|240|250|Validate required variable names and types at startup while redacting values from diagnostics|A service has inconsistent environment setup and logs have accidentally included configuration details|Node.js,Zod,Vitest|configuration,secrets,validation
database-migration-ci-gate|Add a Database Migration CI Gate|devops|intermediate|360|250|Validate migration ordering and run forward migration checks against an isolated disposable database|A team needs confidence that schema changes apply cleanly without touching shared environments|PostgreSQL,Docker,GitHub Actions|migrations,ci,safety
deployment-health-contract|Define a Deployment Health Contract|devops|intermediate|300|250|Specify rollout health signals, dependency readiness, and bounded failure thresholds for a service release|A team needs one repeatable contract for deciding whether a new deployment is safe to keep serving|HTTP,GitHub Actions,Prometheus,Markdown|deployment,health-checks,reliability
container-image-supply-chain|Harden a Container Image Supply Chain|devops|advanced|480|400|Pin base images, generate provenance metadata, scan dependencies, and define an exception policy|A regulated team must trace how a release image was assembled and reviewed|Docker,GitHub Actions,SBOM,Trivy|supply-chain,containers,security
blue-green-release-controller|Design a Blue-green Release Controller|devops|advanced|600|400|Model traffic switching, health verification, rollback, and state cleanup for parallel environments|A customer-facing service must deploy without a long maintenance window|Kubernetes,Helm,Prometheus,Go|deployment,blue-green,reliability
infrastructure-as-code-module|Build a Reusable Infrastructure-as-code Module|devops|advanced|600|400|Create a versioned infrastructure module with safe defaults, validation, examples, and drift considerations|Multiple product teams provision similar services with inconsistent network and logging settings|Terraform,OPA,GitHub Actions|iac,governance,reuse
multi-region-disaster-recovery|Plan Multi-region Disaster Recovery|devops|advanced|540|400|Define failure domains, recovery point/time objectives, failover steps, and a regular game-day plan|A regional outage would interrupt a service used by customers in several markets|Terraform,PostgreSQL,Mermaid,Markdown|disaster-recovery,multiregion,reliability
progressive-delivery-policy|Implement a Progressive Delivery Policy|devops|advanced|480|400|Roll out releases by cohort with measurable abort thresholds and operator-visible state|A high-traffic product wants early release signals before exposing a change to everyone|Kubernetes,Prometheus,GitHub Actions|progressive-delivery,metrics,operations
kubernetes-resource-capacity-plan|Create a Kubernetes Capacity and Resource Plan|devops|advanced|480|400|Set requests, limits, autoscaling bounds, and capacity test scenarios from observed workload assumptions|A cluster is over-provisioned during quiet periods and throttled during scheduled peaks|Kubernetes,Prometheus,k6,Helm|capacity,autoscaling,cost
incident-evidence-timeline|Build an Incident Evidence Timeline|devops|advanced|420|400|Correlate deployment, alert, and service events into a privacy-safe incident timeline with provenance|Responders lose time reconciling timestamps and incomplete notes during an outage|OpenTelemetry,SQL,TypeScript|incident-response,observability,forensics
url-shortener-design|Design a Reliable URL Shortener|system_design|beginner|180|100|Specify APIs, storage keys, redirect behavior, abuse controls, and a first capacity estimate|A community newsletter needs stable short links and a way to disable reported destinations|Mermaid,Markdown,SQL|system-design,apis,tradeoffs
basic-notification-architecture|Design a Basic Notification System|system_design|beginner|180|100|Model notification preferences, delivery channels, retry boundaries, and user-visible status|A civic service needs email and in-app reminders without sending duplicates after retries|Mermaid,Markdown,PostgreSQL|system-design,notifications,reliability
library-lending-service-design|Model a Library Lending Service|system_design|beginner|150|100|Describe entities, lending states, overdue transitions, and concurrency rules for checkout|A neighborhood library wants to replace a shared spreadsheet while retaining an audit trail|ERD,Mermaid,Markdown|system-design,domain-modeling,consistency
image-resizing-service-design|Design an Image Resizing Service|system_design|beginner|180|100|Document upload flow, transformation requests, cache keys, and resource limits|A community gallery needs multiple image sizes without exposing a server to arbitrary oversized work|Mermaid,Markdown,HTTP|system-design,media,caching
polling-dashboard-architecture|Design a Polling Status Dashboard|system_design|beginner|150|100|Compare polling intervals, freshness expectations, request volume, and graceful stale-data presentation|A small operations group needs current job status but does not yet need a streaming platform|Mermaid,Markdown,HTTP|system-design,polling,capacity
shared-document-permissions|Design Shared Document Permissions|system_design|beginner|180|100|Define ownership, sharing roles, revocation behavior, and authorization checks for a document workspace|A research group shares drafts with external collaborators and must explain access clearly|ERD,Mermaid,Markdown|system-design,authorization,sharing
chat-message-delivery|Design a Chat Message Delivery System|system_design|intermediate|360|250|Specify message ordering, reconnect replay, duplicate suppression, and delivery acknowledgements|Remote support teams need conversations to recover cleanly after mobile clients disconnect|WebSocket,PostgreSQL,Mermaid,ADR|system-design,messaging,reliability
object-storage-platform|Design a File Storage Platform|system_design|intermediate|360|250|Model upload authorization, metadata, object lifecycle, integrity checks, and deletion propagation|A document workspace stores user files and must make retention behavior auditable|S3-compatible,PostgreSQL,Mermaid,ADR|system-design,storage,lifecycle
api-gateway-policy|Design an API Gateway Policy Layer|system_design|intermediate|300|250|Define routing, authentication, rate limiting, timeout, and error propagation responsibilities|Several backend services need consistent edge behavior without hiding service ownership|HTTP,OpenAPI,Mermaid,ADR|system-design,api-gateway,security
search-index-update-architecture|Design a Search Index Update Path|system_design|intermediate|300|250|Compare synchronous indexing and event-driven updates with explicit freshness and rebuild guarantees|A marketplace search must reflect product changes while remaining available during index maintenance|PostgreSQL,OpenSearch,Mermaid,ADR|system-design,search,event-driven
multi-tenant-analytics-boundaries|Design Multi-tenant Analytics Boundaries|system_design|intermediate|360|250|Choose tenant partitioning and query authorization while documenting noisy-neighbor and export risks|A SaaS analytics workspace serves small and large organizations with different data volumes|PostgreSQL,RLS,Mermaid,ADR|system-design,multitenancy,analytics
job-scheduler-failure-model|Design a Durable Job Scheduler|system_design|intermediate|360|250|Define scheduling state, leases, retries, clock assumptions, and operator recovery for recurring jobs|A reporting service must run weekly jobs even when workers restart or run behind|PostgreSQL,queue,Mermaid,ADR|system-design,scheduling,recovery
event-contract-versioning|Design Event Contract Versioning|system_design|intermediate|300|250|Define event ownership, compatibility rules, consumer migration, and deprecation timelines|Three teams publish and consume domain events at different release cadences|AsyncAPI,JSON Schema,Mermaid,ADR|system-design,event-driven,compatibility
globally-distributed-feed|Design a Globally Distributed Activity Feed|system_design|advanced|600|400|Compare fan-out strategies, ordering guarantees, regional reads, and backfill behavior at high write volume|A collaboration product has globally distributed users and bursty activity from large organizations|Kafka,Redis,PostgreSQL,Mermaid|system-design,distributed-systems,feeds
multitenant-saas-control-plane|Design a Multi-tenant SaaS Control Plane|system_design|advanced|600|400|Separate tenant lifecycle, identity, entitlements, data-plane placement, and cross-tenant administrative access|A SaaS company adds regions and enterprise tenants with strict isolation requirements|PostgreSQL,RLS,OPA,Mermaid|system-design,multitenancy,security
regional-failover-data-consistency|Design Regional Failover Consistency|system_design|advanced|540|400|Specify failover decisions, replication lag limits, write ownership, and split-brain prevention|A globally used service must recover from a regional outage without silently losing accepted writes|PostgreSQL,Terraform,Mermaid,ADR|system-design,disaster-recovery,consistency
large-scale-event-ingestion|Design a Large-scale Event Ingestion Platform|system_design|advanced|600|400|Balance ingestion throughput, partition strategy, consumer isolation, retention, and replay cost|A telemetry platform receives uneven bursts from millions of connected devices|Kafka,Flink,Object Storage,Mermaid|system-design,streaming,scalability
privacy-aware-identity-graph|Design a Privacy-aware Identity Graph|system_design|advanced|540|400|Model identity links, consent changes, deletion propagation, and bounded risk of re-identification|A product group wants cross-device analytics while respecting data minimization and user deletion requests|PostgreSQL,Mermaid,ADR,SQL|system-design,privacy,identity
multi-region-queue-semantics|Design Multi-region Queue Semantics|system_design|advanced|540|400|Define regional producers, ordering scope, duplicate handling, failover ownership, and replay controls|A notification platform serves multiple regions and needs explicit semantics during partition events|Kafka,Redis,Mermaid,ADR|system-design,queues,multiregion
product-requirements-brief|Write an Evidence-based Product Requirements Brief|product|beginner|150|100|Define a target user, unmet need, desired outcome, scope boundary, and measurable acceptance signals|A community team proposes a feature but cannot explain which user problem it solves|Markdown,Mermaid,Sheets|product,requirements,outcomes
user-journey-service-map|Create a User Journey and Service Map|product|beginner|180|100|Map user steps, emotions, failure points, and the supporting service interactions|A public benefits application has high abandonment and teams disagree about where users get stuck|Mermaid,Markdown,Figma|product,user-research,journey-mapping
prioritization-scorecard|Build a Transparent Feature Prioritization Scorecard|product|beginner|120|100|Rank a small backlog using explicit impact, confidence, effort, and risk assumptions|A small product team must explain why two requests will not fit in the next release|Markdown,CSV,Sheets|product,prioritization,decision-making
product-metric-tree|Create a Product Metric Tree|product|beginner|150|100|Connect a user outcome to leading indicators and guardrails with unambiguous definitions|A learning product tracks signups but cannot tell whether users reach a useful first outcome|Mermaid,Markdown,SQL|product,metrics,outcomes
feature-release-checklist|Design a Feature Release Checklist|product|beginner|120|100|Define launch readiness, support ownership, rollback signals, and post-release learning questions|A small team releases customer-facing changes without a consistent handoff process|Markdown,GitHub Issues,Checklist|product,launch,operations
support-feedback-taxonomy|Create a Support Feedback Taxonomy|product|beginner|150|100|Group support themes using clear labels, examples, and a process for reviewing ambiguous cases|A product team receives unstructured feedback across email and chat and needs a usable evidence summary|CSV,Markdown,Sheets|product,feedback,research
ab-experiment-design|Design a Responsible A/B Experiment|product|intermediate|300|250|Define hypothesis, assignment unit, primary metric, guardrails, sample assumptions, and stopping rules|A commerce team wants to test a checkout change without over-interpreting noisy results|SQL,Python,Markdown|product,experimentation,statistics
product-analytics-event-plan|Build a Product Analytics Event Plan|product|intermediate|300|250|Specify event names, properties, ownership, privacy limits, and validation rules for a user journey|Teams use inconsistent event names and cannot compare onboarding performance across releases|JSON Schema,SQL,Markdown|product,analytics,governance
roadmap-under-constraints|Prioritize a Roadmap Under Constraints|product|intermediate|300|250|Compare customer value, strategic fit, dependency risk, and opportunity cost for a constrained quarter|A platform team has more committed requests than delivery capacity and must make trade-offs explicit|CSV,Markdown,Sheets|product,roadmapping,tradeoffs
activation-funnel-diagnosis|Diagnose an Activation Funnel|product|intermediate|360|250|Analyze a funnel with segment and instrumentation caveats and recommend a testable intervention|A productivity app has strong registrations but few users complete a meaningful first workflow|SQL,Python,Markdown|product,activation,analytics
feature-flag-rollout-plan|Create a Feature Flag Rollout Plan|product|intermediate|300|250|Define rollout cohorts, exposure measurement, kill-switch ownership, and cleanup criteria|A team wants to release an uncertain workflow safely while comparing operational guardrails|TypeScript,SQL,Markdown|product,feature-flags,release
customer-interview-synthesis|Synthesize Customer Interview Evidence|product|intermediate|300|250|Code interview notes into themes, retain contradictory evidence, and separate observations from assumptions|A team has twelve interviews and risks selecting only comments that support its roadmap|Markdown,CSV,Research|product,research,synthesis
marketplace-liquidity-strategy|Design a Marketplace Liquidity Strategy|product|advanced|540|400|Identify a constrained side of a marketplace, define liquidity measures, and design a safe geographic launch|A local services marketplace has many providers but inconsistent customer response times|SQL,Python,Markdown|product,marketplace,growth
product-led-growth-loop|Design a Product-led Growth Experiment|product|advanced|480|400|Map a value-sharing loop, identify friction and abuse risks, and define a measurable experiment|A collaboration tool wants team adoption without relying on broad paid acquisition|SQL,TypeScript,Markdown|product,growth,experimentation
scaling-saas-product-strategy|Create a Scaling SaaS Product Strategy|product|advanced|600|400|Prioritize platform investment against customer segments, reliability needs, and a multi-quarter outcome plan|A growing SaaS business faces enterprise requests that could fragment its core product|Markdown,SQL,Mermaid|product,strategy,platform
pricing-packaging-research-plan|Design a Pricing and Packaging Research Plan|product|advanced|480|400|Frame willingness-to-pay research, ethical test boundaries, segment hypotheses, and migration risks|A mature product considers new tiers without surprising existing customers or optimizing one metric blindly|Markdown,Sheets,SQL|product,pricing,research
retention-intervention-portfolio|Design a Retention Intervention Portfolio|product|advanced|540|400|Prioritize interventions by user cohort and causal evidence while protecting long-term trust metrics|A subscription product sees early churn concentrated in users with different onboarding paths|SQL,Python,Markdown|product,retention,causal-inference
platform-ecosystem-governance|Define a Platform Ecosystem Governance Model|product|advanced|480|400|Specify contribution criteria, compatibility policy, review ownership, and escalation paths for ecosystem partners|A platform opens extension points and needs quality without blocking independent innovation|Markdown,Mermaid,OpenAPI|product,platform,governance
responsible-personalization-strategy|Design a Responsible Personalization Strategy|product|advanced|540|400|Balance relevance, user control, measurement bias, privacy, and fallback behavior in a personalization proposal|A content service wants better discovery while avoiding opaque or exclusionary ranking outcomes|SQL,Python,Markdown|product,personalization,responsible-design
product-portfolio-investment-case|Build a Product Portfolio Investment Case|product|advanced|600|400|Compare investment scenarios with uncertainty ranges, strategic dependencies, and explicit stop or pivot criteria|A leadership group must allocate a fixed engineering budget across reliability, growth, and new bets|CSV,Markdown,Sheets|product,portfolio,investment
$catalog$)
      ) as catalog(raw)
      cross join lateral regexp_split_to_table(catalog.raw, E'\\n') as line(raw)
      where line.raw <> ''
    )
    and challenge.is_platform_seed = false
    and challenge.slug not in (
      'build-a-rate-limited-api',
      'optimize-react-virtual-list',
      'design-an-event-driven-job-queue',
      'implement-a-jwt-refresh-flow'
    )
  ) then
    raise exception 'Challenge catalog slug collides with an existing non-platform challenge';
  end if;
end;
$$;

with catalog_source(raw) as (
  values
    ($catalog$
responsive-engineering-profile|Build a Responsive Engineering Profile|frontend|beginner|120|100|Create a responsive profile that presents skills, projects, and contact details without sacrificing keyboard access or small-screen readability|A hiring team reviews portfolios on phones and desktops and needs the same essential evidence to remain easy to scan|HTML,CSS,TypeScript|responsive,accessibility,content-design
accessible-signup-validation|Create Accessible Sign-up Validation|frontend|beginner|150|100|Implement inline validation that announces errors, preserves entered values, and guides keyboard and screen-reader users to corrections|A community product sees avoidable account abandonment because form errors appear only after submission and are not announced|HTML,CSS,JavaScript,ARIA|forms,validation,accessibility
filterable-inventory-table|Build a Filterable Inventory Table|frontend|beginner|180|100|Create a sortable, searchable inventory table with empty, loading, and no-match states using a small local dataset|A repair shop needs staff to locate parts by name, category, and stock level during busy counter service|TypeScript,React,HTML,CSS|tables,search,sorting
design-token-theme-switcher|Add a Design-token Theme Switcher|frontend|beginner|120|100|Build a light and dark theme switcher using semantic design tokens and a preference that survives page reloads|A documentation site needs a comfortable theme choice without duplicating component styles or reducing contrast|CSS,TypeScript,localStorage|design-tokens,theming,accessibility
keyboard-friendly-modal|Create a Keyboard-friendly Modal|frontend|beginner|150|100|Implement a modal that manages focus, closes with Escape, restores focus, and prevents background interaction|A support portal needs a confirmation dialog that works reliably for keyboard-only users|React,TypeScript,ARIA,HTML|dialogs,focus-management,accessibility
reusable-pagination-controls|Build Reusable Pagination Controls|frontend|beginner|120|100|Create reusable previous, next, and page-selection controls with disabled states and announced result ranges|A public directory has enough entries to require pagination but must keep navigation understandable to assistive technology|React,TypeScript,ARIA|pagination,navigation,accessibility
client-side-form-state|Model Client-side Form States|frontend|beginner|120|100|Create a form that clearly represents idle, submitting, success, and recoverable failure states|A volunteer signup form must prevent duplicate clicks and explain whether a request was accepted|React,TypeScript,HTML|forms,async-state,feedback
optimistic-task-board|Build an Optimistic Task Board|frontend|intermediate|300|250|Implement optimistic task moves with pending indicators, server rejection recovery, and state reconciliation|A small delivery team needs board updates to feel immediate while preserving the server as the source of truth|React,TypeScript,fetch,testing-library|optimistic-ui,recovery,state-management
virtualized-activity-feed|Optimize a Virtualized Activity Feed|frontend|intermediate|360|250|Render a long activity feed with windowing while preserving stable item identity, scroll position, and accessible reading order|An operations console must display thousands of events without blocking interaction on mid-range laptops|React,TypeScript,virtualization,Playwright|performance,virtualization,accessibility
accessible-command-palette|Implement an Accessible Command Palette|frontend|intermediate|300|250|Build a searchable command palette with keyboard navigation, grouped results, focus handling, and no-results feedback|A multi-section application needs fast navigation that remains usable without a pointer|React,TypeScript,ARIA,Vitest|command-palette,keyboard,search
real-time-notification-center|Build a Real-time Notification Center|frontend|intermediate|360|250|Design a live notification list with reconnecting state, duplicate-event handling, and an accessible unread summary|A team dashboard receives bursty updates and must communicate connection loss without losing the user's place|React,TypeScript,WebSocket,ARIA|realtime,resilience,notifications
resilient-image-upload|Create a Resilient Image Upload Flow|frontend|intermediate|300|250|Implement file validation, progress, retry, cancellation, and preview cleanup for a multi-image upload workflow|A field service tool is used on unreliable mobile networks and must make partial upload outcomes clear|React,TypeScript,File API,Vitest|uploads,retry,forms
multi-step-checkout-state|Model a Multi-step Checkout|frontend|intermediate|360|250|Build a checkout state machine that validates each step and safely restores non-sensitive progress|A subscription team wants fewer checkout errors without persisting payment secrets in browser storage|React,TypeScript,Zod,Vitest|state-machine,validation,privacy
frontend-error-boundaries|Design Frontend Error Boundaries|frontend|intermediate|240|250|Isolate widget failures with useful recovery actions and structured, privacy-safe error context|A reporting page has independently loaded panels and one broken chart should not blank the entire page|React,TypeScript,ErrorBoundary,Vitest|reliability,error-handling,observability
nextjs-performance-budget|Optimize a Large Next.js Application Budget|frontend|advanced|600|400|Measure route bundles and rendering costs, then enforce a realistic performance budget with regression checks|A content-heavy application has growing client bundles and inconsistent navigation performance across routes|Next.js,TypeScript,Playwright,Lighthouse|nextjs,performance,budgets
conflict-aware-optimistic-editor|Implement Conflict-aware Optimistic Editing|frontend|advanced|540|400|Build an optimistic editor that detects stale versions, explains conflicts, and lets users reconcile without losing drafts|Editors collaborate on shared operational notes while network latency and concurrent changes are common|React,TypeScript,HTTP ETag,Vitest|concurrency,optimistic-ui,conflict-recovery
offline-first-work-queue|Create an Offline-first Work Queue|frontend|advanced|600|400|Queue offline user actions, retry safely, expose synchronization state, and reconcile server conflicts|Technicians capture work in areas with intermittent connectivity and need predictable recovery after reconnect|React,TypeScript,IndexedDB,Service Worker|offline-first,synchronization,reliability
accessible-data-visualization|Build an Accessible Data Visualization System|frontend|advanced|480|400|Present the same analytical story through a chart, a keyboard-accessible table, and concise textual summaries|A public-interest dashboard must communicate trends to users with varied vision and interaction needs|React,TypeScript,SVG,ARIA|data-visualization,accessibility,design
microfrontend-navigation-contract|Define a Microfrontend Navigation Contract|frontend|advanced|420|400|Implement typed route ownership, shared navigation events, and resilient fallbacks across independently deployed frontends|A growing product splits teams by domain but must preserve direct links, browser history, and consistent access states|TypeScript,Next.js,Web Components,Playwright|microfrontends,routing,contracts
crud-api-pagination|Build a CRUD API with Pagination|backend|beginner|180|100|Implement a small resource API with validated create, read, update, delete, and bounded pagination behavior|A reading group needs a simple service to manage shared book recommendations without returning unbounded lists|Node.js,TypeScript,HTTP,Zod|rest-api,pagination,validation
validated-file-metadata-api|Create a File Metadata API|backend|beginner|150|100|Build endpoints that validate file names, MIME metadata, and declared sizes without accepting file contents|A records service catalogs attachments while keeping binary storage outside the API challenge scope|Node.js,TypeScript,Zod,SQLite|api-design,validation,metadata
sql-backed-bookmark-service|Build a SQL-backed Bookmark Service|backend|beginner|180|100|Model users and bookmarks with safe parameterized queries and predictable duplicate handling|A small research team needs saved links that can be tagged and listed by creation time|TypeScript,SQL,SQLite,Vitest|sql,crud,data-modeling
api-error-contract|Define a Consistent API Error Contract|backend|beginner|120|100|Create a response convention for validation, missing resources, conflicts, and unexpected failures|Two frontend clients consume the same service and currently interpret inconsistent error payloads|TypeScript,HTTP,Zod,Vitest|errors,api-contract,testing
idempotent-contact-endpoint|Implement an Idempotent Contact Endpoint|backend|beginner|150|100|Accept a client request key and ensure retries do not create duplicate contact requests|A community website retries form submissions after timeouts and staff receive duplicate messages|Node.js,TypeScript,SQL,Vitest|idempotency,retries,api-design
basic-token-bucket|Build a Basic Token-bucket Limiter|backend|beginner|180|100|Implement a deterministic in-memory token bucket with clear capacity, refill, and rejection behavior|A prototype API needs a small local limiter before its traffic model is known|TypeScript,Node.js,Vitest|rate-limiting,algorithms,testing
webhook-signature-verifier|Verify Webhook Signatures Safely|backend|beginner|180|100|Validate timestamped HMAC webhook signatures using constant-time comparison and replay-window checks|A local integration receives event callbacks and must reject modified or stale payloads|Node.js,TypeScript,Web Crypto,Vitest|webhooks,cryptography,replay-protection
tenant-rbac-api|Build a Tenant-scoped RBAC API|backend|intermediate|360|250|Enforce role and tenant boundaries consistently across resource reads and writes|A B2B service adds organization roles and must prevent identifiers from crossing tenant boundaries|TypeScript,PostgreSQL,Zod,Vitest|rbac,multitenancy,authorization
background-job-retries|Implement Background Job Retries|backend|intermediate|360|250|Process jobs with bounded exponential backoff, idempotent handlers, and an inspectable dead-letter state|An invoice export worker encounters temporary partner failures and cannot duplicate completed exports|TypeScript,PostgreSQL,worker,Vitest|jobs,retries,idempotency
webhook-delivery-ledger|Create a Webhook Delivery Ledger|backend|intermediate|360|250|Track delivery attempts, response classes, retry scheduling, and eventual terminal outcomes|A partner integration needs support staff to diagnose whether an event was delivered or exhausted retries|TypeScript,PostgreSQL,HTTP,Vitest|webhooks,reliability,observability
session-refresh-rotation|Build a Session Refresh Rotation Service|backend|intermediate|420|250|Rotate refresh credentials, detect reuse, and revoke the affected session family|A security review finds long-lived sessions that cannot identify copied refresh tokens|TypeScript,PostgreSQL,Web Crypto,Vitest|authentication,session-security,rotation
auditable-change-log-api|Create an Auditable Change-log API|backend|intermediate|300|250|Record actor, target, action, and timestamp for mutations while preventing ordinary update/delete access|A compliance team needs a trustworthy history for configuration changes|TypeScript,PostgreSQL,Zod,Vitest|audit,immutability,authorization
idempotent-order-workflow|Design an Idempotent Order Workflow|backend|advanced|600|400|Coordinate order creation, inventory reservation, and retry-safe completion with explicit failure recovery|A commerce service receives duplicate requests and downstream timeouts during peak demand|TypeScript,PostgreSQL,outbox,Vitest|distributed-transactions,idempotency,recovery
distributed-rate-limiter|Build a Distributed Rate Limiting Service|backend|advanced|600|400|Design shared rate state, bounded storage, clock assumptions, and graceful degradation across API instances|A public API scales horizontally and needs consistent per-tenant limits without a single process bottleneck|Go,Redis,HTTP,load-testing|distributed-systems,rate-limiting,scalability
tenant-isolated-api|Implement a Secure Multi-tenant API|backend|advanced|600|400|Enforce tenant scoping in query construction, background jobs, exports, and authorization tests|A SaaS team must prove that every access path respects organization isolation|TypeScript,PostgreSQL,RLS,Vitest|multitenancy,security,testing
resilient-webhook-platform|Design a Resilient Webhook Platform|backend|advanced|540|400|Support signing-key rotation, at-least-once delivery, replay protection, and operational recovery|Customers depend on outbound events during partial outages and need actionable delivery controls|TypeScript,PostgreSQL,queues,OpenTelemetry|webhooks,reliability,security
zero-downtime-schema-evolution|Plan Zero-downtime Schema Evolution|backend|advanced|480|400|Demonstrate an expand-migrate-contract rollout with compatibility checks and rollback criteria|A high-traffic service must rename a field without coordinating every consumer release|PostgreSQL,TypeScript,ADR,CI|database-migrations,compatibility,operations
authorization-policy-engine|Build a Testable Authorization Policy Engine|backend|advanced|540|400|Represent resource, action, subject, and context policies with explainable denial reasons|Several services apply subtly different permission rules and need a shared, auditable contract|TypeScript,OPA,Rego,Vitest|authorization,policy,security
csv-cleaning-pipeline|Build a CSV Cleaning Pipeline|data|beginner|150|100|Parse a messy CSV, normalize dates and categories, report rejected rows, and produce a repeatable clean output|A community survey exports inconsistent headers, blank values, and mixed date formats each month|Python,pandas,pytest,CSV|etl,cleaning,data-quality
sql-cohort-analysis|Write SQL Cohort Analysis Queries|data|beginner|180|100|Use grouped SQL queries to calculate signup cohorts, retention windows, and clearly defined denominators|A product team wants to compare first-week retention without confusing users and sessions|SQL,SQLite,dbt,Markdown|sql,analytics,cohorts
relational-support-ticket-schema|Design a Relational Support-ticket Schema|data|beginner|180|100|Model customers, tickets, status history, and assignments with appropriate keys and constraints|A support team is moving from a spreadsheet to a small relational database|PostgreSQL,SQL,ERD|schema-design,normalization,relational
duplicate-record-detection|Detect Duplicate Customer Records|data|beginner|150|100|Normalize selected fields and produce explainable candidate duplicate groups without destructive merging|A mailing list contains spelling variants and inconsistent phone formats|Python,pandas,pytest|deduplication,matching,data-cleaning
daily-metrics-aggregation|Create Daily Metrics Aggregations|data|beginner|150|100|Aggregate timestamped events into daily counts with explicit timezone and missing-day behavior|A service owner needs a daily active-account chart from a small event table|SQL,SQLite,Python,pytest|aggregation,time-series,analytics
data-validation-report|Build a Data Validation Report|data|beginner|150|100|Check required columns, allowed ranges, and null thresholds and summarize failures for a human operator|A monthly import must be reviewed before its records feed a dashboard|Python,pandas,Great Expectations|validation,reporting,quality
normalize-nested-json|Normalize Nested JSON Records|data|beginner|180|100|Transform nested JSON events into typed flat records while preserving source identifiers and invalid-row context|A device export nests measurements and metadata at inconsistent depths|Python,pydantic,pytest,JSON|json,transformation,schemas
incremental-etl-pipeline|Build an Incremental ETL Pipeline|data|intermediate|360|250|Load source changes using a durable watermark, idempotent writes, and safe restart after partial failure|A sales export grows daily and full reloads are becoming slow and error-prone|Python,PostgreSQL,pytest,SQL|etl,incremental,idempotency
data-quality-contracts|Define Executable Data Quality Contracts|data|intermediate|300|250|Express freshness, uniqueness, null, and accepted-value expectations as repeatable pipeline checks|Analysts discover broken upstream records only after a weekly report ships|Python,SQL,dbt,pytest|data-contracts,quality,testing
analytics-star-warehouse|Design an Analytics Star Warehouse|data|intermediate|360|250|Create facts and dimensions with documented grain, slowly changing attributes, and representative analytical queries|A retail group wants consistent revenue reporting across stores and sales channels|SQL,dbt,PostgreSQL,ERD|warehouse,dimensional-modeling,analytics
late-arriving-event-handling|Handle Late-arriving Events|data|intermediate|360|250|Reconcile late events into time windows while keeping aggregates reproducible and corrections observable|Mobile clients upload activity after reconnecting, sometimes days after an event occurred|Python,SQL,pytest,Airflow|event-time,backfills,consistency
sensitive-data-masking-pipeline|Build a Sensitive-data Masking Pipeline|data|intermediate|300|250|Classify sensitive columns, mask or remove them deterministically, and test that exports omit protected values|A product analytics dataset must be shared with a research group under data minimization rules|Python,pandas,pytest,SQL|privacy,masking,governance
stream-event-deduplication|Deduplicate a Stream of Events|data|intermediate|360|250|Use event identifiers and bounded state to handle replayed messages without dropping distinct updates|A message broker redelivers after consumer restarts and downstream totals must remain stable|Python,Kafka,pytest,PostgreSQL|streaming,deduplication,reliability
cross-source-data-reconciliation|Reconcile Data Across Two Sources|data|intermediate|300|250|Compare keyed records across source extracts and emit explainable missing, changed, and matching results|Finance receives customer balances from two systems and must investigate discrepancies|SQL,Python,pytest,CSV|reconciliation,audit,quality
fault-tolerant-batch-pipeline|Build a Fault-tolerant Batch Pipeline|data|advanced|600|400|Design partitioned processing, checkpointing, idempotent outputs, and recovery from corrupted input partitions|A nightly transformation must finish within a window despite source gaps and worker restarts|Python,Spark,PostgreSQL,pytest|fault-tolerance,batch,scalability
data-lineage-catalog|Implement Data Lineage Tracking|data|advanced|480|400|Capture dataset and transformation relationships with versioned metadata and impact queries|A metric change affects multiple dashboards and analysts need to identify downstream consumers|Python,SQL,OpenLineage,PostgreSQL|lineage,metadata,governance
event-time-window-engine|Design an Event-time Window Aggregator|data|advanced|600|400|Implement event-time windows with watermarks, late-data policy, and deterministic correction behavior|Operations metrics arrive out of order from geographically distributed devices|Python,Flink,pytest,Kafka|stream-processing,event-time,windows
schema-evolution-compatibility|Enforce Data Schema Evolution Compatibility|data|advanced|480|400|Validate producer schema changes against compatibility rules and generate a migration impact report|Independent teams release event producers on different schedules|Python,JSON Schema,Avro,pytest|schema-registry,compatibility,events
privacy-preserving-analytics|Design Privacy-preserving Analytics Outputs|data|advanced|540|400|Set contribution limits and aggregation thresholds, then test that published reports resist simple disclosure|A small research consortium shares aggregate usage trends while minimizing participant exposure|Python,SQL,pytest,privacy-review|privacy,analytics,governance
multi-source-backfill-orchestrator|Create a Multi-source Backfill Orchestrator|data|advanced|600|400|Coordinate bounded backfills with checkpoints, source-specific rate controls, and resumable reconciliation|A historical migration combines archives from three systems with different retention gaps|Python,Airflow,PostgreSQL,pytest|backfill,orchestration,recovery
containerize-node-service|Containerize a Node.js Service|devops|beginner|120|100|Create a small non-root container image with a health check, predictable port, and documented local run command|A team hands a working service to another developer who has a different host setup|Docker,Node.js,TypeScript|containers,security,reproducibility
basic-ci-test-pipeline|Build a Basic CI Test Pipeline|devops|beginner|150|100|Run lint, type checks, and unit tests on pull requests with clear failure output|A small team often merges changes without running the same checks locally|GitHub Actions,Node.js,npm|ci,testing,automation
environment-config-matrix|Configure Environment-specific Deploy Settings|devops|beginner|150|100|Separate local, test, and production configuration names while failing safely when required values are absent|A service works locally but deployment setup currently relies on undocumented machine state|Docker,Node.js,GitHub Actions|configuration,environments,security
shell-log-rotation|Implement Safe Application Log Rotation|devops|beginner|120|100|Configure bounded log retention and demonstrate how operators inspect recent and archived service output|A single-host internal tool fills disk with unbounded logs|Linux,Shell,Docker|logging,operations,storage
service-health-endpoints|Add Service Health Endpoints|devops|beginner|150|100|Expose liveness and readiness checks with a documented dependency policy|A container orchestrator must distinguish a booting process from one able to serve requests|Node.js,HTTP,Docker|health-checks,reliability,containers
backup-restore-runbook|Write a Database Backup and Restore Runbook|devops|beginner|180|100|Document backup frequency, retention, restore steps, and a safe local restore drill|A small nonprofit needs to recover from accidental data deletion without purchasing a new service|PostgreSQL,Shell,Markdown|backup,recovery,documentation
infrastructure-diagram-baseline|Document a Basic Infrastructure Topology|devops|beginner|120|100|Create an architecture diagram showing application, database, network boundaries, and operational dependencies|New maintainers cannot determine which components are required to run the application|Mermaid,Markdown,Docker|architecture,documentation,operations
docker-compose-development-stack|Build a Docker Compose Development Stack|devops|intermediate|300|250|Coordinate app and database startup, health dependencies, persistent local data, and documented reset behavior|A team needs consistent onboarding without relying on individually installed database services|Docker,Compose,PostgreSQL|local-development,containers,reproducibility
deployment-rollback-workflow|Create a Deployment Rollback Workflow|devops|intermediate|360|250|Define release health gates, rollback triggers, and a tested previous-version recovery path|A failed application release causes elevated errors and operators need a safe response|GitHub Actions,Docker,HTTP|deployment,rollback,reliability
application-slo-monitoring|Implement Application SLO Monitoring|devops|intermediate|360|250|Define an availability and latency objective, instrument useful signals, and document alert thresholds|A team has dashboards but cannot tell whether user-facing reliability is deteriorating|OpenTelemetry,Prometheus,TypeScript|slo,monitoring,observability
secret-free-config-validation|Build Secret-free Configuration Validation|devops|intermediate|240|250|Validate required variable names and types at startup while redacting values from diagnostics|A service has inconsistent environment setup and logs have accidentally included configuration details|Node.js,Zod,Vitest|configuration,secrets,validation
database-migration-ci-gate|Add a Database Migration CI Gate|devops|intermediate|360|250|Validate migration ordering and run forward migration checks against an isolated disposable database|A team needs confidence that schema changes apply cleanly without touching shared environments|PostgreSQL,Docker,GitHub Actions|migrations,ci,safety
deployment-health-contract|Define a Deployment Health Contract|devops|intermediate|300|250|Specify rollout health signals, dependency readiness, and bounded failure thresholds for a service release|A team needs one repeatable contract for deciding whether a new deployment is safe to keep serving|HTTP,GitHub Actions,Prometheus,Markdown|deployment,health-checks,reliability
container-image-supply-chain|Harden a Container Image Supply Chain|devops|advanced|480|400|Pin base images, generate provenance metadata, scan dependencies, and define an exception policy|A regulated team must trace how a release image was assembled and reviewed|Docker,GitHub Actions,SBOM,Trivy|supply-chain,containers,security
blue-green-release-controller|Design a Blue-green Release Controller|devops|advanced|600|400|Model traffic switching, health verification, rollback, and state cleanup for parallel environments|A customer-facing service must deploy without a long maintenance window|Kubernetes,Helm,Prometheus,Go|deployment,blue-green,reliability
infrastructure-as-code-module|Build a Reusable Infrastructure-as-code Module|devops|advanced|600|400|Create a versioned infrastructure module with safe defaults, validation, examples, and drift considerations|Multiple product teams provision similar services with inconsistent network and logging settings|Terraform,OPA,GitHub Actions|iac,governance,reuse
multi-region-disaster-recovery|Plan Multi-region Disaster Recovery|devops|advanced|540|400|Define failure domains, recovery point/time objectives, failover steps, and a regular game-day plan|A regional outage would interrupt a service used by customers in several markets|Terraform,PostgreSQL,Mermaid,Markdown|disaster-recovery,multiregion,reliability
progressive-delivery-policy|Implement a Progressive Delivery Policy|devops|advanced|480|400|Roll out releases by cohort with measurable abort thresholds and operator-visible state|A high-traffic product wants early release signals before exposing a change to everyone|Kubernetes,Prometheus,GitHub Actions|progressive-delivery,metrics,operations
kubernetes-resource-capacity-plan|Create a Kubernetes Capacity and Resource Plan|devops|advanced|480|400|Set requests, limits, autoscaling bounds, and capacity test scenarios from observed workload assumptions|A cluster is over-provisioned during quiet periods and throttled during scheduled peaks|Kubernetes,Prometheus,k6,Helm|capacity,autoscaling,cost
incident-evidence-timeline|Build an Incident Evidence Timeline|devops|advanced|420|400|Correlate deployment, alert, and service events into a privacy-safe incident timeline with provenance|Responders lose time reconciling timestamps and incomplete notes during an outage|OpenTelemetry,SQL,TypeScript|incident-response,observability,forensics
url-shortener-design|Design a Reliable URL Shortener|system_design|beginner|180|100|Specify APIs, storage keys, redirect behavior, abuse controls, and a first capacity estimate|A community newsletter needs stable short links and a way to disable reported destinations|Mermaid,Markdown,SQL|system-design,apis,tradeoffs
basic-notification-architecture|Design a Basic Notification System|system_design|beginner|180|100|Model notification preferences, delivery channels, retry boundaries, and user-visible status|A civic service needs email and in-app reminders without sending duplicates after retries|Mermaid,Markdown,PostgreSQL|system-design,notifications,reliability
library-lending-service-design|Model a Library Lending Service|system_design|beginner|150|100|Describe entities, lending states, overdue transitions, and concurrency rules for checkout|A neighborhood library wants to replace a shared spreadsheet while retaining an audit trail|ERD,Mermaid,Markdown|system-design,domain-modeling,consistency
image-resizing-service-design|Design an Image Resizing Service|system_design|beginner|180|100|Document upload flow, transformation requests, cache keys, and resource limits|A community gallery needs multiple image sizes without exposing a server to arbitrary oversized work|Mermaid,Markdown,HTTP|system-design,media,caching
polling-dashboard-architecture|Design a Polling Status Dashboard|system_design|beginner|150|100|Compare polling intervals, freshness expectations, request volume, and graceful stale-data presentation|A small operations group needs current job status but does not yet need a streaming platform|Mermaid,Markdown,HTTP|system-design,polling,capacity
shared-document-permissions|Design Shared Document Permissions|system_design|beginner|180|100|Define ownership, sharing roles, revocation behavior, and authorization checks for a document workspace|A research group shares drafts with external collaborators and must explain access clearly|ERD,Mermaid,Markdown|system-design,authorization,sharing
chat-message-delivery|Design a Chat Message Delivery System|system_design|intermediate|360|250|Specify message ordering, reconnect replay, duplicate suppression, and delivery acknowledgements|Remote support teams need conversations to recover cleanly after mobile clients disconnect|WebSocket,PostgreSQL,Mermaid,ADR|system-design,messaging,reliability
object-storage-platform|Design a File Storage Platform|system_design|intermediate|360|250|Model upload authorization, metadata, object lifecycle, integrity checks, and deletion propagation|A document workspace stores user files and must make retention behavior auditable|S3-compatible,PostgreSQL,Mermaid,ADR|system-design,storage,lifecycle
api-gateway-policy|Design an API Gateway Policy Layer|system_design|intermediate|300|250|Define routing, authentication, rate limiting, timeout, and error propagation responsibilities|Several backend services need consistent edge behavior without hiding service ownership|HTTP,OpenAPI,Mermaid,ADR|system-design,api-gateway,security
search-index-update-architecture|Design a Search Index Update Path|system_design|intermediate|300|250|Compare synchronous indexing and event-driven updates with explicit freshness and rebuild guarantees|A marketplace search must reflect product changes while remaining available during index maintenance|PostgreSQL,OpenSearch,Mermaid,ADR|system-design,search,event-driven
multi-tenant-analytics-boundaries|Design Multi-tenant Analytics Boundaries|system_design|intermediate|360|250|Choose tenant partitioning and query authorization while documenting noisy-neighbor and export risks|A SaaS analytics workspace serves small and large organizations with different data volumes|PostgreSQL,RLS,Mermaid,ADR|system-design,multitenancy,analytics
job-scheduler-failure-model|Design a Durable Job Scheduler|system_design|intermediate|360|250|Define scheduling state, leases, retries, clock assumptions, and operator recovery for recurring jobs|A reporting service must run weekly jobs even when workers restart or run behind|PostgreSQL,queue,Mermaid,ADR|system-design,scheduling,recovery
event-contract-versioning|Design Event Contract Versioning|system_design|intermediate|300|250|Define event ownership, compatibility rules, consumer migration, and deprecation timelines|Three teams publish and consume domain events at different release cadences|AsyncAPI,JSON Schema,Mermaid,ADR|system-design,event-driven,compatibility
globally-distributed-feed|Design a Globally Distributed Activity Feed|system_design|advanced|600|400|Compare fan-out strategies, ordering guarantees, regional reads, and backfill behavior at high write volume|A collaboration product has globally distributed users and bursty activity from large organizations|Kafka,Redis,PostgreSQL,Mermaid|system-design,distributed-systems,feeds
multitenant-saas-control-plane|Design a Multi-tenant SaaS Control Plane|system_design|advanced|600|400|Separate tenant lifecycle, identity, entitlements, data-plane placement, and cross-tenant administrative access|A SaaS company adds regions and enterprise tenants with strict isolation requirements|PostgreSQL,RLS,OPA,Mermaid|system-design,multitenancy,security
regional-failover-data-consistency|Design Regional Failover Consistency|system_design|advanced|540|400|Specify failover decisions, replication lag limits, write ownership, and split-brain prevention|A globally used service must recover from a regional outage without silently losing accepted writes|PostgreSQL,Terraform,Mermaid,ADR|system-design,disaster-recovery,consistency
large-scale-event-ingestion|Design a Large-scale Event Ingestion Platform|system_design|advanced|600|400|Balance ingestion throughput, partition strategy, consumer isolation, retention, and replay cost|A telemetry platform receives uneven bursts from millions of connected devices|Kafka,Flink,Object Storage,Mermaid|system-design,streaming,scalability
privacy-aware-identity-graph|Design a Privacy-aware Identity Graph|system_design|advanced|540|400|Model identity links, consent changes, deletion propagation, and bounded risk of re-identification|A product group wants cross-device analytics while respecting data minimization and user deletion requests|PostgreSQL,Mermaid,ADR,SQL|system-design,privacy,identity
multi-region-queue-semantics|Design Multi-region Queue Semantics|system_design|advanced|540|400|Define regional producers, ordering scope, duplicate handling, failover ownership, and replay controls|A notification platform serves multiple regions and needs explicit semantics during partition events|Kafka,Redis,Mermaid,ADR|system-design,queues,multiregion
product-requirements-brief|Write an Evidence-based Product Requirements Brief|product|beginner|150|100|Define a target user, unmet need, desired outcome, scope boundary, and measurable acceptance signals|A community team proposes a feature but cannot explain which user problem it solves|Markdown,Mermaid,Sheets|product,requirements,outcomes
user-journey-service-map|Create a User Journey and Service Map|product|beginner|180|100|Map user steps, emotions, failure points, and the supporting service interactions|A public benefits application has high abandonment and teams disagree about where users get stuck|Mermaid,Markdown,Figma|product,user-research,journey-mapping
prioritization-scorecard|Build a Transparent Feature Prioritization Scorecard|product|beginner|120|100|Rank a small backlog using explicit impact, confidence, effort, and risk assumptions|A small product team must explain why two requests will not fit in the next release|Markdown,CSV,Sheets|product,prioritization,decision-making
product-metric-tree|Create a Product Metric Tree|product|beginner|150|100|Connect a user outcome to leading indicators and guardrails with unambiguous definitions|A learning product tracks signups but cannot tell whether users reach a useful first outcome|Mermaid,Markdown,SQL|product,metrics,outcomes
feature-release-checklist|Design a Feature Release Checklist|product|beginner|120|100|Define launch readiness, support ownership, rollback signals, and post-release learning questions|A small team releases customer-facing changes without a consistent handoff process|Markdown,GitHub Issues,Checklist|product,launch,operations
support-feedback-taxonomy|Create a Support Feedback Taxonomy|product|beginner|150|100|Group support themes using clear labels, examples, and a process for reviewing ambiguous cases|A product team receives unstructured feedback across email and chat and needs a usable evidence summary|CSV,Markdown,Sheets|product,feedback,research
ab-experiment-design|Design a Responsible A/B Experiment|product|intermediate|300|250|Define hypothesis, assignment unit, primary metric, guardrails, sample assumptions, and stopping rules|A commerce team wants to test a checkout change without over-interpreting noisy results|SQL,Python,Markdown|product,experimentation,statistics
product-analytics-event-plan|Build a Product Analytics Event Plan|product|intermediate|300|250|Specify event names, properties, ownership, privacy limits, and validation rules for a user journey|Teams use inconsistent event names and cannot compare onboarding performance across releases|JSON Schema,SQL,Markdown|product,analytics,governance
roadmap-under-constraints|Prioritize a Roadmap Under Constraints|product|intermediate|300|250|Compare customer value, strategic fit, dependency risk, and opportunity cost for a constrained quarter|A platform team has more committed requests than delivery capacity and must make trade-offs explicit|CSV,Markdown,Sheets|product,roadmapping,tradeoffs
activation-funnel-diagnosis|Diagnose an Activation Funnel|product|intermediate|360|250|Analyze a funnel with segment and instrumentation caveats and recommend a testable intervention|A productivity app has strong registrations but few users complete a meaningful first workflow|SQL,Python,Markdown|product,activation,analytics
feature-flag-rollout-plan|Create a Feature Flag Rollout Plan|product|intermediate|300|250|Define rollout cohorts, exposure measurement, kill-switch ownership, and cleanup criteria|A team wants to release an uncertain workflow safely while comparing operational guardrails|TypeScript,SQL,Markdown|product,feature-flags,release
customer-interview-synthesis|Synthesize Customer Interview Evidence|product|intermediate|300|250|Code interview notes into themes, retain contradictory evidence, and separate observations from assumptions|A team has twelve interviews and risks selecting only comments that support its roadmap|Markdown,CSV,Research|product,research,synthesis
marketplace-liquidity-strategy|Design a Marketplace Liquidity Strategy|product|advanced|540|400|Identify a constrained side of a marketplace, define liquidity measures, and design a safe geographic launch|A local services marketplace has many providers but inconsistent customer response times|SQL,Python,Markdown|product,marketplace,growth
product-led-growth-loop|Design a Product-led Growth Experiment|product|advanced|480|400|Map a value-sharing loop, identify friction and abuse risks, and define a measurable experiment|A collaboration tool wants team adoption without relying on broad paid acquisition|SQL,TypeScript,Markdown|product,growth,experimentation
scaling-saas-product-strategy|Create a Scaling SaaS Product Strategy|product|advanced|600|400|Prioritize platform investment against customer segments, reliability needs, and a multi-quarter outcome plan|A growing SaaS business faces enterprise requests that could fragment its core product|Markdown,SQL,Mermaid|product,strategy,platform
pricing-packaging-research-plan|Design a Pricing and Packaging Research Plan|product|advanced|480|400|Frame willingness-to-pay research, ethical test boundaries, segment hypotheses, and migration risks|A mature product considers new tiers without surprising existing customers or optimizing one metric blindly|Markdown,Sheets,SQL|product,pricing,research
retention-intervention-portfolio|Design a Retention Intervention Portfolio|product|advanced|540|400|Prioritize interventions by user cohort and causal evidence while protecting long-term trust metrics|A subscription product sees early churn concentrated in users with different onboarding paths|SQL,Python,Markdown|product,retention,causal-inference
platform-ecosystem-governance|Define a Platform Ecosystem Governance Model|product|advanced|480|400|Specify contribution criteria, compatibility policy, review ownership, and escalation paths for ecosystem partners|A platform opens extension points and needs quality without blocking independent innovation|Markdown,Mermaid,OpenAPI|product,platform,governance
responsible-personalization-strategy|Design a Responsible Personalization Strategy|product|advanced|540|400|Balance relevance, user control, measurement bias, privacy, and fallback behavior in a personalization proposal|A content service wants better discovery while avoiding opaque or exclusionary ranking outcomes|SQL,Python,Markdown|product,personalization,responsible-design
product-portfolio-investment-case|Build a Product Portfolio Investment Case|product|advanced|600|400|Compare investment scenarios with uncertainty ranges, strategic dependencies, and explicit stop or pivot criteria|A leadership group must allocate a fixed engineering budget across reliability, growth, and new bets|CSV,Markdown,Sheets|product,portfolio,investment
$catalog$)
), parsed as (
  select string_to_array(catalog_line.raw, '|') as part
  from catalog_source
  cross join lateral regexp_split_to_table(catalog_source.raw, E'\\n') as catalog_line(raw)
  where catalog_line.raw <> ''
), catalog as (
  select
    part[1] as slug,
    part[2] as title,
    part[3] as domain,
    part[4] as difficulty,
    part[5]::integer as minutes,
    part[6]::integer as xp,
    part[7] as focus,
    part[8] as scenario,
    string_to_array(part[9], ',') as technologies,
    string_to_array(part[10], ',') as tags
  from parsed
)
insert into public.challenges (
  slug, title, description, short_description, problem_statement, scenario,
  instructions, learning_objectives, requirements, acceptance_criteria,
  submission_requirements, technologies, tags, skill_domain, difficulty,
  xp_reward, estimated_hours, estimated_minutes, rubric, is_published,
  is_platform_seed, created_by
)
select
  catalog.slug,
  catalog.title,
  catalog.focus || '. ' || catalog.scenario || '.',
  catalog.focus,
  catalog.focus || ' The work must be reproducible and explain its key decisions.',
  catalog.scenario,
  jsonb_build_array(
    'Analyze the scenario and state assumptions before implementation.',
    'Implement the challenge focus: ' || catalog.focus || '.',
    'Validate normal and failure cases with repeatable evidence.',
    'Document setup, decisions, limitations, and how to review the deliverables.'
  ),
  jsonb_build_array(
    'Apply ' || catalog.focus || ' to a realistic independent project.',
    'Choose and justify relevant techniques from: ' || array_to_string(catalog.technologies, ', ') || '.',
    'Evaluate edge cases and trade-offs raised by this scenario.'
  ),
  jsonb_build_array(
    'Deliver the core outcome: ' || catalog.focus || '.',
    'Handle relevant invalid input, failure, accessibility, privacy, or recovery cases for the scenario.',
    'Include reproducible validation and explain any unmet or deferred requirement.'
  ),
  jsonb_build_array(
    'A reviewer can identify the requested outcome from the repository evidence.',
    'The implementation or design addresses the scenario constraints and documented edge cases.',
    'Validation evidence matches the delivered behavior; no unverified test success is claimed.',
    'Documentation explains how to inspect the work and its trade-offs.'
  ),
  jsonb_build_object(
    'repository', 'Submit an exact public GitHub repository URL containing the challenge work.',
    'deliverables', jsonb_build_array('README.md', catalog.focus, 'Validation evidence'),
    'evidence_policy', 'Repository metadata is not proof that code executed or a human approved the rubric.'
  ),
  catalog.technologies,
  catalog.tags,
  catalog.domain,
  catalog.difficulty,
  catalog.xp,
  round((catalog.minutes::numeric / 60), 1),
  catalog.minutes,
  jsonb_build_object(
    'max_score', 100,
    'criteria', case catalog.domain
      when 'frontend' then jsonb_build_array(
        jsonb_build_object('key','correctness','label','Behavior and completeness','max',30),
        jsonb_build_object('key','accessibility','label','Accessibility and interaction','max',20),
        jsonb_build_object('key','performance','label','Performance and resilience','max',15),
        jsonb_build_object('key','testing','label','Validation evidence','max',15),
        jsonb_build_object('key','usability','label','User experience','max',10),
        jsonb_build_object('key','documentation','label','Documentation','max',10)
      )
      when 'backend' then jsonb_build_array(
        jsonb_build_object('key','correctness','label','API behavior and completeness','max',25),
        jsonb_build_object('key','security','label','Authorization and input safety','max',20),
        jsonb_build_object('key','reliability','label','Failure handling and consistency','max',20),
        jsonb_build_object('key','contract','label','API and data contract','max',15),
        jsonb_build_object('key','testing','label','Validation evidence','max',10),
        jsonb_build_object('key','documentation','label','Operations and documentation','max',10)
      )
      when 'data' then jsonb_build_array(
        jsonb_build_object('key','correctness','label','Transformation and analytical correctness','max',25),
        jsonb_build_object('key','quality','label','Data quality controls','max',20),
        jsonb_build_object('key','reproducibility','label','Repeatability and lineage','max',15),
        jsonb_build_object('key','performance','label','Scale and resource considerations','max',15),
        jsonb_build_object('key','validation','label','Validation and error handling','max',15),
        jsonb_build_object('key','documentation','label','Definitions and documentation','max',10)
      )
      when 'devops' then jsonb_build_array(
        jsonb_build_object('key','reliability','label','Operational reliability','max',25),
        jsonb_build_object('key','security','label','Security and least privilege','max',20),
        jsonb_build_object('key','automation','label','Automation and repeatability','max',20),
        jsonb_build_object('key','observability','label','Monitoring and diagnostics','max',15),
        jsonb_build_object('key','recovery','label','Rollback and recovery','max',10),
        jsonb_build_object('key','documentation','label','Runbook and documentation','max',10)
      )
      when 'system_design' then jsonb_build_array(
        jsonb_build_object('key','requirements','label','Requirements and constraints','max',20),
        jsonb_build_object('key','architecture','label','Architecture and interfaces','max',25),
        jsonb_build_object('key','reliability','label','Reliability and failure model','max',20),
        jsonb_build_object('key','scalability','label','Scale and data considerations','max',15),
        jsonb_build_object('key','tradeoffs','label','Trade-offs and alternatives','max',10),
        jsonb_build_object('key','communication','label','Clarity and documentation','max',10)
      )
      else jsonb_build_array(
        jsonb_build_object('key','user_problem','label','User problem and evidence','max',20),
        jsonb_build_object('key','outcome','label','Outcome and scope definition','max',20),
        jsonb_build_object('key','experiment','label','Experiment or validation design','max',20),
        jsonb_build_object('key','feasibility','label','Feasibility and risks','max',15),
        jsonb_build_object('key','metrics','label','Metrics and guardrails','max',15),
        jsonb_build_object('key','communication','label','Decision clarity','max',10)
      )
    end
  ),
  true,
  true,
  null
from catalog
on conflict (slug) do nothing;

update public.challenges
set
  short_description = coalesce(short_description, description),
  problem_statement = coalesce(problem_statement, description),
  scenario = coalesce(scenario, description),
  learning_objectives = case
    when learning_objectives = '[]'::jsonb then case slug
      when 'build-a-rate-limited-api' then '["Define a traffic policy and bound resource consumption","Implement predictable limit enforcement and retry metadata","Validate boundary conditions with deterministic tests"]'::jsonb
      when 'implement-a-jwt-refresh-flow' then '["Define token lifetimes and claims","Rotate refresh credentials and detect reuse","Document invalid-session handling and security tests"]'::jsonb
      when 'optimize-react-virtual-list' then '["Measure rendering before and after virtualization","Preserve stable item identity and scroll behavior","Validate keyboard access and large-list performance"]'::jsonb
      else '["Model job lifecycle and delivery guarantees","Design retry, backoff, and dead-letter behavior","Explain operational visibility and recovery trade-offs"]'::jsonb
    end
    else learning_objectives
  end,
  requirements = case
    when requirements = '[]'::jsonb then case slug
      when 'build-a-rate-limited-api' then '["Enforce a documented per-client policy at the API boundary","Return useful limit and retry metadata","Cover allowed, limited, reset, and malformed requests"]'::jsonb
      when 'implement-a-jwt-refresh-flow' then '["Keep refresh credentials out of unsafe client storage","Rotate credentials and invalidate reused sessions","Test expiration, revocation, and replay cases"]'::jsonb
      when 'optimize-react-virtual-list' then '["Render only visible rows plus a bounded overscan","Keep focus and scroll position stable during updates","Compare measured performance against a stated baseline"]'::jsonb
      else '["Specify queue states, retry limits, and terminal failure handling","Make duplicate delivery and worker restarts safe","Provide an operator-visible recovery and inspection path"]'::jsonb
    end
    else requirements
  end,
  acceptance_criteria = case
    when acceptance_criteria = '[]'::jsonb then case slug
      when 'build-a-rate-limited-api' then '["Requests within policy succeed and excess requests receive a stable limit response","Retry timing and remaining capacity are accurate","Automated tests cover limits, reset, and invalid input"]'::jsonb
      when 'implement-a-jwt-refresh-flow' then '["A valid refresh rotates credentials without extending beyond policy","Reused or expired credentials cannot create a valid session","Tests cover rotation, revocation, and concurrent refresh attempts"]'::jsonb
      when 'optimize-react-virtual-list' then '["Large datasets render within a measured bounded DOM window","Keyboard and scroll behavior remain usable","Benchmark evidence includes method and before/after result"]'::jsonb
      else '["Job state transitions and delivery guarantees are explicit","Retries are bounded and terminal failures are inspectable","The design explains consistency, observability, and recovery trade-offs"]'::jsonb
    end
    else acceptance_criteria
  end,
  submission_requirements = case
    when submission_requirements = '{}'::jsonb then jsonb_build_object(
      'repository', 'Submit a public GitHub repository containing the challenge work.',
      'deliverables', case slug
        when 'build-a-rate-limited-api' then '["API implementation","Rate-limit policy","Tests and README"]'::jsonb
        when 'implement-a-jwt-refresh-flow' then '["Token refresh implementation","Threat notes","Tests and README"]'::jsonb
        when 'optimize-react-virtual-list' then '["Virtualized component","Performance measurements","Accessibility notes and tests"]'::jsonb
        else '["Queue architecture or implementation","Failure and recovery walkthrough","Tests or design validation and README"]'::jsonb
      end
    )
    else submission_requirements
  end,
  technologies = case
    when cardinality(technologies) = 0 then case slug
      when 'build-a-rate-limited-api' then array['TypeScript','Node.js','HTTP','Vitest']
      when 'implement-a-jwt-refresh-flow' then array['TypeScript','JWT','HTTP','Vitest']
      when 'optimize-react-virtual-list' then array['React','TypeScript','Playwright']
      else array['PostgreSQL','queues','Mermaid','OpenTelemetry']
    end
    else technologies
  end,
  tags = case
    when cardinality(tags) = 0 then case slug
      when 'build-a-rate-limited-api' then array['backend','rate-limiting','api']
      when 'implement-a-jwt-refresh-flow' then array['backend','authentication','security']
      when 'optimize-react-virtual-list' then array['frontend','performance','virtualization']
      else array['system-design','queues','reliability']
    end
    else tags
  end,
  estimated_minutes = coalesce(estimated_minutes, greatest(15, round(coalesce(estimated_hours, 2) * 60)::integer)),
  is_published = true,
  is_platform_seed = true
where slug in (
  'build-a-rate-limited-api',
  'implement-a-jwt-refresh-flow',
  'optimize-react-virtual-list',
  'design-an-event-driven-job-queue'
);

do $$
declare
  platform_count integer;
  invalid_rubrics integer;
begin
  select count(*) into platform_count
  from public.challenges
  where is_platform_seed = true and is_published = true;

  if platform_count <> 120 then
    raise exception 'Expected exactly 120 published platform challenges; found %', platform_count;
  end if;

  select count(*) into invalid_rubrics
  from (
    select challenge.id
    from public.challenges challenge
    cross join lateral jsonb_array_elements(challenge.rubric -> 'criteria') criterion
    where challenge.is_platform_seed = true
    group by challenge.id
    having sum((criterion ->> 'max')::integer) <> 100
  ) as invalid;

  if coalesce(invalid_rubrics, 0) <> 0 then
    raise exception 'Every platform challenge rubric must total 100';
  end if;

  if exists (
    with expected(domain, difficulty, expected_count) as (
      values
        ('frontend', 'beginner', 7), ('frontend', 'intermediate', 7), ('frontend', 'advanced', 6),
        ('backend', 'beginner', 7), ('backend', 'intermediate', 7), ('backend', 'advanced', 6),
        ('data', 'beginner', 7), ('data', 'intermediate', 7), ('data', 'advanced', 6),
        ('devops', 'beginner', 7), ('devops', 'intermediate', 6), ('devops', 'advanced', 7),
        ('system_design', 'beginner', 6), ('system_design', 'intermediate', 7), ('system_design', 'advanced', 7),
        ('product', 'beginner', 6), ('product', 'intermediate', 6), ('product', 'advanced', 8)
    ),
    actual as (
      select skill_domain, difficulty, count(*) as actual_count
      from public.challenges
      where is_platform_seed = true and is_published = true
      group by skill_domain, difficulty
    )
    select 1
    from expected
    left join actual on actual.skill_domain = expected.domain and actual.difficulty = expected.difficulty
    where coalesce(actual.actual_count, 0) <> expected.expected_count
  ) then
    raise exception 'Platform challenge domain and difficulty distribution is invalid';
  end if;
end;
$$;
