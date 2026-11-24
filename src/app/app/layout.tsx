import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadProfile } from "@/lib/auth/profile";
import {
  getWorkspaceOptions,
  getWorkspaceDestination,
  resolvePersonalWorkspace,
  WorkspaceAuthorizationError,
} from "@/lib/auth/workspaces";
import { WorkspaceAccessState } from "@/components/workspaces/workspace-access-state";
import { WorkspaceShell } from "@/components/workspaces/workspace-shell";
import { developerWorkspaceNavigation } from "@/components/workspaces/workspace-navigation";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  let resolved:
    | {
        profileLabel: string;
        profileSocialLinks: {
          githubProfileUrl: string | null;
          linkedinUrl: string | null;
          xUrl: string | null;
          websiteUrl: string | null;
        };
        personalWorkspaceId: string;
        personalWorkspaceName: string;
        workspaceOptions: Awaited<ReturnType<typeof getWorkspaceOptions>>;
        mentorStatus: "pending" | "approved" | "rejected" | "suspended" | undefined;
      }
    | null = null;

  try {
    const supabase = await createClient();
    const userResult = await supabase.auth.getUser();
    const user = userResult.data.user;

    if (!user) {
      redirect("/login");
    }

    const destination = await getWorkspaceDestination(supabase, user.id);
    if (destination !== "/app") {
      const workspaces = await getWorkspaceOptions(supabase, user.id);
      if (!workspaces.some((item) => item.workspaceType === "personal" && item.membershipStatus === "active")) redirect(destination);
    }

    const profile = await loadProfile(supabase, user.id);
    const personal = await resolvePersonalWorkspace(supabase, user.id);
    const workspaceOptions = await getWorkspaceOptions(supabase, user.id);
    const mentorResult = await supabase
      .from("mentor_profiles")
      .select("verification_status")
      .eq("user_id", user.id)
      .maybeSingle();
    resolved = {
      profileLabel: profile?.username ?? user.email ?? "Authenticated",
      profileSocialLinks: {
        githubProfileUrl: profile?.github_profile_url ?? null,
        linkedinUrl: profile?.linkedin_url ?? null,
        xUrl: profile?.x_url ?? null,
        websiteUrl: profile?.website_url ?? null,
      },
      personalWorkspaceId: personal.workspaceId,
      personalWorkspaceName: personal.name,
      workspaceOptions,
      mentorStatus: mentorResult.data?.verification_status ?? undefined,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Missing Supabase")) {
      redirect("/login?error=configuration");
    }
    if (error instanceof WorkspaceAuthorizationError) {
      return (
        <WorkspaceAccessState
          title="Developer workspace unavailable"
          description={error.message}
          actionHref="/login"
          actionLabel="Return to sign in"
        />
      );
    }
    throw error;
  }

  return (
    <WorkspaceShell
      activeWorkspaceId={resolved.personalWorkspaceId}
      activeWorkspaceName={resolved.personalWorkspaceName}
      activeWorkspaceType="personal"
      workspaceOptions={resolved.workspaceOptions}
      mentorStatus={resolved.mentorStatus}
      navigation={developerWorkspaceNavigation}
      profileLabel={resolved.profileLabel}
      profileSocialLinks={resolved.profileSocialLinks}
    >
      {children}
    </WorkspaceShell>
  );
}
