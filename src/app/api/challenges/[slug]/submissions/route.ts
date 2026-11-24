import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseGitHubRepositoryUrl } from "@/lib/github/url";

const paramsSchema = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) });
const bodySchema = z.object({ repoUrl: z.string().trim().min(1).max(2048) });

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const params = paramsSchema.safeParse(await context.params);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!params.success || !body.success) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_REQUEST", message: "Invalid challenge or repository URL." } },
      { status: 400 },
    );
  }

  const repository = parseGitHubRepositoryUrl(body.data.repoUrl);
  if (!repository) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_REPOSITORY_URL", message: "Use an exact public GitHub repository URL." } },
      { status: 422 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in before submitting." } },
      { status: 401 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("github_username")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { ok: false, error: { code: "PROFILE_READ_FAILED", message: "Your linked GitHub account could not be checked." } },
      { status: 500 },
    );
  }
  if (!profile?.github_username) {
    return NextResponse.json(
      { ok: false, error: { code: "GITHUB_ACCOUNT_REQUIRED", message: "Connect a GitHub account before submitting a repository." } },
      { status: 403 },
    );
  }
  if (profile.github_username.toLowerCase() !== repository.owner.toLowerCase()) {
    return NextResponse.json(
      { ok: false, error: { code: "REPOSITORY_OWNER_MISMATCH", message: "Submit a repository owned by your linked GitHub account." } },
      { status: 403 },
    );
  }

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id,skill_domain")
    .eq("slug", params.data.slug)
    .eq("is_published", true)
    .maybeSingle();

  if (challengeError || !challenge) {
    return NextResponse.json(
      { ok: false, error: { code: "CHALLENGE_NOT_FOUND", message: "Challenge was not found." } },
      { status: 404 },
    );
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("submissions")
      .insert({
        user_id: user.id,
        challenge_id: challenge.id,
        repo_owner: repository.owner,
        repo_name: repository.repo,
        repo_full_name: repository.fullName,
        repo_url: repository.url,
        skill_domain: challenge.skill_domain,
        status: "pending",
        verification_snapshot: {},
        verification_version: "github-rest-v1",
      })
      .select("id,challenge_id,repo_url,repo_full_name,status,submitted_at")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: { code: "SUBMISSION_CREATE_FAILED", message: "Submission could not be created." } },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "SERVER_CONFIGURATION", message: "Submission service is not configured." } },
      { status: 503 },
    );
  }
}
