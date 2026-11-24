import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ id: z.uuid() });

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  void request;
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_SUBMISSION", message: "Submission ID is invalid." } },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in before reading submissions." } },
      { status: 401 },
    );
  }

  const { data, error } = await supabase
    .from("submissions")
    .select("id,repo_owner,repo_name,repo_full_name,repo_url,skill_domain,status,repo_evidence_score,verification_snapshot,verification_version,last_synced_at,submitted_at")
    .eq("id", params.data.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: { code: "SUBMISSION_NOT_FOUND", message: "Submission was not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, data });
}
