import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadProfile } from "@/lib/auth/profile";
import {
  getWorkspaceOptions,
  getWorkspaceDestination,
  resolveMentorWorkspace,
  WorkspaceAuthorizationError,
} from "@/lib/auth/workspaces";
import { WorkspaceShell } from "@/components/workspaces/workspace-shell";
import { WorkspaceAccessState } from "@/components/workspaces/workspace-access-state";
import { mentorWorkspaceNavigation } from "@/components/workspaces/workspace-navigation";

export const dynamic = "force-dynamic";

export default async function MentorLayout({ children }: { children: ReactNode }) {
  let resolved:
    | {
        mentorName: string;
        mentorWorkspaceId: string;
        workspaceOptions: Awaited<ReturnType<typeof getWorkspaceOptions>>;
        mentorStatus: "pending" | "approved" | "rejected" | "suspended";
        profileLabel: string;
        profileSocialLinks: {
          githubProfileUrl: string | null;
          linkedinUrl: string | null;
          xUrl: string | null;
          websiteUrl: string | null;
        };
      }
    | null = null;

  let fallback: string | undefined;
  try {
    const supabase = await createClient();
    const { data: userResult } = await supabase.auth.getUser();
    const user = userResult.user;
    if (!user) redirect("/login");

    const profile = await loadProfile(supabase, user.id);
    fallback = await getWorkspaceDestination(supabase, user.id);
    const mentor = await resolveMentorWorkspace(supabase, user.id);
    if (mentor.workspaceType !== "mentor") return null;
    const workspaceOptions = await getWorkspaceOptions(supabase, user.id);

    resolved = {
      mentorName: mentor.name,
      mentorWorkspaceId: mentor.workspaceId,
      workspaceOptions,
      mentorStatus: mentor.mentorVerificationStatus,
      profileLabel: profile?.username ?? user.email ?? "Mentor",
      profileSocialLinks: {
        githubProfileUrl: profile?.github_profile_url ?? null,
        linkedinUrl: profile?.linkedin_url ?? null,
        xUrl: profile?.x_url ?? null,
        websiteUrl: profile?.website_url ?? null,
      },
    };
  } catch (error) {
    if (error instanceof WorkspaceAuthorizationError) {
      if (fallback && fallback !== "/mentor") redirect(fallback);
      return (
        <WorkspaceAccessState
          title="Mentor workspace unavailable"
          description={error.message}
          actionHref="/mentor/pending"
          actionLabel="View application status"
        />
      );
    }
    throw error;
  }

  return (
    <WorkspaceShell
      activeWorkspaceId={resolved.mentorWorkspaceId}
      activeWorkspaceName={resolved.mentorName}
      activeWorkspaceType="mentor"
      workspaceOptions={resolved.workspaceOptions}
      mentorStatus={resolved.mentorStatus}
      navigation={mentorWorkspaceNavigation.filter((item) => resolved.mentorStatus === "approved" || !["votes", "reviews"].includes(item.icon))}
      profileLabel={resolved.profileLabel}
      profileSocialLinks={resolved.profileSocialLinks}
    >
      {children}
    </WorkspaceShell>
  );
}
