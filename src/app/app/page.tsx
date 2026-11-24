import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { loadPassportData } from "@/lib/passport/load";

export const metadata: Metadata = {
  title: "Overview",
};

export default async function AppOverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const passport = await loadPassportData(supabase, user.id);
  const verifiedRepos = passport.submissions.filter(
    (submission) => submission.status === "verified" || submission.status === "approved",
  );
  const activeChallenges = passport.submissions.filter(
    (submission) => submission.status === "pending",
  );
  const recentActivity = [
    ...passport.submissions.map((submission) => ({
      id: `repo-${submission.id}`,
      label: submission.repoFullName,
      detail: submission.lastSyncedAt
        ? `Repository synced ${new Date(submission.lastSyncedAt).toLocaleDateString()}`
        : "Repository submitted",
      date: submission.lastSyncedAt ?? submission.submittedAt,
    })),
    ...passport.reviews.map((review) => ({
      id: `review-${review.id}`,
      label: `${review.reviewerType === "mentor" ? "Mentor" : "Peer"} review`,
      detail: `${review.totalScore.toFixed(0)} / 100 · ${review.decision === "approved" ? "Approved" : "Revision requested"}`,
      date: review.createdAt,
    })),
  ].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()).slice(0, 6);
  const totalEvidence = passport.domains.reduce(
    (total, domain) => total + domain.evidenceCount,
    0,
  );
  const nextSteps = [
    {
      title: verifiedRepos.length > 0 ? "Refresh your repository evidence" : "Submit a public repository",
      description: verifiedRepos.length > 0
        ? "Keep your project checks and activity current."
        : "Connect a project to start building an evidence trail.",
      href: "/app/projects",
      label: verifiedRepos.length > 0 ? "View projects" : "Submit repository",
    },
    {
      title: "Complete a practical challenge",
      description: "Demonstrate your skills with a focused, rubric-based task.",
      href: "/app/proofs",
      label: "Browse challenges",
    },
    {
      title: passport.reviews.length > 0 ? "Review your feedback" : "Request a peer review",
      description: passport.reviews.length > 0
        ? "Use reviewer feedback to plan your next improvement."
        : "Get human feedback on the work you have submitted.",
      href: "/app/mentors",
      label: passport.reviews.length > 0 ? "View reviews" : "Explore reviews",
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-text-secondary">Developer workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Overview</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          Track the work, reviews, and verified evidence that make up your developer passport.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Live Skill Score", String(passport.liveSkillScore), `${passport.domains.filter((domain) => domain.evidenceCount > 0).length} evidence-bearing domains · ${totalEvidence} total evidence sources`],
          ["Verified repos", String(verifiedRepos.length), verifiedRepos.length > 0 ? "Repository evidence available" : "No verified repositories"],
          ["Active challenges", String(activeChallenges.length), activeChallenges.length > 0 ? "Pending submissions" : "No active submissions"],
        ].map(([label, value, detail]) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-3xl">{value}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-text-muted">{detail}</span>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Skill domains</CardTitle>
                <CardDescription className="mt-1">Current scores from submitted evidence and reviews.</CardDescription>
              </div>
              <Button asChild size="sm" variant="outline"><Link href="/app/passport">Open passport</Link></Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {passport.domains.map((domain) => (
              <div key={domain.domain} className="min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium">{domain.label}</p>
                  <span className="shrink-0 font-mono text-xs text-text-secondary">
                    {domain.score.toFixed(0)} / 100
                  </span>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-elevated"
                  role="progressbar"
                  aria-label={`${domain.label} score`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.max(0, Math.min(100, domain.score))}
                >
                  <div
                    className="h-full rounded-full bg-verification"
                    style={{ width: `${Math.max(0, Math.min(100, domain.score))}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-text-muted">
                  {domain.evidenceCount > 0
                    ? `${domain.evidenceCount} evidence source${domain.evidenceCount === 1 ? "" : "s"} · ${domain.confidence} confidence`
                    : "No evidence yet"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Build your passport</CardTitle>
            <CardDescription>Choose a next step to grow your evidence trail.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {nextSteps.map((step, index) => (
              <div key={step.title} className="flex items-start gap-3 border-t pt-4 first:border-t-0 first:pt-0">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border font-mono text-xs text-text-muted">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">{step.description}</p>
                  <Link href={step.href} className="mt-2 inline-flex text-xs font-medium text-accent-cyan underline underline-offset-4">
                    {step.label}
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>{recentActivity.length > 0 ? "Recent evidence activity" : "Build your first evidence trail"}</CardTitle>
              <CardDescription>
                {recentActivity.length > 0
                  ? "Persisted repository and review events"
                  : "Submit verified work to start your passport."}
              </CardDescription>
            </div>
            <Badge variant="outline">{recentActivity.length} events</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentActivity.length > 0 ? (
            <div className="space-y-2">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="grid gap-1 border-t pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-3">
                  <div className="min-w-0 wrap-anywhere">
                    <p className="text-sm font-medium">{activity.label}</p>
                    <p className="mt-1 text-xs text-text-secondary">{activity.detail}</p>
                  </div>
                  <time dateTime={activity.date} className="font-mono text-xs text-text-muted">
                    {new Date(activity.date).toLocaleDateString()}
                  </time>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary"><Link href="/app/proofs">Browse proofs</Link></Button>
            <Button asChild variant="secondary"><Link href="/app/projects">Submit repo</Link></Button>
            <Button asChild variant="outline"><Link href="/app/passport">View passport</Link></Button>
            <Button asChild variant="outline"><Link href="/app/mentors">Request review</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
