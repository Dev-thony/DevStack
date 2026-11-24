export type Domain =
  | "frontend"
  | "backend"
  | "data"
  | "devops"
  | "system_design"
  | "product";

export type DomainScoreInput = {
  repoEvidenceScore: number | null;
  challengeScore: number | null;
  reviewScore: number | null;
};

export type DomainScore = {
  compositeScore: number;
  evidenceCount: number;
  confidence: "unverified" | "low" | "medium" | "high";
};
