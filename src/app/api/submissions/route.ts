import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(): Promise<NextResponse> {
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
    .select("id,challenge_id,repo_owner,repo_name,repo_full_name,repo_url,skill_domain,status,repo_evidence_score,verification_snapshot,verification_version,last_synced_at,submitted_at")
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "SUBMISSIONS_READ_FAILED", message: "Submissions could not be loaded." } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data: data ?? [] });
}
