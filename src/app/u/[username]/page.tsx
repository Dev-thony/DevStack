import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand/logo";
import { CompactThemeToggle } from "@/components/theme/theme-toggle";
import { loadPassportData } from "@/lib/passport/load";
import { PassportDashboard } from "@/components/passport/passport-dashboard";
import { parseGitHubProfileUrl } from "@/lib/github/url";

type PublicPassportProps = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: PublicPassportProps): Promise<Metadata> {
  const { username } = await params;
  return { title: `${username} — Public Passport` };
}

export default async function PublicPassportPage({ params }: PublicPassportProps) {
  const { username } = await params;
  let profile: {
    username: string;
    display_name: string | null;
    headline: string | null;
    bio: string | null;
    github_profile_url: string | null;
    linkedin_url: string | null;
    x_url: string | null;
    website_url: string | null;
    id: string;
  } | null = null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_profiles")
    .select("id,username,display_name,headline,bio,github_profile_url,linkedin_url,x_url,website_url")
    .eq("username", username)
    .maybeSingle();
  if (error) throw new Error("Public passport could not be loaded.");
  profile = data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-surface">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="DevStack home">
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-2">
            <CompactThemeToggle />
            <Button asChild size="sm">
              <Link href="/signup">Create your passport</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {!profile ? (
          <Card>
            <CardHeader>
              <CardTitle>Public passport not found</CardTitle>
              <CardDescription>
                The profile &ldquo;@{username}&rdquo; may be set to private or does not exist.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          await renderPublicPassport(profile)
        )}
      </main>
    </div>
  );
}

async function renderPublicPassport(profile: {
  username: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  github_profile_url: string | null;
  linkedin_url: string | null;
  x_url: string | null;
  website_url: string | null;
  id: string;
}) {
  const supabase = await createClient();
  const passport = await loadPassportData(supabase, profile.id, { publicOnly: true });
  return (
    <PassportDashboard
      data={passport}
      profileName={profile.display_name ?? `@${profile.username}`}
      githubUrl={parseGitHubProfileUrl(profile.github_profile_url)}
      linkedinUrl={profile.linkedin_url}
      xUrl={profile.x_url}
      websiteUrl={profile.website_url}
      headline={profile.headline}
      bio={profile.bio}
    />
  );
}
