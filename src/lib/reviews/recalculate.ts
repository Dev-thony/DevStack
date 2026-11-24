import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { calculateDomainScore } from "@/lib/scoring/domain";
import type { Domain } from "@/lib/scoring/types";

export async function recalculateDomain(
  admin: SupabaseClient<Database>,
  userId: string,
  domain: Domain,
): Promise<void> {
  const [submissionsResult, reviewsResult, challengeResults, challengeIdsResult] = await Promise.all([
    admin
      .from("submissions")
      .select("repo_evidence_score,status")
      .eq("user_id", userId)
      .eq("skill_domain", domain),
    admin
      .from("reviews")
      .select("total_score")
      .eq("reviewee_id", userId)
      .then(async (result) => {
        if (result.error) return result;
        const submissionIds = await admin
          .from("submissions")
          .select("id")
          .eq("user_id", userId)
          .eq("skill_domain", domain);
        if (submissionIds.error) return submissionIds;
        const ids = submissionIds.data.map((row) => row.id);
        if (ids.length === 0) return { data: [], error: null };
        return admin
          .from("reviews")
          .select("total_score")
          .eq("reviewee_id", userId)
          .in("submission_id", ids);
      }),
    admin
      .from("challenge_progress")
      .select("verified_score,challenge_id")
      .eq("user_id", userId)
      .eq("status", "verified")
      .not("verified_score", "is", null),
    admin
      .from("challenges")
      .select("id")
      .eq("skill_domain", domain),
  ]);

  if (submissionsResult.error || reviewsResult.error || challengeResults.error || challengeIdsResult.error) {
    throw new Error("Domain evidence could not be recalculated.");
  }

  const repoScores = submissionsResult.data
    .map((submission) => submission.repo_evidence_score)
    .filter((score): score is number => score !== null);
  const repoEvidenceScore =
    repoScores.length > 0
      ? repoScores.reduce((total, score) => total + score, 0) / repoScores.length
      : null;
  const domainChallengeIds = new Set(challengeIdsResult.data.map((challenge) => challenge.id));
  const challengeScores = challengeResults.data
    .filter((challenge) => domainChallengeIds.has(challenge.challenge_id))
    .map((challenge) => challenge.verified_score)
    .filter((score): score is number => score !== null);
  const challengeScore =
    challengeScores.length > 0
      ? challengeScores.reduce((total, score) => total + score, 0) / challengeScores.length
      : null;
  const reviewScores = reviewsResult.data.map((review) => review.total_score);
  const reviewScore =
    reviewScores.length > 0
      ? reviewScores.reduce((total, score) => total + score, 0) / reviewScores.length
      : null;

  const domainScore = calculateDomainScore({
    repoEvidenceScore,
    challengeScore,
    reviewScore,
  });

  const evidenceCount =
    repoScores.length +
    challengeScores.length +
    reviewScores.length;

  const confidence =
    evidenceCount >= 3 ? "high" :
    evidenceCount >= 1 ? "medium" : "unverified";

  await admin
    .from("skill_scores")
    .upsert({
      user_id: userId,
      skill_domain: domain,
      repo_evidence_score: repoEvidenceScore ?? 0,
      challenge_score: challengeScore ?? 0,
      review_score: reviewScore ?? 0,
      composite_score: domainScore.compositeScore,
      evidence_count: evidenceCount,
      confidence,
    }, { onConflict: "user_id,skill_domain" });
}
