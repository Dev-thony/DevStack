import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReviewSchema, calculateReviewTotal } from "@/lib/reviews/review";
import { recalculateDomain } from "@/lib/reviews/recalculate";
import {
  canPeerReview,
  requireMentorApproval,
  WorkspaceAuthorizationError,
} from "@/lib/auth/workspaces";

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in before reading reviews." } },
      { status: 401 },
    );
  }

  const [receivedResult, submittedResult] = await Promise.all([
    supabase
      .from("reviews")
      .select("id,submission_id,reviewer_id,reviewer_type,criteria_scores,total_score,feedback,decision,created_at")
      .eq("reviewee_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("id,submission_id,reviewee_id,reviewer_type,criteria_scores,total_score,feedback,decision,created_at")
      .eq("reviewer_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (receivedResult.error || submittedResult.error) {
    return NextResponse.json(
      { ok: false, error: { code: "REVIEWS_READ_FAILED", message: "Reviews could not be loaded." } },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      received: receivedResult.data ?? [],
      submitted: submittedResult.data ?? [],
    },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsed = await request.json().catch(() => null);
  const input = ReviewSchema.safeParse(parsed);
  if (!input.success) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_REVIEW", message: "Review fields or scores are invalid." } },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in before submitting a review." } },
      { status: 401 },
    );
  }

  let reviewerType: "peer" | "mentor" = "peer";
  try {
    await requireMentorApproval(supabase, user.id);
    reviewerType = "mentor";
  } catch (caught) {
    if (
      !(caught instanceof WorkspaceAuthorizationError) ||
      caught.code !== "MENTOR_APPROVAL_REQUIRED"
    ) {
      throw caught;
    }
  }
  if (reviewerType === "peer" && !(await canPeerReview(supabase, user.id))) {
    return NextResponse.json({ ok: false, error: { code: "REVIEW_FORBIDDEN", message: "Review access requires an approved Mentor or Developer workspace." } }, { status: 403 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,display_name,username")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json(
      { ok: false, error: { code: "PROFILE_REQUIRED", message: "Create an application profile before reviewing." } },
      { status: 403 },
    );
  }

  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .select("id,user_id,skill_domain,status")
    .eq("id", input.data.submissionId)
    .maybeSingle();

  if (submissionError || !submission) {
    return NextResponse.json(
      { ok: false, error: { code: "SUBMISSION_NOT_FOUND", message: "Submission was not found." } },
      { status: 404 },
    );
  }
  if (!["verified", "approved"].includes(submission.status)) {
    return NextResponse.json(
      { ok: false, error: { code: "SUBMISSION_NOT_ELIGIBLE", message: "Only verified submissions can be reviewed." } },
      { status: 409 },
    );
  }
  if (submission.user_id === user.id) {
    return NextResponse.json(
      { ok: false, error: { code: "SELF_REVIEW", message: "You cannot review your own submission." } },
      { status: 403 },
    );
  }

  const { data: duplicate } = await supabase
    .from("reviews")
    .select("id")
    .eq("submission_id", submission.id)
    .eq("reviewer_id", user.id)
    .maybeSingle();
  if (duplicate) {
    return NextResponse.json(
      { ok: false, error: { code: "DUPLICATE_REVIEW", message: "You have already reviewed this submission." } },
      { status: 409 },
    );
  }

  try {
    const admin = createAdminClient();
    const totalScore = calculateReviewTotal(input.data);

    const { data: review, error: reviewError } = await admin
      .from("reviews")
      .insert({
        submission_id: submission.id,
        reviewer_id: user.id,
        reviewee_id: submission.user_id,
        reviewer_type: reviewerType,
        criteria_scores: {
          functionality: input.data.functionality,
          codeQuality: input.data.codeQuality,
          userExperience: input.data.userExperience,
          documentation: input.data.documentation,
          originality: input.data.originality,
        },
        total_score: totalScore,
        feedback: input.data.feedback,
        decision: input.data.decision,
        is_public: input.data.isPublic,
      })
      .select("id,submission_id,reviewer_id,reviewee_id,reviewer_type,total_score,feedback,decision,created_at")
      .single();

    if (reviewError) {
      const code = reviewError.message.includes("duplicate") ? "DUPLICATE_REVIEW" : "REVIEW_WRITE_FAILED";
      return NextResponse.json(
        { ok: false, error: { code, message: "Review could not be persisted." } },
        { status: code === "DUPLICATE_REVIEW" ? 409 : 500 },
      );
    }

    if (input.data.decision === "approved") {
      await admin
        .from("submissions")
        .update({ status: "approved" })
        .eq("id", submission.id);
    }

    await recalculateDomain(admin, submission.user_id, submission.skill_domain);

    return NextResponse.json({ ok: true, data: review }, { status: 201 });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "SERVER_CONFIGURATION", message: "Review service is not configured." } },
      { status: 503 },
    );
  }
}
