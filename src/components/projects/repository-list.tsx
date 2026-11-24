"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Github, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Json } from "@/types/database";

type Submission = {
  id: string;
  repo_full_name: string;
  repo_url: string;
  skill_domain: string;
  status: "pending" | "verified" | "failed" | "unknown" | "approved";
  repo_evidence_score: number | null;
  verification_snapshot: Json;
  verification_version: string;
  last_synced_at: string | null;
  submitted_at: string;
};

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export function RepositoryList() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  async function loadSubmissions() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/submissions");
      const result = await response.json() as ApiResponse<Submission[]>;
      if (result.ok) setSubmissions(result.data);
      else setError(result.error.message);
    } catch {
      setError("Repositories could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/submissions");
        const result = await response.json() as ApiResponse<Submission[]>;
        if (!active) return;
        if (result.ok) setSubmissions(result.data);
        else setError(result.error.message);
      } catch {
        if (active) setError("Repositories could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function syncSubmission(id: string) {
    setSyncingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/submissions/${id}/sync`, { method: "POST" });
      const result = await response.json() as ApiResponse<unknown>;
      if (result.ok) await loadSubmissions();
      else setError(result.error.message);
    } catch {
      setError("Evidence synchronization failed.");
    } finally {
      setSyncingId(null);
    }
  }

  if (loading) {
    return <Card><CardHeader><CardTitle>Loading repositories</CardTitle></CardHeader></Card>;
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Repositories unavailable</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (submissions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No repositories connected</CardTitle>
          <CardDescription>Submit a public repository from a challenge to begin evidence verification.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {submissions.map((submission) => {
        const snapshot =
          submission.verification_snapshot &&
          typeof submission.verification_snapshot === "object" &&
          "checks" in submission.verification_snapshot
            ? submission.verification_snapshot
            : null;
        const checks =
          snapshot &&
          typeof snapshot.checks === "object" &&
          snapshot.checks !== null &&
          Array.isArray(snapshot.checks)
            ? snapshot.checks as Array<{ name: string; status: string; summary: string; evidenceReference: string }>
            : [];

        return (
          <Card key={submission.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Github className="size-4 text-text-muted" />
                    <CardTitle className="truncate">{submission.repo_full_name}</CardTitle>
                  </div>
                  <CardDescription className="mt-2">
                    {submission.skill_domain.replace("_", " ")} · Evidence score{" "}
                    <span className="font-mono text-text-primary">
                      {submission.repo_evidence_score?.toFixed(2) ?? "—"}
                    </span>
                  </CardDescription>
                </div>
                <StatusBadge status={submission.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {checks.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {checks.map((check) => (
                    <div key={check.name} className="rounded-lg border px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium">{check.name}</p>
                        <CheckStatus status={check.status} />
                      </div>
                      <p className="mt-1 text-xs leading-5 text-text-secondary">{check.summary}</p>
                      {check.evidenceReference ? (
                        <a
                          href={check.evidenceReference}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block font-mono text-xs text-accent-cyan underline underline-offset-4"
                        >
                          Evidence
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-secondary">No verification snapshot yet.</p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="flex items-center gap-2 text-xs text-text-muted">
                  <Clock3 className="size-3.5" />
                  Last sync:{" "}
                  <span className="font-mono">
                    {submission.last_synced_at
                      ? new Date(submission.last_synced_at).toLocaleString()
                      : "Never"}
                  </span>
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={syncingId === submission.id}
                  onClick={() => void syncSubmission(submission.id)}
                >
                  {syncingId === submission.id ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                  Sync &amp; Verify
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: Submission["status"] }) {
  if (status === "verified" || status === "approved") {
    return <Badge variant="verified">verified</Badge>;
  }
  if (status === "failed") {
    return <Badge variant="warning">failed</Badge>;
  }
  if (status === "unknown") {
    return <Badge variant="outline">unknown</Badge>;
  }
  return <Badge variant="outline">pending</Badge>;
}

function CheckStatus({ status }: { status: string }) {
  if (status === "passed") {
    return <CheckCircle2 className="size-4 text-verification" aria-label="Passed" />;
  }
  if (status === "failed") {
    return <TriangleAlert className="size-4 text-danger" aria-label="Failed" />;
  }
  return <Clock3 className="size-4 text-text-muted" aria-label={status === "skipped" ? "Skipped" : "Unknown"} />;
}
