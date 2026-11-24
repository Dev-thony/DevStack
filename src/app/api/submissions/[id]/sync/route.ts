import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchRepositoryEvidence, GitHubEvidenceError } from "@/lib/github/service";
import { parseGitHubRepositoryUrl } from "@/lib/github/url";
import { recalculateDomain } from "@/lib/reviews/recalculate";

const paramsSchema = z.object({ id: z.uuid() });

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_SUBMISSION", message: "Submission ID is invalid." } },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in before syncing." } },
      { status: 401 },
    );
  }

  const { data: submission, error } = await supabase
    .from("submissions")
    .select("id,user_id,repo_url,skill_domain")
    .eq("id", params.data.id)
    .maybeSingle();

  if (error || !submission) {
    return NextResponse.json(
      { ok: false, error: { code: "SUBMISSION_NOT_FOUND", message: "Submission was not found." } },
      { status: 404 },
    );
  }
  if (submission.user_id !== user.id) {
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN", message: "You cannot sync another user's submission." } },
      { status: 403 },
    );
  }

  const repository = parseGitHubRepositoryUrl(submission.repo_url);
  if (!repository) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_REPOSITORY_URL", message: "Stored repository URL is invalid." } },
      { status: 422 },
    );
  }

  try {
    const snapshot = await fetchRepositoryEvidence(repository, submission.skill_domain);
    const admin = createAdminClient();
    const status = snapshot.checks.every((check) => check.status === "passed")
      ? "verified"
      : "unknown";
    const { error: updateError } = await admin
      .from("submissions")
      .update({
        status,
        repo_evidence_score: snapshot.repoEvidenceScore,
        verification_snapshot: snapshot as unknown as import("@/types/database").Json,
        verification_version: snapshot.verificationVersion,
        last_synced_at: snapshot.observedAt,
      })
      .eq("id", submission.id);

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: { code: "SNAPSHOT_WRITE_FAILED", message: "Evidence was retrieved but could not be saved." } },
        { status: 500 },
      );
    }

    try {
      await recalculateDomain(admin, user.id, submission.skill_domain);
    } catch {
      return NextResponse.json(
        { ok: false, error: { code: "SCORE_RECALCULATION_FAILED", message: "Repository evidence was saved but the skill score could not be recalculated." } },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, data: snapshot });
  } catch (caught) {
    if (caught instanceof GitHubEvidenceError) {
      const status =
        caught.code === "NOT_FOUND" ? 404 :
        caught.code === "RATE_LIMITED" ? 429 :
        caught.code === "FORBIDDEN" ? 403 :
        caught.code === "TIMEOUT" ? 504 : 502;
      return NextResponse.json(
        { ok: false, error: { code: caught.code, message: caught.message } },
        { status },
      );
    }
    return NextResponse.json(
      { ok: false, error: { code: "TRANSIENT", message: "Evidence synchronization failed." } },
      { status: 502 },
    );
  }
}
