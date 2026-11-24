import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadProfile } from "@/lib/auth/profile";
import {
  getWorkspaceOptions,
  getWorkspaceDestination,
  resolveCompanyWorkspace,
  WorkspaceAuthorizationError,
} from "@/lib/auth/workspaces";
import { WorkspaceShell } from "@/components/workspaces/workspace-shell";
import { WorkspaceAccessState } from "@/components/workspaces/workspace-access-state";
import { companyWorkspaceNavigation } from "@/components/workspaces/workspace-navigation";

export const dynamic = "force-dynamic";

type CompanyLayoutProps = {
  children: ReactNode;
  params: Promise<{ workspaceSlug: string }>;
};

export default async function CompanyLayout({
  children,
  params,
}: CompanyLayoutProps) {
  const { workspaceSlug } = await params;
  let resolved:
    | {
        companyName: string;
        companyWorkspaceId: string;
        workspaceOptions: Awaited<ReturnType<typeof getWorkspaceOptions>>;
        mentorStatus: "pending" | "approved" | "rejected" | "suspended" | undefined;
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
    const company = await resolveCompanyWorkspace(supabase, user.id, workspaceSlug);
    const workspaceOptions = await getWorkspaceOptions(supabase, user.id);
    const mentorResult = await supabase
      .from("mentor_profiles")
      .select("verification_status")
      .eq("user_id", user.id)
      .maybeSingle();

    resolved = {
      companyName: company.name,
      companyWorkspaceId: company.workspaceId,
      workspaceOptions,
      mentorStatus: mentorResult.data?.verification_status ?? undefined,
      profileLabel: profile?.username ?? user.email ?? "Company",
      profileSocialLinks: {
        githubProfileUrl: profile?.github_profile_url ?? null,
        linkedinUrl: profile?.linkedin_url ?? null,
        xUrl: profile?.x_url ?? null,
        websiteUrl: profile?.website_url ?? null,
      },
    };
  } catch (error) {
    if (error instanceof WorkspaceAuthorizationError) {
      if (fallback && fallback !== `/company/${workspaceSlug}`) redirect(fallback);
      return (
        <WorkspaceAccessState
          title="Company workspace unavailable"
          description={error.message}
          actionHref="/company/application-status"
          actionLabel="View application status"
        />
      );
    }
    throw error;
  }

  return (
    <WorkspaceShell
      activeWorkspaceId={resolved.companyWorkspaceId}
      activeWorkspaceName={resolved.companyName}
      activeWorkspaceType="company"
      workspaceOptions={resolved.workspaceOptions}
      mentorStatus={resolved.mentorStatus}
      navigation={companyWorkspaceNavigation(workspaceSlug)}
      profileLabel={resolved.profileLabel}
      profileSocialLinks={resolved.profileSocialLinks}
    >
      {children}
    </WorkspaceShell>
  );
}
