"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Github, LoaderCircle, RefreshCw, Trophy } from "lucide-react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { Database, Json } from "@/types/database";

type Challenge = Pick<
  Database["public"]["Tables"]["challenges"]["Row"],
  | "id"
  | "slug"
  | "title"
  | "description"
  | "short_description"
  | "instructions"
  | "problem_statement"
  | "scenario"
  | "learning_objectives"
  | "requirements"
  | "acceptance_criteria"
  | "submission_requirements"
  | "technologies"
  | "tags"
  | "skill_domain"
  | "difficulty"
  | "xp_reward"
  | "estimated_hours"
  | "estimated_minutes"
  | "rubric"
>;

type Progress = Pick<
  Database["public"]["Tables"]["challenge_progress"]["Row"],
  "id" | "status" | "verified_score" | "awarded_xp" | "started_at" | "verified_at" | "updated_at"
>;

type Submission = Pick<
  Database["public"]["Tables"]["submissions"]["Row"],
  "id" | "repo_url" | "repo_full_name" | "status" | "repo_evidence_score" | "submitted_at" | "last_synced_at"
>;

type Props = {
  challenge: Challenge;
  initialProgress: Progress | null;
  initialSubmissions: Submission[];
};

const createdSubmissionSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    id: z.string().uuid(),
    repo_url: z.string().url(),
    repo_full_name: z.string(),
    status: z.enum(["pending", "verified", "failed", "unknown", "approved"]),
    submitted_at: z.string(),
  }),
});

const evidenceResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    repoEvidenceScore: z.number().min(0).max(100),
    observedAt: z.string(),
    checks: z.array(z.object({
      name: z.string(),
      status: z.enum(["passed", "failed", "unknown", "skipped"]),
      summary: z.string(),
    })),
  }),
});

const rubricSchema = z.object({
  max_score: z.number(),
  criteria: z.array(z.object({
    key: z.string(),
    label: z.string(),
    max: z.number(),
  })),
});

function stringsFromJson(value: Json): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function objectFromJson(value: Json): Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "Time varies";
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} hours` : `${hours.toFixed(1)} hours`;
}

function progressLabel(progress: Progress | null): string {
  if (!progress) return "Not started";
  switch (progress.status) {
    case "in_progress": return "In progress";
    case "submitted": return "Submitted";
    case "verifying": return "Verification in progress";
    case "verified": return "Challenge verified";
    case "needs_revision": return "Needs revision";
    case "rejected": return "Not approved";
  }
}

export function ChallengeDetail({ challenge, initialProgress, initialSubmissions }: Props) {
  const [progress, setProgress] = useState(initialProgress);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [repoUrl, setRepoUrl] = useState("");
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const learningObjectives = stringsFromJson(challenge.learning_objectives);
  const requirements = stringsFromJson(challenge.requirements);
  const acceptanceCriteria = stringsFromJson(challenge.acceptance_criteria);
  const instructions = stringsFromJson(challenge.instructions);
  const submissionDetails = objectFromJson(challenge.submission_requirements);
  const deliverables = stringsFromJson(submissionDetails.deliverables ?? null);
  const rubric = rubricSchema.safeParse(challenge.rubric);

  async function startChallenge() {
    setStarting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/challenges/${challenge.slug}/progress`, { method: "POST" });
      const body = await response.json() as { ok?: boolean; data?: Progress; error?: { message?: string } };
      if (!response.ok || !body.ok || !body.data) {
        setError(body.error?.message ?? "Challenge could not be started.");
        return;
      }
      setProgress(body.data);
      setMessage("Challenge started. Your progress is saved.");
    } catch {
      setError("Challenge could not be started. Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  }

  async function submitProof(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/challenges/${challenge.slug}/submissions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });
      const responseBody: unknown = await response.json().catch(() => null);
      const parsed = createdSubmissionSchema.safeParse(responseBody);
      if (!response.ok || !parsed.success) {
        const errorMessage =
          typeof responseBody === "object" &&
          responseBody !== null &&
          "error" in responseBody &&
          typeof responseBody.error === "object" &&
          responseBody.error !== null &&
          "message" in responseBody.error &&
          typeof responseBody.error.message === "string"
            ? responseBody.error.message
            : "Repository submission could not be created.";
        setError(errorMessage);
        return;
      }

      const newSubmission: Submission = {
        id: parsed.data.data.id,
        repo_url: parsed.data.data.repo_url,
        repo_full_name: parsed.data.data.repo_full_name,
        status: parsed.data.data.status,
        repo_evidence_score: null,
        submitted_at: parsed.data.data.submitted_at,
        last_synced_at: null,
      };
      setSubmissions((previous) => [newSubmission, ...previous]);
      setRepoUrl("");
      const progressResponse = await fetch(`/api/challenges/${challenge.slug}/progress`);
      const progressBody = await progressResponse.json() as { ok?: boolean; data?: Progress | null };
      if (progressResponse.ok && progressBody.ok) setProgress(progressBody.data ?? null);
      setMessage("Repository submitted. Sync its public GitHub evidence below; this does not approve the challenge.");
    } catch {
      setError("Repository submission could not be created. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function syncEvidence(submission: Submission) {
    setSyncingId(submission.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/submissions/${submission.id}/sync`, { method: "POST" });
      const responseBody: unknown = await response.json().catch(() => null);
      const parsed = evidenceResponseSchema.safeParse(responseBody);
      if (!response.ok || !parsed.success) {
        const errorMessage =
          typeof responseBody === "object" &&
          responseBody !== null &&
          "error" in responseBody &&
          typeof responseBody.error === "object" &&
          responseBody.error !== null &&
          "message" in responseBody.error &&
          typeof responseBody.error.message === "string"
            ? responseBody.error.message
            : "Repository evidence could not be synchronized.";
        setError(errorMessage);
        return;
      }

      const evidence = parsed.data.data;
      const allChecksPassed = evidence.checks.every((check) => check.status === "passed");
      setSubmissions((previous) => previous.map((item) =>
        item.id === submission.id
          ? {
              ...item,
              status: allChecksPassed ? "verified" : "unknown",
              repo_evidence_score: evidence.repoEvidenceScore,
              last_synced_at: evidence.observedAt,
            }
          : item,
      ));
      setMessage(
        allChecksPassed
          ? "Repository evidence checks passed. Challenge completion still requires an authorized rubric decision."
          : "Repository evidence was saved with one or more failed or unknown checks. It is not a challenge approval.",
      );
    } catch {
      setError("Repository evidence could not be synchronized. Try again later.");
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/app/proofs" className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="size-4" /> All Practical Proofs
      </Link>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{challenge.skill_domain.replace("_", " ")}</Badge>
          <Badge variant={challenge.difficulty === "advanced" ? "warning" : "default"}>{challenge.difficulty}</Badge>
          <Badge variant={progress?.status === "verified" ? "verified" : "outline"}>{progressLabel(progress)}</Badge>
        </div>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="max-w-3xl space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{challenge.title}</h1>
            <p className="text-text-secondary">{challenge.short_description ?? challenge.description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            <Trophy aria-hidden="true" className="size-4 text-verification" />
            <span className="font-mono">{challenge.xp_reward} XP</span>
            <span className="text-text-muted">·</span>
            <span className="text-text-secondary">{formatDuration(challenge.estimated_minutes)}</span>
          </div>
        </div>
      </header>

      {error ? <p role="alert" className="rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg border border-verification/30 bg-verification/5 p-3 text-sm text-verification">{message}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <DetailSection title="Problem statement">
            <p>{challenge.problem_statement ?? challenge.description}</p>
          </DetailSection>

          <DetailSection title="Engineering scenario">
            <p>{challenge.scenario ?? "Apply the challenge requirements to a realistic engineering context."}</p>
          </DetailSection>

          <DetailSection title="Learning objectives">
            <StringList items={learningObjectives} />
          </DetailSection>

          <DetailSection title="Requirements">
            {requirements.length > 0 ? <StringList items={requirements} ordered /> : (
              <StringList items={instructions} ordered />
            )}
          </DetailSection>

          <DetailSection title="Acceptance criteria">
            <StringList items={acceptanceCriteria} />
          </DetailSection>

          <DetailSection title="Submission requirements">
            <p>{typeof submissionDetails.repository === "string" ? submissionDetails.repository : "Submit a public GitHub repository containing your challenge work."}</p>
            {deliverables.length > 0 ? <StringList items={deliverables} /> : null}
            {typeof submissionDetails.evidence_policy === "string" ? (
              <p className="mt-3 text-xs text-text-muted">{submissionDetails.evidence_policy}</p>
            ) : null}
          </DetailSection>

          <DetailSection title="Evaluation rubric">
            {rubric.success ? (
              <div className="space-y-3">
                <ul className="divide-y divide-border">
                  {rubric.data.criteria.map((criterion) => (
                    <li key={criterion.key} className="flex items-center justify-between gap-4 py-3 text-sm">
                      <span>{criterion.label}</span>
                      <span className="shrink-0 font-mono text-text-secondary">{criterion.max} pts</span>
                    </li>
                  ))}
                </ul>
                <p className="text-right text-xs text-text-muted">Total: {rubric.data.max_score} points</p>
              </div>
            ) : (
              <p role="alert" className="text-sm text-warning">The rubric is unavailable for display.</p>
            )}
          </DetailSection>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your progress</CardTitle>
              <CardDescription>{progressLabel(progress)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Verified challenge score</span>
                <span className="font-mono">{progress?.verified_score === null || !progress ? "—" : `${progress.verified_score}/100`}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Verified XP earned</span>
                <span className="font-mono">{progress?.awarded_xp ?? 0}</span>
              </div>
              {!progress || progress.status === "needs_revision" || progress.status === "rejected" ? (
                <Button className="w-full" disabled={starting} onClick={() => void startChallenge()}>
                  {starting ? <LoaderCircle className="animate-spin" /> : null}
                  {progress ? "Continue Challenge" : "Start Challenge"}
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Submit proof</CardTitle>
              <CardDescription>Connect a repository owned by your linked GitHub account. Evidence checks are read-only.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={(event) => void submitProof(event)}>
                <label htmlFor="proof-repository" className="text-sm font-medium">Public GitHub repository</label>
                <div className="relative">
                  <Github aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
                  <Input
                    id="proof-repository"
                    name="repoUrl"
                    value={repoUrl}
                    onChange={(event) => setRepoUrl(event.target.value)}
                    className="pl-9 font-mono text-xs"
                    placeholder="https://github.com/owner/repository"
                    type="url"
                    required
                  />
                </div>
                <Button className="w-full" type="submit" disabled={submitting}>
                  {submitting ? <LoaderCircle className="animate-spin" /> : null}
                  Submit Proof
                </Button>
              </form>
              <p className="mt-3 text-xs leading-relaxed text-text-muted">
                Repository metadata and CI evidence do not equal human rubric approval. No repository code is cloned or executed.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <section aria-labelledby="challenge-tech-title" className="space-y-3">
        <h2 id="challenge-tech-title" className="text-sm font-medium">Required technologies</h2>
        <div className="flex flex-wrap gap-2">
          {challenge.technologies.map((technology) => <Badge key={technology} variant="outline">{technology}</Badge>)}
        </div>
      </section>

      <section aria-labelledby="challenge-history-title" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="challenge-history-title" className="text-lg font-semibold">Submission history</h2>
            <p className="text-sm text-text-secondary">Each attempt is retained; repository evidence is separate from challenge approval.</p>
          </div>
        </div>
        {submissions.length === 0 ? (
          <Card><CardContent className="py-6 text-sm text-text-secondary">No repository submissions yet.</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {submissions.map((submission) => (
                <SubmissionRow
                  key={submission.id}
                  submission={submission}
                  syncing={syncingId === submission.id}
                  onSync={() => void syncEvidence(submission)}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Card><CardContent className="space-y-3 py-5 text-sm leading-6 text-text-secondary">{children}</CardContent></Card>
    </section>
  );
}

function StringList({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  const List = ordered ? "ol" : "ul";
  return (
    <List className={`space-y-2 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
      {items.map((item) => <li key={item}>{item}</li>)}
    </List>
  );
}

function SubmissionRow({
  submission,
  syncing,
  onSync,
}: {
  submission: Submission;
  syncing: boolean;
  onSync: () => void;
}) {
  const repoStatus =
    submission.status === "verified" ? "Repository checks passed" :
    submission.status === "failed" ? "Repository checks failed" :
    submission.status === "unknown" ? "Evidence needs review" :
    submission.status === "approved" ? "Human review approved" :
    "Awaiting repository sync";
  const variant = submission.status === "verified" || submission.status === "approved" ? "verified" :
    submission.status === "failed" ? "warning" : "outline";

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <a
          href={submission.repo_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-full items-center gap-1.5 truncate text-sm font-medium hover:text-verification"
        >
          <span className="truncate">{submission.repo_full_name}</span>
          <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
        </a>
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <Badge variant={variant}>{repoStatus}</Badge>
          <span>Submitted {new Date(submission.submitted_at).toLocaleDateString()}</span>
          {submission.repo_evidence_score !== null ? <span>Evidence score {submission.repo_evidence_score}/100</span> : null}
          {submission.last_synced_at ? <span>Synced {new Date(submission.last_synced_at).toLocaleDateString()}</span> : null}
        </div>
      </div>
      {submission.status !== "approved" ? (
        <Button
          variant="secondary"
          className="shrink-0"
          disabled={syncing}
          onClick={onSync}
        >
          {syncing ? <LoaderCircle className="animate-spin" /> : <RefreshCw className="size-4" />}
          Sync evidence
        </Button>
      ) : null}
      <Separator className="sm:hidden" />
    </div>
  );
}
