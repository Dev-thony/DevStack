"use client";

import { CheckCircle2, Clock3, Copy, Github, Globe, Linkedin, Share2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SkillRadar } from "./skill-radar";
import type { PassportData } from "@/types/passport";

type PassportDashboardProps = {
  data: PassportData;
  publicUrl?: string;
  profileName: string;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  xUrl?: string | null;
  websiteUrl?: string | null;
  headline?: string | null;
  bio?: string | null;
};

export function PassportDashboard({
  data,
  publicUrl,
  profileName,
  githubUrl,
  linkedinUrl,
  xUrl,
  websiteUrl,
  headline,
  bio,
}: PassportDashboardProps) {
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  function getAbsolutePublicUrl(): string | null {
    if (!publicUrl) return null;
    try {
      return new URL(publicUrl, window.location.origin).toString();
    } catch {
      setShareError("Could not create a shareable public URL.");
      return null;
    }
  }

  async function copyPublicUrl() {
    const url = getAbsolutePublicUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setShareError(null);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setShareError("Could not copy the public URL. Check browser clipboard permissions.");
    }
  }

  async function sharePublicUrl() {
    const url = getAbsolutePublicUrl();
    if (!url) return;
    setShareError(null);
    if (navigator.share) {
      try {
        await navigator.share({ title: profileName, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copyPublicUrl();
  }

  const radarData = data.domains.map((domain) => ({
    domain: domain.label,
    score: domain.score,
  }));
  const verifiedSubmissions = data.submissions.filter(
    (submission) => submission.status === "verified" || submission.status === "approved",
  );
  const approvedSubmissions = data.submissions.filter(
    (submission) => submission.status === "approved",
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-text-muted">{profileName}</p>
          {headline ? <p className="mt-1 text-lg font-semibold">{headline}</p> : null}
          {bio ? <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{bio}</p> : null}
        </div>
        {publicUrl ? (
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => void copyPublicUrl()}>
              <Copy />
              {copied ? "Copied" : "Copy URL"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void sharePublicUrl()}>
              <Share2 />
              Share
            </Button>
          </div>
        ) : null}
        {publicUrl ? (
          <p className="w-full text-sm" role={shareError ? "alert" : "status"}>
            {shareError ?? (copied ? "Public URL copied." : "")}
          </p>
        ) : null}
      </header>

      {githubUrl || linkedinUrl || xUrl || websiteUrl ? (
        <nav aria-label="Profile links" className="flex flex-wrap gap-x-5 gap-y-2">
          {githubUrl ? (
            <a href={githubUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-accent-cyan underline underline-offset-4">
              <Github className="size-4" />
              GitHub
            </a>
          ) : null}
          {linkedinUrl ? (
            <a href={linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-accent-cyan underline underline-offset-4">
              <Linkedin className="size-4" />
              LinkedIn
            </a>
          ) : null}
          {xUrl ? (
            <a href={xUrl} target="_blank" rel="noreferrer" className="text-sm text-accent-cyan underline underline-offset-4">
              X / Twitter
            </a>
          ) : null}
          {websiteUrl ? (
            <a href={websiteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-accent-cyan underline underline-offset-4">
              <Globe className="size-4" />
              Website
            </a>
          ) : null}
        </nav>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardDescription>Live Skill Score</CardDescription>
            <CardTitle className="text-4xl">{data.liveSkillScore} <span className="text-base text-text-muted">/ 1000</span></CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-secondary">
              {data.domains.filter((domain) => domain.evidenceCount > 0).length} evidence-bearing domains
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Six-domain radar</CardTitle>
            <CardDescription>Persisted per-domain evidence scores</CardDescription>
          </CardHeader>
          <CardContent>
            <SkillRadar data={radarData} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.domains.map((domain) => (
          <Card key={domain.domain}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{domain.label}</CardTitle>
                <Badge variant={domain.evidenceCount > 0 ? "verified" : "outline"}>
                  {domain.confidence}
                </Badge>
              </div>
              <CardDescription className="font-mono text-text-primary">{domain.score.toFixed(2)} / 100</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className="h-full rounded-full bg-verification"
                  style={{ width: `${Math.max(0, Math.min(100, domain.score))}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-text-muted">{domain.evidenceCount} evidence source(s)</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Verified repositories</CardTitle>
            <CardDescription>Timestamped repository evidence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {verifiedSubmissions.length === 0 ? (
              <p className="text-sm text-text-secondary">No verified repositories yet.</p>
            ) : (
              verifiedSubmissions.map((submission) => (
                <EvidenceRepository key={submission.id} submission={submission} />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approved challenges</CardTitle>
            <CardDescription>Challenge outcomes and repository evidence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {approvedSubmissions.length === 0 ? (
              <p className="text-sm text-text-secondary">No approved challenges yet.</p>
            ) : (
              approvedSubmissions.map((submission) => (
                <div key={submission.id} className="rounded-lg border px-3 py-3">
                  <p className="text-sm font-medium">{submission.challengeTitle ?? "Challenge"}</p>
                  <p className="mt-1 font-mono text-xs text-text-muted">{submission.repoFullName}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Evidence trail</CardTitle>
          <CardDescription>Public review and repository references</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.reviews.length === 0 ? (
            <p className="text-sm text-text-secondary">No public reviews yet.</p>
          ) : (
            data.reviews.map((review) => (
              <div key={review.id} className="rounded-lg border px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant={review.reviewerType === "mentor" ? "verified" : "outline"}>
                    {review.reviewerType === "mentor" ? "Verified mentor" : "Peer"}
                  </Badge>
                  <span className="font-mono text-sm">{review.totalScore.toFixed(0)} / 100</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{review.feedback}</p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {Object.entries(review.criteriaScores).map(([criterion, score]) => (
                    <div key={criterion} className="flex items-center justify-between gap-2">
                      <dt className="text-text-muted">{criterion.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ")}</dt>
                      <dd className="font-mono text-text-primary">{score}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-xs text-text-muted">{new Date(review.createdAt).toLocaleDateString()}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EvidenceRepository({
  submission,
}: {
  submission: PassportData["submissions"][number];
}) {
  return (
    <div className="rounded-lg border px-3 py-3">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between">
        <div className="min-w-0">
          <a
            href={submission.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-accent-cyan underline underline-offset-4 wrap-anywhere"
          >
            {submission.repoFullName}
          </a>
          <p className="mt-1 text-xs text-text-secondary">{submission.skillDomain.replace("_", " ")}</p>
        </div>
        <Badge variant="verified" className="shrink-0"><CheckCircle2 className="size-3" />Verified</Badge>
      </div>
      <p className="mt-3 flex items-center gap-2 text-xs text-text-muted">
        <Clock3 className="size-3.5" />
        Synced {submission.lastSyncedAt ? new Date(submission.lastSyncedAt).toLocaleString() : "not available"}
      </p>
    </div>
  );
}
