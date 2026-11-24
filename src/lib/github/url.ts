import { z } from "zod";

export const GitHubRepositoryUrlSchema = z.string().trim().superRefine((value, context) => {
  if (value !== value.trim()) {
    context.addIssue({ code: "custom", message: "Repository URL must not have surrounding whitespace" });
  }
  if (/[\r\n]/.test(value)) {
    context.addIssue({ code: "custom", message: "Repository URL must be a single-line URL" });
  }
});

export type GitHubRepository = {
  owner: string;
  repo: string;
  fullName: string;
  url: string;
};

export function parseGitHubProfileUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const username = url.pathname.split("/").filter(Boolean);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    username.length !== 1 ||
    !/^[-A-Za-z0-9]+$/.test(username[0])
  ) {
    return null;
  }

  return `https://github.com/${username[0]}`;
}

export function parseGitHubRepositoryUrl(value: string): GitHubRepository | null {
  const parsed = GitHubRepositoryUrlSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  ) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2) {
    return null;
  }

  const [owner, repoWithPossibleSuffix] = segments;
  if (
    !/^[-A-Za-z0-9]+$/.test(owner) ||
    !/^[A-Za-z0-9._-]+$/.test(repoWithPossibleSuffix) ||
    repoWithPossibleSuffix.endsWith(".git")
  ) {
    return null;
  }

  const repo = repoWithPossibleSuffix;
  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
    url: `https://github.com/${owner}/${repo}`,
  };
}
