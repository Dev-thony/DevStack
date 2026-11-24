import "server-only";

import { Octokit } from "@octokit/rest";
import type { GitHubRepository } from "./url";
import { calculateRepositoryEvidence } from "./scoring";
import type { CheckStatus, VerificationCheck, VerificationSnapshot } from "./types";

export type GitHubEvidenceErrorCode =
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "FORBIDDEN"
  | "TIMEOUT"
  | "TRANSIENT";

export class GitHubEvidenceError extends Error {
  constructor(
    public readonly code: GitHubEvidenceErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function octokit(): Octokit {
  return new Octokit({
    auth: process.env.GITHUB_READONLY_TOKEN || undefined,
    userAgent: "devstack-evidence-verifier",
    request: { timeout: 12_000 },
  });
}

function observedCheck(
  name: string,
  status: CheckStatus,
  evidenceReference: string,
  summary: string,
  observedAt: string,
): VerificationCheck {
  return { name, status, evidenceReference, summary, observedAt };
}

export async function fetchRepositoryEvidence(
  repository: GitHubRepository,
  selectedDomain: "frontend" | "backend" | "data" | "devops" | "system_design" | "product",
): Promise<VerificationSnapshot> {
  const client = octokit();
  const observedAt = new Date().toISOString();

  try {
    const [repoResult, languagesResult, readmeResult, workflowsResult] = await Promise.all([
      client.rest.repos.get({ owner: repository.owner, repo: repository.repo }),
      client.rest.repos.listLanguages({ owner: repository.owner, repo: repository.repo }),
      client.rest.repos.getReadme({ owner: repository.owner, repo: repository.repo }).catch((error: unknown) => {
        if (isStatus(error, 404)) return null;
        throw error;
      }),
      client.rest.actions.listWorkflowRunsForRepo({
        owner: repository.owner,
        repo: repository.repo,
        per_page: 20,
      }).catch((error: unknown) => {
        if (isStatus(error, 404)) return null;
        throw error;
      }),
    ]);

    const repo = repoResult.data;
    if (repo.private) {
      throw new GitHubEvidenceError("FORBIDDEN", "Private repositories are not supported.");
    }

    const readmeText = readmeResult
      ? await decodeReadme(client, repository.owner, repository.repo, readmeResult)
      : "";
    const meaningfulReadme =
      readmeText.trim().length >= 120 &&
      /install|usage|getting started|setup|how to|run/i.test(readmeText);

    const workflowRuns = workflowsResult?.data.workflow_runs ?? [];
    const workflowsConfigured = workflowRuns.length > 0;
    let ciStatus: CheckStatus = "unknown";
    let passingTestJob: "passed" | "unknown" | "failed" = "unknown";
    const checks: VerificationCheck[] = [];

    if (!workflowsConfigured) {
      checks.push(observedCheck(
        "Workflow configured",
        "failed",
        `https://github.com/${repository.fullName}/actions`,
        "No relevant workflow runs were found.",
        observedAt,
      ));
      ciStatus = "failed";
    } else {
      checks.push(observedCheck(
        "Workflow configured",
        "passed",
        `https://github.com/${repository.fullName}/actions`,
        `${workflowRuns.length} recent workflow run(s) found.`,
        observedAt,
      ));

      const latestRun = workflowRuns[0];
      if (latestRun.status === "queued" || latestRun.status === "in_progress" || latestRun.status === "waiting" || latestRun.status === "pending") {
        ciStatus = "unknown";
        checks.push(observedCheck(
          "CI status",
          "unknown",
          latestRun.html_url ?? `https://github.com/${repository.fullName}/actions`,
          `Latest workflow is ${latestRun.status}.`,
          observedAt,
        ));
      } else if (latestRun.conclusion === "success") {
        ciStatus = "passed";
        checks.push(observedCheck(
          "CI status",
          "passed",
          latestRun.html_url ?? `https://github.com/${repository.fullName}/actions`,
          "The latest relevant workflow run completed successfully.",
          observedAt,
        ));
      } else if (latestRun.conclusion) {
        ciStatus = "failed";
        checks.push(observedCheck(
          "CI status",
          "failed",
          latestRun.html_url ?? `https://github.com/${repository.fullName}/actions`,
          `The latest relevant workflow completed with ${latestRun.conclusion}.`,
          observedAt,
        ));
      } else {
        ciStatus = "unknown";
        checks.push(observedCheck(
          "CI status",
          "unknown",
          latestRun.html_url ?? `https://github.com/${repository.fullName}/actions`,
          "The latest workflow outcome is not available.",
          observedAt,
        ));
      }

      try {
        const jobsResult = await client.rest.actions.listJobsForWorkflowRun({
          owner: repository.owner,
          repo: repository.repo,
          run_id: latestRun.id,
          filter: "latest",
          per_page: 100,
        });
        const testJobs = jobsResult.data.jobs.filter((job) =>
          /(^|[-_\s])(test|tests|jest|vitest|pytest|mocha)([-_\s]|$)/i.test(job.name),
        );
        const successfulTestJob = testJobs.find(
          (job) => job.status === "completed" && job.conclusion === "success",
        );

        if (successfulTestJob) {
          passingTestJob = "passed";
          checks.push(observedCheck(
            "Tests Verified",
            "passed",
            successfulTestJob.html_url ?? latestRun.html_url ?? `https://github.com/${repository.fullName}/actions`,
            `Identifiable test job "${successfulTestJob.name}" completed successfully.`,
            observedAt,
          ));
        } else if (testJobs.length === 0) {
          passingTestJob = "unknown";
          checks.push(observedCheck(
            "Tests Verified",
            "unknown",
            latestRun.html_url ?? `https://github.com/${repository.fullName}/actions`,
            "No identifiable test job name was found.",
            observedAt,
          ));
        } else {
          passingTestJob = "failed";
          checks.push(observedCheck(
            "Tests Verified",
            "failed",
            testJobs[0].html_url ?? latestRun.html_url ?? `https://github.com/${repository.fullName}/actions`,
            `Identifiable test job "${testJobs[0].name}" did not complete successfully.`,
            observedAt,
          ));
        }
      } catch (error) {
        if (isStatus(error, 403) || isStatus(error, 429)) {
          passingTestJob = "unknown";
          ciStatus = "unknown";
        }
        checks.push(observedCheck(
          "Tests Verified",
          "unknown",
          latestRun.html_url ?? `https://github.com/${repository.fullName}/actions`,
          "Test-job evidence could not be determined.",
          observedAt,
        ));
      }
    }

    checks.unshift(observedCheck(
      "Meaningful README",
      meaningfulReadme ? "passed" : "failed",
      `https://github.com/${repository.fullName}#readme`,
      meaningfulReadme
        ? "A non-empty README contains project or setup information."
        : "A meaningful README was not established.",
      observedAt,
    ));

    const result = calculateRepositoryEvidence({
      meaningfulReadme,
      workflowsConfigured,
      passingTestJob,
      ciStatus,
      pushedAt: repo.pushed_at,
      selectedDomain,
      languages: languagesResult.data as Record<string, number>,
      topics: repo.topics ?? [],
      description: repo.description,
      defaultBranch: repo.default_branch,
    });

    return {
      verificationVersion: "github-rest-v1",
      observedAt,
      repository: {
        owner: repository.owner,
        name: repository.repo,
        fullName: repository.fullName,
        url: repository.url,
        defaultBranch: repo.default_branch,
        description: repo.description,
        topics: repo.topics ?? [],
        languages: languagesResult.data as Record<string, number>,
      },
      checks,
      components: result.components,
      repoEvidenceScore: result.score,
    };
  } catch (error) {
    if (error instanceof GitHubEvidenceError) throw error;
    if (isStatus(error, 404)) throw new GitHubEvidenceError("NOT_FOUND", "GitHub repository was not found.");
    if (isStatus(error, 403)) throw new GitHubEvidenceError("FORBIDDEN", "GitHub denied repository access.");
    if (isStatus(error, 429)) throw new GitHubEvidenceError("RATE_LIMITED", "GitHub API rate limit reached.");
    if (error instanceof Error && /timeout|timed? out/i.test(error.message)) {
      throw new GitHubEvidenceError("TIMEOUT", "GitHub request timed out.");
    }
    throw new GitHubEvidenceError("TRANSIENT", "GitHub evidence could not be retrieved.");
  }
}

function isStatus(error: unknown, status: number): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number" &&
    (error as { status: number }).status === status
  );
}

async function decodeReadme(
  client: Octokit,
  owner: string,
  repo: string,
  readmeResponse: Awaited<ReturnType<Octokit["rest"]["repos"]["getReadme"]>>,
): Promise<string> {
  if ("content" in readmeResponse.data && typeof readmeResponse.data.content === "string") {
    return Buffer.from(readmeResponse.data.content.replace(/\n/g, ""), "base64").toString("utf8");
  }
  if ("download_url" in readmeResponse.data && readmeResponse.data.download_url) {
    const response = await client.request(readmeResponse.data.download_url);
    return typeof response.data === "string" ? response.data : "";
  }
  return "";
}
