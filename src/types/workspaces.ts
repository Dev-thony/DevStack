export type WorkspaceMembership = {
  workspaceId: string;
  name: string;
  slug: string;
  workspaceType: "personal" | "mentor" | "company";
  membershipRole: "owner" | "admin" | "mentor" | "member" | "developer" | "recruiter";
  membershipStatus: "pending" | "active" | "suspended" | "revoked";
};

export type WorkspaceNavigationIcon =
  | "dashboard"
  | "passport"
  | "proofs"
  | "projects"
  | "mentors"
  | "mentor-directory"
  | "votes"
  | "reviews"
  | "passport-search";

export type WorkspaceNavigationItem = {
  href: string;
  label: string;
  icon: WorkspaceNavigationIcon;
};

export type WorkspaceContext =
  | {
      workspaceType: "personal";
      workspaceId: string;
      name: string;
      slug: string;
      membershipRole: WorkspaceMembership["membershipRole"];
      membershipStatus: WorkspaceMembership["membershipStatus"];
    }
  | {
      workspaceType: "mentor";
      workspaceId: string;
      name: string;
      slug: string;
      membershipRole: WorkspaceMembership["membershipRole"];
      membershipStatus: WorkspaceMembership["membershipStatus"];
      mentorVerificationStatus: "pending" | "approved" | "rejected" | "suspended";
    }
  | {
      workspaceType: "company";
      workspaceId: string;
      workspaceSlug: string;
      name: string;
      slug: string;
      membershipRole: WorkspaceMembership["membershipRole"];
      membershipStatus: WorkspaceMembership["membershipStatus"];
      companyId: string;
      verificationStatus: "pending" | "approved" | "rejected" | "suspended";
    };
