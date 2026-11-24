import type { CheckStatus, VerificationSnapshot } from "./types";

export type RepositoryEvidenceInput = {
  meaningfulReadme: boolean;
  workflowsConfigured: boolean;
  passingTestJob: "passed" | "unknown" | "failed";
  ciStatus: CheckStatus;
  pushedAt: string | null;
  selectedDomain: "frontend" | "backend" | "data" | "devops" | "system_design" | "product";
  languages: Record<string, number>;
  topics: string[];
  description: string | null;
  defaultBranch: string | null;
};

const relevanceMap: Record<RepositoryEvidenceInput["selectedDomain"], string[]> = {
  frontend: ["typescript", "javascript", "css", "html", "react", "nextjs", "vue", "svelte"],
  backend: ["typescript", "javascript", "python", "java", "go", "rust", "c#", "php", "ruby", "node", "express", "fastapi"],
  data: ["python", "r", "jupyter", "pandas", "sql", "spark", "rust"],
  devops: ["dockerfile", "shell", "go", "yaml", "terraform", "kubernetes", "github actions", "ci"],
  system_design: ["typescript", "javascript", "python", "java", "go", "rust", "docker", "kubernetes", "graphql", "queue"],
  product: ["typescript", "javascript", "python", "react", "nextjs", "vue", "graphql", "documentation"],
};

export function calculateRepositoryEvidence(input: RepositoryEvidenceInput): {
  score: number;
  components: VerificationSnapshot["components"];
} {
  const readmeScore = input.meaningfulReadme ? 100 : 0;
  const workflowConfiguredScore = input.workflowsConfigured ? 100 : 0;
  const passingTestJobScore =
    input.passingTestJob === "passed"
      ? 100
      : input.passingTestJob === "unknown"
        ? null
        : 0;
  const ciPassingScore =
    input.ciStatus === "passed"
      ? 100
      : input.ciStatus === "failed"
        ? 0
        : input.ciStatus === "skipped"
          ? 0
          : 50;

  let recentActivityScore = 0;
  if (input.pushedAt) {
    const ageDays = (Date.now() - new Date(input.pushedAt).getTime()) / 86_400_000;
    if (Number.isFinite(ageDays)) {
      recentActivityScore =
        ageDays <= 7 ? 100 :
        ageDays <= 30 ? 80 :
        ageDays <= 90 ? 50 :
        ageDays <= 180 ? 25 : 0;
    }
  }

  const languageNames = Object.keys(input.languages).map((name) => name.toLowerCase());
  const topicNames = input.topics.map((topic) => topic.toLowerCase());
  const relevanceSignals = [...languageNames, ...topicNames];
  const expected = relevanceMap[input.selectedDomain];
  const matches = relevanceSignals.filter((signal) =>
    expected.some((expectedSignal) => signal.includes(expectedSignal)),
  );
  const skillRelevanceScore = matches.length === 0 ? 0 : Math.min(100, 50 + matches.length * 10);

  const metadataParts = [
    Boolean(input.description?.trim()),
    Boolean(input.defaultBranch),
    input.topics.length > 0,
  ];
  const metadataCompletenessScore =
    metadataParts.every(Boolean) ? 100 : metadataParts.filter(Boolean).length > 0 ? 50 : 0;

  const score =
    0.10 * readmeScore +
    0.10 * workflowConfiguredScore +
    0.25 * (passingTestJobScore ?? 0) +
    0.15 * ciPassingScore +
    0.15 * recentActivityScore +
    0.20 * skillRelevanceScore +
    0.05 * metadataCompletenessScore;

  return {
    score: Math.round(score * 100) / 100,
    components: {
      readmeScore,
      workflowConfiguredScore,
      passingTestJobScore,
      ciPassingScore,
      recentActivityScore,
      skillRelevanceScore,
      metadataCompletenessScore,
    },
  };
}
