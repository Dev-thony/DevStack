import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { WorkspaceContext, WorkspaceMembership } from "@/types/workspaces";
import { z } from "zod";

export class WorkspaceAuthorizationError extends Error {
  constructor(
    public readonly code:
      | "UNAUTHENTICATED"
      | "MEMBERSHIP_REQUIRED"
      | "MENTOR_APPROVAL_REQUIRED"
      | "COMPANY_MEMBERSHIP_REQUIRED",
    message: string,
  ) {
    super(message);
  }
}

export const workspaceSlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);

export function canActivateWorkspace(
  membershipStatus: WorkspaceMembership["membershipStatus"],
): boolean {
  return membershipStatus === "active";
}

export function resolveWorkspaceSelection(
  workspaces: WorkspaceMembership[],
  route: "developer" | "mentor" | "company",
): WorkspaceMembership | null {
  if (route === "developer") {
    return workspaces.find(
      (workspace) =>
        workspace.workspaceType === "personal" &&
        canActivateWorkspace(workspace.membershipStatus),
    ) ?? null;
  }
  if (route === "mentor") {
    return workspaces.find(
      (workspace) =>
        workspace.workspaceType === "mentor" &&
        canActivateWorkspace(workspace.membershipStatus),
    ) ?? null;
  }
  return workspaces.find(
    (workspace) =>
      workspace.workspaceType === "company" &&
      canActivateWorkspace(workspace.membershipStatus),
  ) ?? null;
}

export async function getAuthenticatedUser(
  supabase: SupabaseClient<Database>,
): Promise<User> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new WorkspaceAuthorizationError(
      "UNAUTHENTICATED",
      "Authentication required.",
    );
  }
  return data.user;
}

export async function getUserWorkspaces(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<WorkspaceMembership[]> {
  const { data: memberships, error: membershipsError } = await supabase
    .from("workspace_memberships")
    .select("membership_role,membership_status,workspace_id")
    .eq("user_id", userId)
    .neq("membership_status", "revoked");

  if (membershipsError) {
    throw new Error("Workspaces could not be loaded.");
  }

  const workspaceIds = (memberships ?? []).map(
    (membership) => membership.workspace_id,
  );
  if (workspaceIds.length === 0) return [];

  const { data: workspaces, error: workspacesError } = await supabase
    .from("workspaces")
    .select("id,name,slug,workspace_type")
    .in("id", workspaceIds);

  if (workspacesError) {
    throw new Error("Workspaces could not be loaded.");
  }

  const workspaceMap = new Map(
    (workspaces ?? []).map((workspace) => [workspace.id, workspace]),
  );

  return (memberships ?? []).flatMap((membership) => {
    const workspace = workspaceMap.get(membership.workspace_id);
    if (!workspace) return [];
    return [{
      workspaceId: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      workspaceType: workspace.workspace_type,
      membershipRole: membership.membership_role,
      membershipStatus: membership.membership_status,
    }];
  });
}

export async function requireWorkspaceMembership(
  supabase: SupabaseClient<Database>,
  userId: string,
  workspaceId: string,
): Promise<WorkspaceMembership> {
  const workspaces = await getUserWorkspaces(supabase, userId);
  const membership = workspaces.find(
    (workspace) =>
      workspace.workspaceId === workspaceId &&
      workspace.membershipStatus === "active",
  );

  if (!membership) {
    throw new WorkspaceAuthorizationError(
      "MEMBERSHIP_REQUIRED",
      "Workspace membership required.",
    );
  }
  return membership;
}

export async function canPeerReview(supabase: SupabaseClient<Database>, userId: string): Promise<boolean> {
  return resolveWorkspaceSelection(await getUserWorkspaces(supabase, userId), "developer") !== null;
}

export async function requireMentorApproval(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const { data: mentor, error: mentorError } = await supabase
    .from("mentor_profiles")
    .select("workspace_id,verification_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (
    mentorError ||
    !mentor ||
    mentor.verification_status !== "approved"
  ) {
    throw new WorkspaceAuthorizationError(
      "MENTOR_APPROVAL_REQUIRED",
      "Approved mentor status required.",
    );
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_memberships")
    .select("membership_status")
    .eq("workspace_id", mentor.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (
    membershipError ||
    !membership ||
    membership.membership_status !== "active"
  ) {
    throw new WorkspaceAuthorizationError(
      "MENTOR_APPROVAL_REQUIRED",
      "Approved mentor status requires an active mentor workspace membership.",
    );
  }
}

export async function requireCompanyMembership(
  supabase: SupabaseClient<Database>,
  userId: string,
  companyId: string,
  role?: "owner" | "admin" | "recruiter" | "member",
): Promise<void> {
  const { data: companyMembership, error: companyError } = await supabase
    .from("company_memberships")
    .select("membership_role,membership_status")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (
    companyError ||
    !companyMembership ||
    companyMembership.membership_status !== "active" ||
    (role && companyMembership.membership_role !== role)
  ) {
    throw new WorkspaceAuthorizationError(
      "COMPANY_MEMBERSHIP_REQUIRED",
      "Authorized company membership required.",
    );
  }

  const { data: company, error: companyLookupError } = await supabase
    .from("companies")
    .select("workspace_id,verification_status")
    .eq("id", companyId)
    .maybeSingle();

  if (companyLookupError || !company || company.verification_status !== "approved") {
    throw new WorkspaceAuthorizationError(
      "COMPANY_MEMBERSHIP_REQUIRED",
      "Company workspace could not be resolved.",
    );
  }

  const { data: workspaceMembership, error: workspaceError } = await supabase
    .from("workspace_memberships")
    .select("membership_status")
    .eq("workspace_id", company.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (
    workspaceError ||
    !workspaceMembership ||
    workspaceMembership.membership_status !== "active"
  ) {
    throw new WorkspaceAuthorizationError(
      "COMPANY_MEMBERSHIP_REQUIRED",
      "Active company workspace membership required.",
    );
  }
}

export function getWorkspaceOptions(supabase: SupabaseClient<Database>, userId: string): Promise<WorkspaceMembership[]> {
  return getUserWorkspaces(supabase, userId);
}

export async function getWorkspaceDestination(
  supabase: SupabaseClient<Database>,
  userId: string,
  preferred?: "developer" | "mentor" | "company",
): Promise<string> {
  const [workspaces, { data: profile }] = await Promise.all([
    getUserWorkspaces(supabase, userId),
    supabase.from("profiles").select("account_type").eq("id", userId).maybeSingle(),
  ]);
  const primary = preferred ?? profile?.account_type;
  const ordered = Array.from(new Set([primary, "developer", "mentor", "company"] as const));
  for (const kind of ordered) {
    if (!kind) continue;
    const workspace = resolveWorkspaceSelection(workspaces, kind);
    if (workspace) {
      if (kind === "company") return `/company/${workspace.slug}`;
      return kind === "mentor" ? "/mentor" : "/app";
    }
  }
  if (primary === "mentor") return "/mentor/pending";
  if (primary === "company") return "/company/application-status";
  return "/signup";
}

export async function resolvePersonalWorkspace(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<WorkspaceContext> {
  const workspaces = await getUserWorkspaces(supabase, userId);
  const personal = workspaces.find(
    (workspace) =>
      workspace.workspaceType === "personal" &&
      workspace.membershipStatus === "active",
  );
  if (!personal) {
    throw new WorkspaceAuthorizationError(
      "MEMBERSHIP_REQUIRED",
      "Developer workspace membership required.",
    );
  }
  return {
    workspaceType: "personal",
    workspaceId: personal.workspaceId,
    name: personal.name,
    slug: personal.slug,
    membershipRole: personal.membershipRole,
    membershipStatus: personal.membershipStatus,
  };
}

export async function resolveMentorWorkspace(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<WorkspaceContext> {
  const mentorResult = await supabase
    .from("mentor_profiles")
    .select("workspace_id,verification_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (mentorResult.error || !mentorResult.data) {
    throw new WorkspaceAuthorizationError(
      "MENTOR_APPROVAL_REQUIRED",
      "Mentor workspace is unavailable.",
    );
  }

  const membershipResult = await supabase
    .from("workspace_memberships")
    .select("membership_role,membership_status")
    .eq("workspace_id", mentorResult.data.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (
    membershipResult.error ||
    !membershipResult.data ||
    membershipResult.data.membership_status !== "active" ||
    mentorResult.data.verification_status === "suspended"
  ) {
    throw new WorkspaceAuthorizationError(
      "MENTOR_APPROVAL_REQUIRED",
      "Active mentor workspace membership required.",
    );
  }

  const workspaceResult = await supabase
    .from("workspaces")
    .select("id,name,slug,workspace_type")
    .eq("id", mentorResult.data.workspace_id)
    .maybeSingle();
  if (
    workspaceResult.error ||
    !workspaceResult.data ||
    workspaceResult.data.workspace_type !== "mentor"
  ) {
    throw new WorkspaceAuthorizationError(
      "MEMBERSHIP_REQUIRED",
      "Mentor workspace could not be resolved.",
    );
  }

  return {
    workspaceType: "mentor",
    workspaceId: workspaceResult.data.id,
    name: workspaceResult.data.name,
    slug: workspaceResult.data.slug,
    membershipRole: membershipResult.data.membership_role,
    membershipStatus: membershipResult.data.membership_status,
    mentorVerificationStatus: mentorResult.data.verification_status,
  };
}

export async function resolveCompanyWorkspace(
  supabase: SupabaseClient<Database>,
  userId: string,
  workspaceSlug: string,
): Promise<WorkspaceContext> {
  const parsedSlug = workspaceSlugSchema.safeParse(workspaceSlug);
  if (!parsedSlug.success) {
    throw new WorkspaceAuthorizationError(
      "MEMBERSHIP_REQUIRED",
      "Invalid company workspace slug.",
    );
  }

  const workspaceResult = await supabase
    .from("workspaces")
    .select("id,name,slug,workspace_type")
    .eq("slug", parsedSlug.data)
    .eq("workspace_type", "company")
    .maybeSingle();
  if (workspaceResult.error || !workspaceResult.data) {
    throw new WorkspaceAuthorizationError(
      "MEMBERSHIP_REQUIRED",
      "Company workspace was not found.",
    );
  }

  const membershipResult = await supabase
    .from("workspace_memberships")
    .select("membership_role,membership_status")
    .eq("workspace_id", workspaceResult.data.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (
    membershipResult.error ||
    !membershipResult.data ||
    membershipResult.data.membership_status !== "active"
  ) {
    throw new WorkspaceAuthorizationError(
      "COMPANY_MEMBERSHIP_REQUIRED",
      "Active company workspace membership required.",
    );
  }

  const companyResult = await supabase
    .rpc("get_company_workspace_summary", { p_workspace_id: workspaceResult.data.id })
    .maybeSingle();
  if (companyResult.error || !companyResult.data || companyResult.data.verification_status === "suspended") {
    throw new WorkspaceAuthorizationError(
      "COMPANY_MEMBERSHIP_REQUIRED",
      "Company could not be resolved.",
    );
  }

  const companyMembershipResult = await supabase
    .from("company_memberships")
    .select("membership_role,membership_status")
    .eq("company_id", companyResult.data.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (
    companyMembershipResult.error ||
    !companyMembershipResult.data ||
    companyMembershipResult.data.membership_status !== "active"
  ) {
    throw new WorkspaceAuthorizationError(
      "COMPANY_MEMBERSHIP_REQUIRED",
      "Active company membership required.",
    );
  }

  return {
    workspaceType: "company",
    workspaceId: workspaceResult.data.id,
    workspaceSlug: workspaceResult.data.slug,
    name: companyResult.data.name,
    slug: companyResult.data.slug,
    membershipRole: companyMembershipResult.data.membership_role,
    membershipStatus: companyMembershipResult.data.membership_status,
    companyId: companyResult.data.id,
    verificationStatus: companyResult.data.verification_status,
  };
}
