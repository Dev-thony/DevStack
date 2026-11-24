import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  PassportData,
  PassportDomain,
  PassportReview,
  PassportSubmission,
} from "@/types/passport";
import { calculateLiveSkillScore } from "@/lib/scoring/domain";

const domainLabels: Record<PassportDomain["domain"], string> = {
  frontend: "Frontend",
  backend: "Backend",
  data: "Data",
  devops: "DevOps",
  system_design: "System Design",
  product: "Product",
};

const domains: PassportDomain["domain"][] = [
  "frontend",
  "backend",
  "data",
  "devops",
  "system_design",
  "product",
];

export async function loadPassportData(
  supabase: SupabaseClient<Database>,
  userId: string,
  options: { publicOnly?: boolean } = {},
): Promise<PassportData> {
  const [scoresResult, submissionsResult, reviewsResult, challengesResult] =
    options.publicOnly
      ? await Promise.all([
          supabase
            .from("public_skill_scores")
            .select("skill_domain,composite_score,evidence_count,confidence")
            .eq("user_id", userId),
          supabase
            .from("public_submissions")
            .select("id,challenge_id,repo_full_name,repo_url,skill_domain,status,repo_evidence_score,last_synced_at,submitted_at")
            .eq("user_id", userId)
            .order("submitted_at", { ascending: false }),
          supabase
            .from("public_reviews")
            .select("id,reviewer_type,criteria_scores,total_score,feedback,decision,created_at")
            .eq("reviewee_id", userId)
            .order("created_at", { ascending: false }),
          supabase.from("challenges").select("id,title"),
        ])
      : await Promise.all([
          supabase
            .from("skill_scores")
            .select("skill_domain,composite_score,evidence_count,confidence")
            .eq("user_id", userId),
          supabase
            .from("submissions")
            .select("id,challenge_id,repo_full_name,repo_url,skill_domain,status,repo_evidence_score,last_synced_at,submitted_at")
            .eq("user_id", userId)
            .order("submitted_at", { ascending: false }),
          supabase
            .from("reviews")
            .select("id,reviewer_type,criteria_scores,total_score,feedback,decision,created_at")
            .eq("reviewee_id", userId)
            .order("created_at", { ascending: false }),
          supabase.from("challenges").select("id,title"),
        ]);

  if (scoresResult.error || submissionsResult.error || reviewsResult.error || challengesResult.error) {
    throw new Error("Passport evidence could not be loaded.");
  }

  const scoreMap = new Map(
    scoresResult.data.map((score) => [score.skill_domain, score]),
  );
  const challengeMap = new Map(
    (challengesResult.data ?? []).map((challenge) => [challenge.id, challenge.title]),
  );

  const passportDomains: PassportDomain[] = domains.map((domain) => {
    const score = scoreMap.get(domain);
    return {
      domain,
      label: domainLabels[domain],
      score: score?.composite_score ?? 0,
      evidenceCount: score?.evidence_count ?? 0,
      confidence: score?.confidence ?? "unverified",
    };
  });

  const liveSkillScore = calculateLiveSkillScore(
    passportDomains.map((domain) => ({
      compositeScore: domain.score,
      evidenceCount: domain.evidenceCount,
      confidence: domain.confidence,
    })),
  );

  const submissions: PassportSubmission[] = (submissionsResult.data ?? []).map((submission) => ({
    id: submission.id,
    repoFullName: submission.repo_full_name,
    repoUrl: submission.repo_url,
    skillDomain: submission.skill_domain,
    status: submission.status,
    evidenceScore: submission.repo_evidence_score,
    lastSyncedAt: submission.last_synced_at,
    submittedAt: submission.submitted_at,
    challengeTitle: challengeMap.get(submission.challenge_id) ?? null,
  }));

  const reviews: PassportReview[] = (reviewsResult.data ?? []).map((review) => ({
    id: review.id,
    reviewerType: review.reviewer_type,
    criteriaScores:
      review.criteria_scores && typeof review.criteria_scores === "object" && !Array.isArray(review.criteria_scores)
        ? Object.fromEntries(
            Object.entries(review.criteria_scores).map(([key, value]) => [
              key,
              typeof value === "number" ? value : 0,
            ]),
          )
        : {},
    totalScore: review.total_score,
    feedback: review.feedback,
    decision: review.decision,
    createdAt: review.created_at,
  }));

  return {
    liveSkillScore,
    domains: passportDomains,
    submissions,
    reviews,
  };
}
