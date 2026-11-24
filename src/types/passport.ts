export type PassportDomain = {
  domain: "frontend" | "backend" | "data" | "devops" | "system_design" | "product";
  label: string;
  score: number;
  evidenceCount: number;
  confidence: "unverified" | "low" | "medium" | "high";
};

export type PassportSubmission = {
  id: string;
  repoFullName: string;
  repoUrl: string;
  skillDomain: string;
  status: "pending" | "verified" | "failed" | "unknown" | "approved";
  evidenceScore: number | null;
  lastSyncedAt: string | null;
  submittedAt: string;
  challengeTitle: string | null;
};

export type PassportReview = {
  id: string;
  reviewerType: "peer" | "mentor";
  criteriaScores: Record<string, number>;
  totalScore: number;
  feedback: string;
  decision: "approved" | "revision_requested";
  createdAt: string;
};

export type PassportData = {
  liveSkillScore: number;
  domains: PassportDomain[];
  submissions: PassportSubmission[];
  reviews: PassportReview[];
};
