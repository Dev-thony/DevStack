"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BadgeCheck, Building2, GraduationCap, UserRound } from "lucide-react";
import type { WorkspaceMembership } from "@/types/workspaces";
import { useDismissableDetails } from "./use-dismissable-details";

type WorkspaceSwitcherProps = {
  workspaces: WorkspaceMembership[];
  activeWorkspaceId: string;
  onNavigate?: () => void;
  mentorStatus?: "pending" | "approved" | "rejected" | "suspended";
};

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  mentorStatus,
  onNavigate,
}: WorkspaceSwitcherProps) {
  const pathname = usePathname();
  const detailsRef = useDismissableDetails();
  const personal = workspaces.find(
    (workspace) =>
      workspace.workspaceType === "personal" &&
      workspace.membershipStatus === "active",
  );
  const mentor = workspaces.find(
    (workspace) =>
      workspace.workspaceType === "mentor" &&
      workspace.membershipStatus === "active",
  );
  const companies = workspaces.filter(
    (workspace) =>
      workspace.workspaceType === "company" &&
      workspace.membershipStatus === "active",
  );

  function closeSwitcher(event: React.MouseEvent<HTMLAnchorElement>) {
    event.currentTarget.closest("details")?.removeAttribute("open");
    onNavigate?.();
  }

  return (
    <details ref={detailsRef} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border bg-surface px-2 py-1.5 text-sm hover:border-text-muted">
        <WorkspaceIcon
          workspaceId={activeWorkspaceId}
          workspaces={workspaces}
        />
        <span className="min-w-0 flex-1 truncate">
          {workspaces.find((workspace) => workspace.workspaceId === activeWorkspaceId)?.name ??
            "Workspace"}
        </span>
        <span className="shrink-0 text-xs text-text-muted" aria-hidden="true">⌄</span>
      </summary>

      <div className="mt-2 space-y-1 rounded-lg border bg-surface p-1.5">
        {personal ? (
          <WorkspaceOption
            href="/app"
            onClick={closeSwitcher}
            active={activeWorkspaceId === personal.workspaceId}
            icon={<UserRound className="size-4" />}
            title={personal.name}
            subtitle="Developer workspace"
          />
        ) : null}

        {mentor ? (
          <WorkspaceOption
            href="/mentor"
            onClick={closeSwitcher}
            active={activeWorkspaceId === mentor.workspaceId}
            icon={<GraduationCap className="size-4" />}
            title={mentor.name}
            subtitle={mentorStatus === "approved" ? "Verified mentor" : "Unverified mentor"}
          />
        ) : mentorStatus && mentorStatus !== "approved" ? (
          <Link
            href="/mentor/pending"
            onClick={closeSwitcher}
            className="block rounded-md border border-warning/30 bg-surface px-3 py-2 text-xs text-text-secondary transition-colors hover:border-warning/60 hover:bg-surface-elevated"
          >
            <div className="flex items-center gap-2 font-medium text-warning">
              <BadgeCheck className="size-3.5" />
              Mentor application {mentorStatus}
            </div>
            <p className="mt-1 leading-5">
              View verification status &rarr;
            </p>
          </Link>
        ) : null}

        {companies.length > 0 ? (
          <div className="my-1 h-px bg-border" />
        ) : null}
        {companies.map((company) => {
          const root = `/company/${company.slug}`;
          const discovery = `${root}/mentors`;
          return (
            <div key={company.workspaceId} className="space-y-1">
              <WorkspaceOption href={root} onClick={closeSwitcher}
                active={activeWorkspaceId === company.workspaceId && pathname !== discovery}
                icon={<Building2 className="size-4" />} title="Company Workspace" subtitle={company.name} />
              <WorkspaceOption href={discovery} onClick={closeSwitcher}
                active={pathname === discovery} icon={<GraduationCap className="size-4" />}
                title="Mentor Discovery" subtitle={company.name} />
            </div>
          );
        })}
      </div>
    </details>
  );
}

function WorkspaceIcon({
  workspaceId,
  workspaces,
}: {
  workspaceId: string;
  workspaces: WorkspaceMembership[];
}) {
  const workspace = workspaces.find((item) => item.workspaceId === workspaceId);
  if (workspace?.workspaceType === "mentor") {
    return <GraduationCap className="size-4 shrink-0 text-verification" />;
  }
  if (workspace?.workspaceType === "company") {
    return <Building2 className="size-4 shrink-0 text-accent-cyan" />;
  }
  return <UserRound className="size-4 shrink-0 text-verification" />;
}

function WorkspaceOption({
  href,
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-md px-3 py-2 ${
        active
          ? "border border-verification/30 bg-verification-soft"
          : "border border-transparent hover:bg-surface-elevated"
      }`}
    >
      <span className={active ? "text-verification" : "text-text-secondary"}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block wrap-anywhere text-sm font-medium">{title}</span>
        <span className="block text-xs text-text-muted">{subtitle}</span>
      </span>
    </Link>
  );
}
