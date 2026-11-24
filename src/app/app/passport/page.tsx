import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadPassportData } from "@/lib/passport/load";
import { PassportDashboard } from "@/components/passport/passport-dashboard";
import { parseGitHubProfileUrl } from "@/lib/github/url";

export const metadata: Metadata = { title: "Skill Passport" };

export default async function PassportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [passport, profileResult] = await Promise.all([
    loadPassportData(supabase, user.id),
    supabase
      .from("profiles")
      .select("username,display_name,headline,bio,github_profile_url,linkedin_url,x_url,website_url")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (profileResult.error || !profileResult.data) {
    redirect("/login");
  }

  const profile = profileResult.data;
  const publicUrl =
    typeof process.env.NEXT_PUBLIC_APP_URL === "string"
      ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/u/${profile.username}`
      : `/u/${profile.username}`;

  return (
    <main>
      <header className="mb-6">
        <p className="text-sm text-text-secondary">Evidence-based profile</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Skill Passport</h1>
      </header>
      <PassportDashboard
        data={passport}
        publicUrl={publicUrl}
        profileName={profile.display_name ?? `@${profile.username}`}
        githubUrl={parseGitHubProfileUrl(profile.github_profile_url)}
        linkedinUrl={profile.linkedin_url}
        xUrl={profile.x_url}
        websiteUrl={profile.website_url}
        headline={profile.headline}
        bio={profile.bio}
      />
    </main>
  );
}
