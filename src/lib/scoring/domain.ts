import type { DomainScore, DomainScoreInput } from "./types";

export function calculateDomainScore(input: DomainScoreInput): DomainScore {
  const sources: Array<{ weight: number; score: number }> = [];
  if (input.repoEvidenceScore !== null) sources.push({ weight: 0.5, score: input.repoEvidenceScore });
  if (input.challengeScore !== null) sources.push({ weight: 0.3, score: input.challengeScore });
  if (input.reviewScore !== null) sources.push({ weight: 0.2, score: input.reviewScore });

  if (sources.length === 0) {
    return { compositeScore: 0, evidenceCount: 0, confidence: "unverified" };
  }

  const weight = sources.reduce((total, source) => total + source.weight, 0);
  const compositeScore =
    sources.reduce((total, source) => total + source.score * source.weight, 0) / weight;
  const evidenceCount = sources.length;
  const confidence =
    evidenceCount >= 3 ? "high" :
    evidenceCount === 2 ? "medium" : "low";

  return {
    compositeScore: Math.round(compositeScore * 100) / 100,
    evidenceCount,
    confidence,
  };
}

export function calculateLiveSkillScore(domainScores: DomainScore[]): number {
  const evidenceScores = domainScores.filter((domain) => domain.evidenceCount > 0);
  if (evidenceScores.length === 0) return 0;
  const average =
    evidenceScores.reduce((total, domain) => total + domain.compositeScore, 0) /
    evidenceScores.length;
  return Math.round(10 * average);
}
