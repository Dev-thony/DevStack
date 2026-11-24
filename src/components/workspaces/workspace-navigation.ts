import type { WorkspaceNavigationItem } from "@/types/workspaces";

export const developerWorkspaceNavigation: WorkspaceNavigationItem[] = [
  { href: "/app", label: "Overview", icon: "dashboard" },
  { href: "/app/passport", label: "Passport", icon: "passport" },
  { href: "/app/proofs", label: "Proofs", icon: "proofs" },
  { href: "/app/projects", label: "Projects", icon: "projects" },
];

export const mentorWorkspaceNavigation: WorkspaceNavigationItem[] = [
  { href: "/mentor", label: "Overview", icon: "dashboard" },
  { href: "/mentor/mentors", label: "Mentors", icon: "mentor-directory" },
  { href: "/mentor/votes", label: "Votes", icon: "votes" },
  { href: "/mentor/reviews", label: "Reviews", icon: "reviews" },
];

export function companyWorkspaceNavigation(
  workspaceSlug: string,
): WorkspaceNavigationItem[] {
  return [
    { href: `/company/${workspaceSlug}`, label: "Overview", icon: "dashboard" },
    {
      href: `/company/${workspaceSlug}/passport`,
      label: "Passport Search",
      icon: "passport-search",
    },
    {
      href: `/company/${workspaceSlug}/projects`,
      label: "Projects",
      icon: "projects",
    },
    {
      href: `/company/${workspaceSlug}/mentors`,
      label: "Mentor Discovery",
      icon: "mentor-directory",
    },
  ];
}
