import { NextResponse } from "next/server";
import { canPeerReview, requireMentorApproval, WorkspaceAuthorizationError } from "@/lib/auth/workspaces";
import { createClient } from "@/lib/supabase/server";

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in before opening the review queue." } },
      { status: 401 },
    );
  }

  if (!(await canPeerReview(supabase, user.id))) {
    try {
      await requireMentorApproval(supabase, user.id);
    } catch (error) {
      if (!(error instanceof WorkspaceAuthorizationError)) throw error;
      return NextResponse.json({ ok: false, error: { code: "REVIEW_FORBIDDEN", message: "Review access requires an approved Mentor or Developer workspace." } }, { status: 403 });
    }
  }

  const [submissionsResult, submittedReviewsResult] = await Promise.all([
    supabase
      .from("submissions")
      .select("id,user_id,challenge_id,repo_full_name,repo_url,skill_domain,status,repo_evidence_score,verification_snapshot,submitted_at")
      .in("status", ["verified", "approved"])
      .neq("user_id", user.id)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("submission_id")
      .eq("reviewer_id", user.id),
  ]);

  if (submissionsResult.error || submittedReviewsResult.error) {
    return NextResponse.json(
      { ok: false, error: { code: "QUEUE_READ_FAILED", message: "Review queue could not be loaded." } },
      { status: 500 },
    );
  }

  const alreadyReviewed = new Set(
    submittedReviewsResult.data.map((review) => review.submission_id),
  );
  const queue = (submissionsResult.data ?? []).filter(
    (submission) => !alreadyReviewed.has(submission.id),
  );

  return NextResponse.json({ ok: true, data: queue });
}
