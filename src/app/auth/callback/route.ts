import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadProfile } from "@/lib/auth/profile";
import { completeRegistration } from "@/lib/auth/registration";
import { getWorkspaceDestination } from "@/lib/auth/workspaces";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  const redirect = (path: string) => NextResponse.redirect(new URL(path, request.url));
  if (!code) return redirect("/login?error=oauth_callback_missing");

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) return redirect("/login?error=oauth_callback_failed");
    if (request.nextUrl.searchParams.get("next") === "/reset-password") {
      return redirect("/reset-password");
    }
    const profile = await loadProfile(supabase, data.user.id);
    if (profile && !profile.account_type && data.user.app_metadata.provider === "github") {
      await completeRegistration(supabase, data.user.id, {
        registrationType: "developer",
        username: profile.username,
        displayName: profile.display_name ?? undefined,
      });
    }
    return redirect(await getWorkspaceDestination(supabase, data.user.id));
  } catch {
    return redirect("/login?error=configuration");
  }
}
