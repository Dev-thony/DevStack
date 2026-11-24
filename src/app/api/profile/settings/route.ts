import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ProfileSettingsSchema } from "@/lib/profile/settings";

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_JSON", message: "Settings must be valid JSON." } },
      { status: 400 },
    );
  }

  const parsed = ProfileSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_SETTINGS", message: "Check the profile links and try again." } },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in to update your profile." } },
        { status: 401 },
      );
    }

    const githubUsername = parsed.data.githubProfileUrl
      ? new URL(parsed.data.githubProfileUrl).pathname.slice(1)
      : null;
    const { data, error } = await supabase
      .from("profiles")
      .update({
        github_profile_url: parsed.data.githubProfileUrl,
        github_username: githubUsername,
        linkedin_url: parsed.data.linkedinUrl,
        x_url: parsed.data.xUrl,
        website_url: parsed.data.websiteUrl,
      })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, error: { code: "PROFILE_UPDATE_FAILED", message: "Profile settings could not be saved." } },
        { status: 503 },
      );
    }
    if (!data) {
      return NextResponse.json(
        { ok: false, error: { code: "PROFILE_NOT_FOUND", message: "Your profile could not be found." } },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "PROFILE_UPDATE_FAILED", message: "Profile settings could not be saved." } },
      { status: 503 },
    );
  }
}
