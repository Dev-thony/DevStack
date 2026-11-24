"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight, Clock3, LoaderCircle, Search, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Domain = "frontend" | "backend" | "data" | "devops" | "system_design" | "product";
type Difficulty = "beginner" | "intermediate" | "advanced";
type ProgressStatus = "in_progress" | "submitted" | "verifying" | "verified" | "needs_revision" | "rejected";
type ChallengeStats = {
  totalChallenges: number;
  completedChallenges: number;
  inProgressChallenges: number;
  submittedChallenges: number;
  earnedXp: number;
};

type Challenge = {
  id: string;
  slug: string;
  title: string;
  description: string;
  short_description: string | null;
  technologies: string[];
  tags: string[];
  skill_domain: Domain;
  difficulty: Difficulty;
  xp_reward: number;
  estimated_minutes: number | null;
  progress: { status: ProgressStatus } | null;
};

type ApiResponse =
  | {
      ok: true;
      data: Challenge[];
      meta: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        stats: {
          totalChallenges: number;
          completedChallenges: number;
          inProgressChallenges: number;
          submittedChallenges: number;
          earnedXp: number;
        };
      };
    }
  | { ok: false; error: { code: string; message: string } };

const pageSize = 12;

const domainLabels: Record<Domain, string> = {
  frontend: "Frontend",
  backend: "Backend",
  data: "Data",
  devops: "DevOps & Cloud",
  system_design: "System Design",
  product: "Product",
};

function formatDuration(minutes: number | null): string {
  if (!minutes) return "Time varies";
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} hr` : `${hours.toFixed(1)} hr`;
}

function statusLabel(status: ProgressStatus | null): string {
  if (status === "verified") return "Verified";
  if (status === "submitted" || status === "verifying") return "Submitted";
  if (status === "needs_revision") return "Needs revision";
  if (status === "rejected") return "Not approved";
  if (status === "in_progress") return "In progress";
  return "Not started";
}

export function ChallengeBrowser() {
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [domain, setDomain] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("recommended");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [stats, setStats] = useState<ChallengeStats>({
    totalChallenges: 0,
    completedChallenges: 0,
    inProgressChallenges: 0,
    submittedChallenges: 0,
    earnedXp: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingSlug, setStartingSlug] = useState<string | null>(null);
  const [requestNumber, setRequestNumber] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      q: debouncedSearch,
      domain,
      difficulty,
      status,
      sort,
      page: String(page),
      pageSize: String(pageSize),
    });

    fetch(`/api/challenges?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as ApiResponse;
        if (!response.ok || !result.ok) {
          throw new Error(result.ok ? "Challenges could not be loaded." : result.error.message);
        }
        return result;
      })
      .then((result) => {
        setChallenges(result.data);
        setTotal(result.meta.total);
        setTotalPages(result.meta.totalPages);
        setStats(result.meta.stats);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Challenges could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedSearch, domain, difficulty, status, sort, page, requestNumber]);

  function updateFilter(setter: (value: string) => void, value: string) {
    setLoading(true);
    setError(null);
    setter(value);
    setPage(1);
  }

  function changePage(nextPage: number) {
    setLoading(true);
    setError(null);
    setPage(nextPage);
  }

  function retry() {
    setLoading(true);
    setError(null);
    setRequestNumber((number) => number + 1);
  }

  async function openChallenge(challenge: Challenge) {
    if (challenge.progress) {
      router.push(`/app/proofs/${challenge.slug}`);
      return;
    }

    setStartingSlug(challenge.slug);
    setError(null);
    try {
      const response = await fetch(`/api/challenges/${challenge.slug}/progress`, { method: "POST" });
      const result = await response.json() as
        | { ok: true }
        | { ok: false; error: { message: string } };
      if (!response.ok || !result.ok) {
        setError(result.ok ? "Challenge could not be started." : result.error.message);
        return;
      }
      router.push(`/app/proofs/${challenge.slug}`);
    } catch {
      setError("Challenge could not be started. Check your connection and try again.");
    } finally {
      setStartingSlug(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Available challenges" value={stats.totalChallenges.toString()} />
        <StatCard label="Completed" value={stats.completedChallenges.toString()} />
        <StatCard label="In progress" value={stats.inProgressChallenges.toString()} />
        <StatCard label="Verified XP" value={stats.earnedXp.toLocaleString()} icon />
      </div>

      <section aria-label="Challenge filters" className="space-y-3">
        <div className="relative max-w-xl">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            aria-label="Search challenges"
            className="pl-9"
            placeholder="Search title, description, technology, or tag"
            value={search}
            onChange={(event) => updateFilter(setSearch, event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterSelect ariaLabel="Filter by domain" value={domain} onChange={(value) => updateFilter(setDomain, value)}>
            <option value="all">All domains</option>
            <option value="frontend">Frontend</option>
            <option value="backend">Backend</option>
            <option value="data">Data</option>
            <option value="devops">DevOps &amp; Cloud</option>
            <option value="system_design">System Design</option>
            <option value="product">Product</option>
          </FilterSelect>
          <FilterSelect ariaLabel="Filter by difficulty" value={difficulty} onChange={(value) => updateFilter(setDifficulty, value)}>
            <option value="all">All levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </FilterSelect>
          <FilterSelect ariaLabel="Filter by progress" value={status} onChange={(value) => updateFilter(setStatus, value)}>
            <option value="all">All statuses</option>
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="submitted">Submitted</option>
            <option value="verified">Verified</option>
          </FilterSelect>
          <FilterSelect ariaLabel="Sort challenges" value={sort} onChange={(value) => updateFilter(setSort, value)}>
            <option value="recommended">Recommended</option>
            <option value="newest">Newest</option>
            <option value="highest_xp">Highest XP</option>
            <option value="shortest_time">Shortest estimated time</option>
            <option value="difficulty">Difficulty</option>
          </FilterSelect>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary" aria-live="polite">
          {loading ? "Updating challenges…" : `${total} ${total === 1 ? "challenge" : "challenges"}`}
        </p>
        {stats.submittedChallenges > 0 ? (
          <p className="text-xs text-text-muted">{stats.submittedChallenges} awaiting review</p>
        ) : null}
      </div>

      {error ? (
        <Card role="alert" className="border-danger/40">
          <CardHeader>
            <CardTitle>Challenges unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" onClick={retry}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Card key={index} className="space-y-4 p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && !error && challenges.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {challenges.map((challenge) => (
            <Card key={challenge.id} className="flex flex-col transition-colors hover:border-zinc-600">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{domainLabels[challenge.skill_domain]}</Badge>
                  <DifficultyBadge difficulty={challenge.difficulty} />
                  <Badge variant={challenge.progress?.status === "verified" ? "verified" : "outline"}>
                    {statusLabel(challenge.progress?.status ?? null)}
                  </Badge>
                </div>
                <div>
                  <CardTitle className="text-lg">
                    <Link className="hover:text-verification" href={`/app/proofs/${challenge.slug}`}>
                      {challenge.title}
                    </Link>
                  </CardTitle>
                  <CardDescription className="mt-2 line-clamp-3">
                    {challenge.short_description ?? challenge.description}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="mt-auto space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  {challenge.technologies.slice(0, 4).map((technology) => (
                    <Badge key={technology} variant="outline">{technology}</Badge>
                  ))}
                  {challenge.technologies.length > 4 ? (
                    <Badge variant="outline">+{challenge.technologies.length - 4}</Badge>
                  ) : null}
                </div>
                <div className="flex items-center gap-4 text-xs text-text-muted">
                  <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" />{formatDuration(challenge.estimated_minutes)}</span>
                  <span className="inline-flex items-center gap-1.5 font-mono"><Trophy className="size-3.5" />{challenge.xp_reward} XP</span>
                </div>
                <Button
                  className="w-full"
                  disabled={startingSlug === challenge.slug}
                  onClick={() => void openChallenge(challenge)}
                >
                  {startingSlug === challenge.slug ? <LoaderCircle className="animate-spin" /> : null}
                  {challenge.progress ? "Continue Challenge" : "Start Challenge"}
                  {startingSlug !== challenge.slug ? <ArrowRight className="ml-auto size-4" /> : null}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && !error && challenges.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No challenges match</CardTitle>
            <CardDescription>Try a different search or clear one or more filters.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!loading && totalPages > 1 ? (
        <nav aria-label="Challenge pages" className="flex items-center justify-between border-t border-border pt-4">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => changePage(Math.max(1, page - 1))}
          >
            <ChevronLeft className="size-4" /> Previous
          </Button>
          <p className="text-sm text-text-secondary" aria-live="polite">
            Page {page} of {totalPages}
          </p>
          <Button
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => changePage(Math.min(totalPages, page + 1))}
          >
            Next <ChevronRight className="size-4" />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, icon = false }: { label: string; value: string; icon?: boolean }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs text-text-muted">{label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
        </div>
        {icon ? <Trophy aria-hidden="true" className="size-4 text-verification" /> : null}
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  ariaLabel,
  value,
  onChange,
  children,
}: {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      aria-label={ariaLabel}
      className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-verification"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const variant = difficulty === "advanced" ? "warning" : difficulty === "intermediate" ? "outline" : "default";
  return <Badge variant={variant}>{difficulty}</Badge>;
}
