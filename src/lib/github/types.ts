export type CheckStatus = "passed" | "failed" | "unknown" | "skipped";

export type VerificationCheck = {
  name: string;
  status: CheckStatus;
  evidenceReference: string;
  summary: string;
  observedAt: string;
};

export type VerificationSnapshot = {
  verificationVersion: "github-rest-v1";
  observedAt: string;
  repository: {
    owner: string;
    name: string;
    fullName: string;
    url: string;
    defaultBranch: string | null;
    description: string | null;
    topics: string[];
    languages: Record<string, number>;
  };
  checks: VerificationCheck[];
  components: {
    readmeScore: number;
    workflowConfiguredScore: number;
    passingTestJobScore: number | null;
    ciPassingScore: number;
    recentActivityScore: number;
    skillRelevanceScore: number;
    metadataCompletenessScore: number;
  };
  repoEvidenceScore: number;
};
