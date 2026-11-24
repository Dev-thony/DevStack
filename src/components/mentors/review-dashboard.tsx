"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Clock3, Github, LoaderCircle, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type QueueSubmission = {
  id: string;
  user_id: string;
  challenge_id: string;
  repo_full_name: string;
  repo_url: string;
  skill_domain: string;
  status: "verified" | "approved";
  repo_evidence_score: number | null;
  verification_snapshot: unknown;
  submitted_at: string;
};

type Review = {
  id: string;
  submission_id: string;
  reviewer_id: string;
  reviewee_id?: string;
  reviewer_type: "peer" | "mentor";
  criteria_scores: {
    functionality: number;
    codeQuality: number;
    userExperience: number;
    documentation: number;
    originality: number;
  };
  total_score: number;
  feedback: string;
  decision: "approved" | "revision_requested";
  created_at: string;
};

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export function ReviewDashboard() {
  const [queue, setQueue] = useState<QueueSubmission[]>([]);
  const [reviews, setReviews] = useState<{ received: Review[]; submitted: Review[] }>({
    received: [],
    submitted: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [queueResponse, reviewsResponse] = await Promise.all([
        fetch("/api/reviews/queue"),
        fetch("/api/reviews"),
      ]);
      const queueResult = await queueResponse.json() as ApiResponse<QueueSubmission[]>;
      const reviewsResult = await reviewsResponse.json() as ApiResponse<{ received: Review[]; submitted: Review[] }>;
      if (!queueResult.ok) throw new Error(queueResult.error.message);
      if (!reviewsResult.ok) throw new Error(reviewsResult.error.message);
      setQueue(queueResult.data);
      setReviews(reviewsResult.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Review activity could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [queueResponse, reviewsResponse] = await Promise.all([
          fetch("/api/reviews/queue"),
          fetch("/api/reviews"),
        ]);
        const queueResult = await queueResponse.json() as ApiResponse<QueueSubmission[]>;
        const reviewsResult = await reviewsResponse.json() as ApiResponse<{ received: Review[]; submitted: Review[] }>;
        if (!active) return;
        if (!queueResult.ok) throw new Error(queueResult.error.message);
        if (!reviewsResult.ok) throw new Error(reviewsResult.error.message);
        setQueue(queueResult.data);
        setReviews(reviewsResult.data);
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Review activity could not be loaded.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading review activity</CardTitle>
          <CardDescription>Checking the queue and received reviews.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review activity unavailable</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-text-secondary">Developer submissions</p>
            <h2 className="mt-1 text-lg font-semibold">Review Queue</h2>
          </div>
          <Badge variant="outline">{queue.length} eligible</Badge>
        </div>

        {queue.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Queue clear</CardTitle>
              <CardDescription>No eligible submissions are waiting for your review.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          queue.map((submission) => (
            <QueueCard
              key={submission.id}
              submission={submission}
              onSubmitted={() => void load()}
            />
          ))
        )}
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-sm text-text-secondary">Human feedback</p>
          <h2 className="mt-1 text-lg font-semibold">Reviews Received</h2>
        </div>
        {reviews.received.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No reviews yet</CardTitle>
              <CardDescription>Published peer or mentor reviews will appear here.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          reviews.received.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))
        )}
      </section>
    </div>
  );
}

function QueueCard({
  submission,
  onSubmitted,
}: {
  submission: QueueSubmission;
  onSubmitted: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      submissionId: submission.id,
      functionality: Number(form.get("functionality")),
      codeQuality: Number(form.get("codeQuality")),
      userExperience: Number(form.get("userExperience")),
      documentation: Number(form.get("documentation")),
      originality: Number(form.get("originality")),
      feedback: String(form.get("feedback") ?? ""),
      decision: form.get("decision"),
      isPublic: true,
    };

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as ApiResponse<Review>;
      if (!result.ok) {
        setMessage(result.error.message);
      } else {
        setMessage("Review submitted.");
        onSubmitted();
      }
    } catch {
      setMessage("Review could not be submitted.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Github className="size-4 text-text-muted" />
              <CardTitle className="truncate">{submission.repo_full_name}</CardTitle>
            </div>
            <CardDescription className="mt-2">
              {submission.skill_domain.replace("_", " ")} · submitted{" "}
              {new Date(submission.submitted_at).toLocaleDateString()}
            </CardDescription>
          </div>
          <StatusBadge status={submission.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-text-secondary">
            Evidence score{" "}
            <span className="font-mono text-text-primary">
              {submission.repo_evidence_score?.toFixed(2) ?? "Unknown"}
            </span>
          </p>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm">Review Now</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Review {submission.repo_full_name}</DialogTitle>
                <DialogDescription>Scores are calculated and totals are verified on the server.</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={submit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ScoreInput label="Functionality" name="functionality" max={30} />
                  <ScoreInput label="Code Quality" name="codeQuality" max={25} />
                  <ScoreInput label="User Experience" name="userExperience" max={20} />
                  <ScoreInput label="Documentation" name="documentation" max={15} />
                  <ScoreInput label="Originality" name="originality" max={10} />
                </div>
                <label className="block space-y-2 text-sm font-medium">
                  Written feedback
                  <textarea
                    name="feedback"
                    required
                    minLength={10}
                    maxLength={5000}
                    className="min-h-28 w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm font-normal"
                  />
                </label>
                <label className="block space-y-2 text-sm font-medium">
                  Decision
                  <select name="decision" className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
                    <option value="approved">Approved</option>
                    <option value="revision_requested">Revision requested</option>
                  </select>
                </label>
                {message ? <p role="status" className="text-sm text-text-secondary">{message}</p> : null}
                <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? <LoaderCircle className="animate-spin" /> : null}
                  Submit review
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreInput({ label, name, max }: { label: string; name: string; max: number }) {
  return (
    <label className="space-y-2 text-sm font-medium">
      {label} <span className="font-mono text-xs text-text-muted">0–{max}</span>
      <Input name={name} type="number" min={0} max={max} step={1} defaultValue={0} required />
    </label>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const criteria = review.criteria_scores;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{review.total_score.toFixed(0)} / 100</CardTitle>
            <CardDescription className="mt-2">
              <Badge variant={review.reviewer_type === "mentor" ? "verified" : "outline"}>
                {review.reviewer_type === "mentor" ? "Verified mentor" : "Peer"}
              </Badge>
            </CardDescription>
          </div>
          <DecisionBadge decision={review.decision} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <span>Functionality <b className="float-right font-mono">{criteria.functionality}/30</b></span>
          <span>Code quality <b className="float-right font-mono">{criteria.codeQuality}/25</b></span>
          <span>UX <b className="float-right font-mono">{criteria.userExperience}/20</b></span>
          <span>Docs <b className="float-right font-mono">{criteria.documentation}/15</b></span>
          <span>Originality <b className="float-right font-mono">{criteria.originality}/10</b></span>
        </div>
        <p className="rounded-lg border bg-background px-3 py-3 text-sm leading-6 text-text-secondary">
          {review.feedback}
        </p>
        <p className="flex items-center gap-2 text-xs text-text-muted">
          <Clock3 className="size-3.5" />
          {new Date(review.created_at).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: QueueSubmission["status"] }) {
  return status === "approved"
    ? <Badge variant="verified"><CheckCircle2 className="size-3" />Approved</Badge>
    : <Badge variant="outline">Verified</Badge>;
}

function DecisionBadge({ decision }: { decision: Review["decision"] }) {
  return decision === "approved"
    ? <Badge variant="verified"><CheckCircle2 className="size-3" />Approved</Badge>
    : <Badge variant="warning"><RotateCcw className="size-3" />Revision requested</Badge>;
}
