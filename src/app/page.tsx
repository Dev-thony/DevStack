import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Code2,
  Cpu,
  FileCheck2,
  FolderGit2,
  Github,
  Globe2,
  GraduationCap,
  Layers,
  Lock,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trophy,
  Users2,
  Workflow,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand/logo";
import { CompactThemeToggle } from "@/components/theme/theme-toggle";

export const metadata: Metadata = {
  title: "DevStack — Turn skills into verifiable evidence",
  description:
    "DevStack transforms practical engineering challenges, real GitHub projects, and trusted reviews into a living skill passport that shows what you can actually build.",
};

const domains = [
  {
    title: "Frontend Engineering",
    description: "Responsive layouts, state machines, performance budgets, accessibility, and modern component systems.",
    icon: Globe2,
    beginner: 7,
    intermediate: 7,
    advanced: 6,
    total: 20,
    accent: "text-accent-cyan",
  },
  {
    title: "Backend Engineering",
    description: "Resilient APIs, idempotent mutations, rate limiting, secure authentication, and data integrity.",
    icon: Server,
    beginner: 7,
    intermediate: 7,
    advanced: 6,
    total: 20,
    accent: "text-verification",
  },
  {
    title: "Data Engineering",
    description: "ETL pipelines, schema evolution, cohort analytics, deduplication, and quality control contracts.",
    icon: DatabaseIcon,
    beginner: 7,
    intermediate: 7,
    advanced: 6,
    total: 20,
    accent: "text-warning",
  },
  {
    title: "DevOps & Cloud",
    description: "Containerization, CI/CD test gates, log rotation, SLI/SLO monitoring, and safe rollback workflows.",
    icon: Terminal,
    beginner: 7,
    intermediate: 6,
    advanced: 7,
    total: 20,
    accent: "text-accent-cyan",
  },
  {
    title: "System Design",
    description: "Distributed queues, event ingestion, high-throughput caching, failover consistency, and architecture.",
    icon: Cpu,
    beginner: 6,
    intermediate: 7,
    advanced: 7,
    total: 20,
    accent: "text-verification",
  },
  {
    title: "Product Engineering",
    description: "Evidence-based PRDs, metric trees, user journeys, A/B experiments, and feature rollout plans.",
    icon: Workflow,
    beginner: 6,
    intermediate: 6,
    advanced: 8,
    total: 20,
    accent: "text-text-primary",
  },
];

function DatabaseIcon(props: React.ComponentProps<typeof Server>) {
  return <Server {...props} />;
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="DevStack home">
            <BrandLogo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-text-secondary md:flex">
            <a href="#how-it-works" className="hover:text-text-primary">How It Works</a>
            <a href="#domains" className="hover:text-text-primary">Skill Domains</a>
            <a href="#passport" className="hover:text-text-primary">Live Passport</a>
            <a href="#verification" className="hover:text-text-primary">Evidence Verification</a>
          </nav>
          <div className="flex items-center gap-2">
            <CompactThemeToggle />
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 lg:pb-28 lg:pt-24">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1fr)_480px] lg:items-center">
            <div>
              <Badge variant="verified" className="mb-6">
                <BadgeCheck className="size-3.5" />
                Evidence-first developer skills passport
              </Badge>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl sm:leading-[1.08]">
                Your Skills Deserve More Than a CV.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-text-secondary">
                DevStack transforms practical engineering challenges, real GitHub projects, and trusted reviews into a living skill passport that shows what you can actually build.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href="/signup">
                    Start Proving Your Skills
                    <ArrowRight className="ml-1.5 size-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <a href="#how-it-works">Explore How It Works</a>
                </Button>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-border pt-8 text-xs text-text-muted">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-verification" />
                  120 Practical Challenges
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-verification" />
                  Read-Only GitHub CI Checks
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-verification" />
                  Authorized Rubric Reviews
                </span>
              </div>
            </div>

            {/* Live Passport Card Preview */}
            <div className="relative">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-verification/20 to-accent-cyan/20 blur-xl opacity-70" />
              <Card className="relative overflow-hidden border-border bg-surface shadow-2xl">
                <CardHeader className="border-b border-border pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardDescription>Live Skill Passport</CardDescription>
                      <CardTitle className="mt-1 text-xl">Alex Chen</CardTitle>
                      <p className="mt-0.5 text-xs text-text-muted">Senior Full-Stack Engineer</p>
                    </div>
                    <Badge variant="verified">
                      <BadgeCheck className="size-3.5" />
                      Demo data
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-text-muted">Live Skill Score</p>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-4xl font-semibold">320</span>
                        <span className="text-sm text-text-muted">/ 1000</span>
                      </div>
                      <p className="mt-1 text-xs text-text-secondary">4 evidence-bearing domains</p>
                    </div>
                    <div className="grid size-20 place-items-center rounded-2xl border border-verification/30 bg-verification-soft">
                      <Layers className="size-8 text-verification" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { name: "Frontend", score: "92", status: "verified" },
                      { name: "Backend", score: "84", status: "verified" },
                      { name: "DevOps", score: "76", status: "reviewed" },
                      { name: "System Design", score: "68", status: "reviewed" },
                    ].map((item) => (
                      <div key={item.name} className="flex items-center justify-between rounded-md border border-border bg-surface-elevated px-2.5 py-2">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-[10px] capitalize text-text-muted">{item.status}</p>
                        </div>
                        <span className="font-mono text-sm font-semibold">{item.score}</span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-md border border-border bg-surface-elevated p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-mono text-[11px] text-accent-cyan">
                        <Github className="size-3.5" />
                        alexchen/checkout-api
                      </span>
                      <Badge variant="verified" className="text-[10px]">CI passed</Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-text-muted">Passing test job · Readme present · Active commits</p>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <Button asChild variant="outline" size="sm" className="w-full text-xs">
                      <Link href="/u/demo-alex">
                        View live passport demo &rarr;
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Problem Statement Section */}
        <section className="border-t border-border bg-surface py-20 px-4 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <Badge variant="outline" className="mb-3">The Traditional Signal Problem</Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                The Gap Between Stated Skills and Practical Reality
              </h2>
              <p className="mt-4 text-base text-text-secondary leading-relaxed">
                Hiring teams and technical peers spend countless hours sifting through inflated resumes, generic certificates, and unindexed code repositories.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="border-border bg-background">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">CVs List Unsubstantiated Claims</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    Resumes state lists of keywords without proving how an engineer handles edge cases, architecture decisions, or reliability failures.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-border bg-background">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Certificates Do Not Prove Code</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    Passive completion certificates test memorization, not how an engineer handles production trade-offs, CI pipelines, or performance budgets.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-border bg-background">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">GitHub Repos Are Hard to Inspect</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    Recruiters cannot easily clone, build, or verify automated test suites across dozens of applicant repositories without standardized evidence.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-border bg-background">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Employers Need Clearer Evidence</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    Hiring managers need objective, standardized signals: automated workflow validation and rubric-based peer evaluation, not resume guesswork.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-border bg-background">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Developers Need a Portable Record</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    Engineers need a durable, shareable profile that connects their public code, challenge achievements, and reviews into one living passport.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-border bg-background">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Human Review Matters Most</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    Automated checks verify mechanics, but rubric-based mentor evaluation guarantees architectural soundness, clean code, and engineering rigor.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 px-4 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="text-center max-w-2xl mx-auto">
              <Badge variant="outline" className="mb-3">Four-Step Journey</Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                How DevStack Proves Engineering Ability
              </h2>
              <p className="mt-4 text-base text-text-secondary">
                A connected loop connecting real code, read-only evidence, trusted reviews, and a dynamic skill score.
              </p>
            </div>

            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  step: "01",
                  title: "Create Your Identity",
                  description: "Sign in with GitHub or email. Set your primary engineering domains and public profile visibility.",
                  icon: Code2,
                },
                {
                  step: "02",
                  title: "Choose 120 Challenges",
                  description: "Select practical engineering challenges across Beginner, Intermediate, and Advanced tiers with explicit rubrics.",
                  icon: FileCheck2,
                },
                {
                  step: "03",
                  title: "Submit GitHub Evidence",
                  description: "Submit public repositories. DevStack runs read-only CI checks and coordinates authorized peer/mentor review.",
                  icon: FolderGit2,
                },
                {
                  step: "04",
                  title: "Live Skill Passport",
                  description: "Your 6-domain radar updates in real time. Share a verifiable passport URL with peers and recruiters.",
                  icon: Trophy,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.step} className="border-border bg-surface relative">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-2xl font-bold text-text-muted">{item.step}</span>
                        <div className="grid size-10 place-items-center rounded-lg border border-border bg-surface-elevated">
                          <Icon className="size-5 text-verification" />
                        </div>
                      </div>
                      <CardTitle className="mt-4 text-lg">{item.title}</CardTitle>
                      <CardDescription className="text-sm leading-relaxed">
                        {item.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Six Skill Domains Section */}
        <section id="domains" className="border-t border-border bg-surface py-20 px-4 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <Badge variant="outline" className="mb-3">Comprehensive Curriculum</Badge>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Six Distinct Engineering Domains
                </h2>
                <p className="mt-2 text-text-secondary max-w-xl">
                  Exactly 120 practical challenges: 20 per domain, balanced across 40 Beginner, 40 Intermediate, and 40 Advanced tiers.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/signup">Browse Challenge Catalog &rarr;</Link>
              </Button>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {domains.map((d) => {
                const Icon = d.icon;
                return (
                  <Card key={d.title} className="border-border bg-background">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <Icon className={`size-6 ${d.accent}`} />
                        <Badge variant="outline" className="text-xs">
                          {d.total} challenges
                        </Badge>
                      </div>
                      <CardTitle className="mt-4 text-lg font-semibold">{d.title}</CardTitle>
                      <CardDescription className="text-sm leading-relaxed">
                        {d.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="border-t border-border pt-4">
                      <div className="flex items-center justify-between text-xs text-text-muted">
                        <span>{d.beginner} Beginner</span>
                        <span>·</span>
                        <span>{d.intermediate} Intermediate</span>
                        <span>·</span>
                        <span>{d.advanced} Advanced</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Live Skill Passport Showcase */}
        <section id="passport" className="py-20 px-4 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <Badge variant="verified" className="mb-3">
                  <Sparkles className="size-3.5" />
                  Live Skill Passport
                </Badge>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  A Verified Radar That Speaks For Your Code
                </h2>
                <p className="mt-4 text-base text-text-secondary leading-relaxed">
                  Unlike static badges or subjective claims, DevStack scores represent an evidence-weighted composite across every domain where you have delivered verified work.
                </p>

                <div className="mt-8 space-y-4">
                  <div className="rounded-lg border border-border bg-surface p-4">
                    <h3 className="text-sm font-semibold text-text-primary">Repository Evidence Score (50%)</h3>
                    <p className="mt-1 text-xs text-text-secondary">
                      Automated verification of README completeness, GitHub Actions CI pass rates, test job execution, activity recency, and technology relevance.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-surface p-4">
                    <h3 className="text-sm font-semibold text-text-primary">Approved Challenge Rubric (30%)</h3>
                    <p className="mt-1 text-xs text-text-secondary">
                      Completion of structured 100-point rubric criteria covering architectural decisions, edge case handling, and scenario constraints.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-surface p-4">
                    <h3 className="text-sm font-semibold text-text-primary">Peer &amp; Mentor Reviews (20%)</h3>
                    <p className="mt-1 text-xs text-text-secondary">
                      Detailed qualitative reviews from verified mentors and peer developers, ensuring human insight validates the code quality.
                    </p>
                  </div>
                </div>

                <div className="mt-8">
                  <Button asChild size="lg">
                    <Link href="/u/demo-alex">
                      Inspect Demo Passport
                      <ArrowRight className="ml-1.5 size-4" />
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <Card className="border-border bg-surface">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Six-Domain Radar Visualization</CardTitle>
                      <Badge variant="outline">Interactive</Badge>
                    </div>
                    <CardDescription>Visualizing strength across all engineering disciplines</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      {[
                        { domain: "Frontend", score: 92, pct: "92%" },
                        { domain: "Backend", score: 84, pct: "84%" },
                        { domain: "Data", score: 55, pct: "55%" },
                        { domain: "DevOps", score: 76, pct: "76%" },
                        { domain: "System Design", score: 68, pct: "68%" },
                        { domain: "Product", score: 45, pct: "45%" },
                      ].map((item) => (
                        <div key={item.domain} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium text-text-primary">{item.domain}</span>
                            <span className="font-mono text-text-muted">{item.score} / 100</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                            <div className="h-full rounded-full bg-verification" style={{ width: item.pct }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Three Audiences Section */}
        <section className="border-t border-border bg-surface py-20 px-4 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="text-center max-w-2xl mx-auto">
              <Badge variant="outline" className="mb-3">Who It Is For</Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Built For Modern Engineering Ecosystems
              </h2>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              <Card className="border-border bg-background">
                <CardHeader>
                  <div className="grid size-12 place-items-center rounded-xl border border-border bg-surface-elevated text-verification">
                    <Code2 className="size-6" />
                  </div>
                  <CardTitle className="mt-4 text-xl">For Developers</CardTitle>
                  <CardDescription className="text-sm font-medium text-text-primary">
                    &ldquo;Build evidence of what you can do.&rdquo;
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-text-secondary leading-relaxed">
                  Solve realistic challenges, push to public GitHub repos, receive rubric feedback, and build a living passport that differentiates your real engineering ability.
                </CardContent>
              </Card>

              <Card className="border-border bg-background">
                <CardHeader>
                  <div className="grid size-12 place-items-center rounded-xl border border-border bg-surface-elevated text-accent-cyan">
                    <GraduationCap className="size-6" />
                  </div>
                  <CardTitle className="mt-4 text-xl">For Mentors</CardTitle>
                  <CardDescription className="text-sm font-medium text-text-primary">
                    &ldquo;Review real work and help developers improve.&rdquo;
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-text-secondary leading-relaxed">
                  Apply for verified mentor status. Evaluate practical submissions against structured rubrics, provide actionable engineering feedback, and guide developing engineers.
                </CardContent>
              </Card>

              <Card className="border-border bg-background">
                <CardHeader>
                  <div className="grid size-12 place-items-center rounded-xl border border-border bg-surface-elevated text-text-primary">
                    <Users2 className="size-6" />
                  </div>
                  <CardTitle className="mt-4 text-xl">For Companies</CardTitle>
                  <CardDescription className="text-sm font-medium text-text-primary">
                    &ldquo;Discover candidates through practical evidence.&rdquo;
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-text-secondary leading-relaxed">
                  Search verified developer passports, inspect real repository CI evidence, and discover approved mentors with deep domain specialization.
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* GitHub Verification Transparency */}
        <section id="verification" className="py-20 px-4 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <Badge variant="outline" className="mb-3">
                <Github className="size-3.5" />
                Read-Only GitHub Integration
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Honest, Non-Destructive Evidence
              </h2>
              <p className="mt-4 text-base text-text-secondary leading-relaxed">
                DevStack communicates exclusively with GitHub’s public REST API using read-only GET requests. We never clone, execute, or mutate candidate code.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-surface p-5">
                <div className="flex items-center gap-2 text-verification">
                  <CheckCircle2 className="size-4" />
                  <span className="font-semibold text-sm">Passed</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                  Workflows completed successfully with an identified automated test suite job.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-surface p-5">
                <div className="flex items-center gap-2 text-danger">
                  <XCircle className="size-4" />
                  <span className="font-semibold text-sm">Failed</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                  Workflows failed or missing required repository deliverables like README and configuration.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-surface p-5">
                <div className="flex items-center gap-2 text-warning">
                  <HelpCircle className="size-4" />
                  <span className="font-semibold text-sm">Unknown</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                  When CI outcomes cannot be conclusively established, we record unknown rather than faking success.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-surface p-5">
                <div className="flex items-center gap-2 text-accent-cyan">
                  <Lock className="size-4" />
                  <span className="font-semibold text-sm">Read-Only Safety</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                  Zero code execution on DevStack infrastructure. No push access requested or accepted.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Trust & Security */}
        <section className="border-t border-border bg-surface py-20 px-4 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <Badge variant="verified" className="mb-3">
                  <ShieldCheck className="size-3.5" />
                  Platform Trust &amp; Security
                </Badge>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Built on Strict Authorization and Privacy
                </h2>
                <p className="mt-4 text-base text-text-secondary leading-relaxed">
                  Every mutation is validated and server-authorized. Row Level Security protects private profile details and submissions from unauthorized access.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-background p-4">
                  <h3 className="font-semibold text-sm">Server-Side Scoring</h3>
                  <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                    Scoring formulas execute strictly in server services. No client can inject or tamper with score calculations.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-background p-4">
                  <h3 className="font-semibold text-sm">Public / Private Control</h3>
                  <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                    Control passport visibility at any time. Private profiles never expose submissions or scores to the public.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-background p-4">
                  <h3 className="font-semibold text-sm">Administrator Approval</h3>
                  <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                    Mentors must be approved by platform administrators before receiving evaluation permissions.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-background p-4">
                  <h3 className="font-semibold text-sm">Evidence Fingerprinting</h3>
                  <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                    Deterministic SHA-256 evidence hashing detects whether a snapshot has changed over time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-24 px-4 sm:px-6 text-center">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Stop Listing Skills. Start Proving Them.
            </h2>
            <p className="mt-6 text-lg text-text-secondary leading-relaxed">
              Join DevStack to build an evidence-first skills passport, solve practical challenges, and demonstrate what you can really build.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg">
                <Link href="/signup">
                  Create Account
                  <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/signup">Explore Challenges</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-12 px-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-4">
            <BrandLogo />
            <span className="text-xs text-text-muted">Evidence-first developer skills passport</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-text-secondary">
            <a href="#how-it-works" className="hover:text-text-primary">How It Works</a>
            <a href="#domains" className="hover:text-text-primary">Challenges</a>
            <Link href="/u/demo-alex" className="hover:text-text-primary">Demo Passport</Link>
            <Link href="/login" className="hover:text-text-primary">Sign In</Link>
            <Link href="/signup" className="hover:text-text-primary">Get Started</Link>
          </div>

          <div className="flex items-center gap-4">
            <CompactThemeToggle />
            <p className="text-xs text-text-muted">
              &copy; {new Date().getFullYear()} DevStack.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
