"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2,
  BadgeCheck,
  CheckSquare,
  FileCheck2,
  FolderGit2,
  GraduationCap,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Search,
  Settings,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { WorkspaceSwitcher } from "./workspace-switcher";
import type { WorkspaceMembership } from "@/types/workspaces";
import { AccountSettingsDialog, type ProfileSocialLinks } from "./account-settings-dialog";
import { useDismissableDetails } from "./use-dismissable-details";
import type {
  WorkspaceNavigationIcon,
  WorkspaceNavigationItem,
} from "@/types/workspaces";

const navigationIconRegistry = {
  dashboard: LayoutDashboard,
  passport: BadgeCheck,
  proofs: FileCheck2,
  projects: FolderGit2,
  mentors: MessageSquareText,
  "mentor-directory": GraduationCap,
  votes: CheckSquare,
  reviews: MessageSquareText,
  "passport-search": Search,
} satisfies Record<WorkspaceNavigationIcon, LucideIcon>;

type WorkspaceShellProps = {
  children: ReactNode;
  activeWorkspaceId: string;
  activeWorkspaceName: string;
  activeWorkspaceType: "personal" | "mentor" | "company";
  workspaceOptions: WorkspaceMembership[];
  mentorStatus?: "pending" | "approved" | "rejected" | "suspended";
  navigation: WorkspaceNavigationItem[];
  profileLabel: string;
  profileSocialLinks: ProfileSocialLinks;
};

export function WorkspaceShell({
  children,
  activeWorkspaceId,
  activeWorkspaceName,
  activeWorkspaceType,
  workspaceOptions,
  mentorStatus,
  navigation,
  profileLabel,
  profileSocialLinks,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 64rem)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh min-w-0 self-start border-r bg-surface px-4 py-5 lg:flex lg:flex-col">
        <Link href="/" aria-label="DevStack home">
          <BrandLogo markClassName="size-8" />
        </Link>
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
          <WorkspaceSwitcher
            workspaces={workspaceOptions}
            activeWorkspaceId={activeWorkspaceId}
            mentorStatus={mentorStatus}
          />
          <nav aria-label="Workspace" className="mt-5 space-y-1">
            {navigation.map((item) => (
              <NavigationLink
                key={item.href}
                item={item}
                active={pathname === item.href || (item.icon === "proofs" && pathname.startsWith(`${item.href}/`))}
              />
            ))}
          </nav>
        </div>
        <div className="shrink-0 space-y-3 border-t pt-4">
          <AccountMenu
            profileLabel={profileLabel}
            profileSocialLinks={profileSocialLinks}
          />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-2 border-b bg-background px-3 sm:px-6">
          <div className="min-w-0 shrink-0 lg:hidden">
            <Link href="/" aria-label="DevStack home">
              <BrandLogo markClassName="size-6" wordmarkClassName="text-xs" />
            </Link>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <span className="hidden min-w-0 items-center gap-2 text-xs text-text-muted sm:flex" title={activeWorkspaceName}>
              {activeWorkspaceType === "company" ? (
                <Building2 className="size-3.5 shrink-0" />
              ) : activeWorkspaceType === "mentor" ? (
                <GraduationCap className="size-3.5 shrink-0" />
              ) : (
                <UserRound className="size-3.5 shrink-0" />
              )}
              <span className="truncate">{activeWorkspaceName}</span>
            </span>
            <div className="lg:hidden">
              <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Open workspace navigation">
                    <Menu />
                  </Button>
                </DialogTrigger>
                <DialogContent className="flex h-dvh max-h-dvh w-72 max-w-[calc(100%-3rem)] flex-col gap-0 overflow-auto overscroll-contain rounded-none border-y-0 border-l-0 p-4 lg:hidden" placement="drawer">
                  <DialogTitle className="sr-only">Workspace navigation</DialogTitle>
                  <DialogDescription className="sr-only">Choose a workspace or navigate within it.</DialogDescription>
                  <Link href="/" aria-label="DevStack home" className="mt-1" onClick={() => setMobileOpen(false)}>
                    <BrandLogo markClassName="size-7" />
                  </Link>
                  <div className="mt-5">
                    <WorkspaceSwitcher
                      workspaces={workspaceOptions}
                      activeWorkspaceId={activeWorkspaceId}
                      mentorStatus={mentorStatus}
                      onNavigate={() => setMobileOpen(false)}
                    />
                  </div>
                  <nav aria-label="Mobile workspace" className="mt-6 space-y-1">
                    {navigation.map((item) => (
                      <NavigationLink
                        key={item.href}
                        item={item}
                        active={pathname === item.href || (item.icon === "proofs" && pathname.startsWith(`${item.href}/`))}
                        onClick={() => setMobileOpen(false)}
                      />
                    ))}
                  </nav>
                  <div className="mt-auto pt-4">
                    <AccountMenu
                      profileLabel={profileLabel}
                      profileSocialLinks={profileSocialLinks}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-6 wrap-anywhere sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavigationLink({
  item,
  active,
  onClick,
}: {
  item: WorkspaceNavigationItem;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = navigationIconRegistry[item.icon];
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors ${
        active
          ? "bg-verification-soft font-medium text-text-primary"
          : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
      }`}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function AccountMenu({
  profileLabel,
  profileSocialLinks,
}: {
  profileLabel: string;
  profileSocialLinks: ProfileSocialLinks;
}) {
  const detailsRef = useDismissableDetails();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <details ref={detailsRef} className="relative">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border bg-surface px-2 py-2 text-sm hover:border-text-muted">
          <span className="grid size-7 shrink-0 place-items-center rounded-full border bg-surface-elevated text-xs font-semibold">
            {profileLabel.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate">{profileLabel}</span>
        </summary>
        <div className="absolute bottom-[calc(100%+8px)] left-0 z-50 w-full rounded-lg border bg-surface p-2 shadow-xl max-lg:static max-lg:mt-2 max-lg:shadow-none">
          <div className="mb-2 border-b pb-2">
            <ThemeToggle className="w-full justify-between" />
          </div>
          <button
            type="button"
            onClick={() => {
              detailsRef.current?.removeAttribute("open");
              setSettingsOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
          >
            <Settings className="size-4" />
            Profile settings
          </button>
          <form action="/auth/signout" method="post" className="mt-1 border-t pt-1">
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-surface-elevated"
            >
              Sign out
            </button>
          </form>
        </div>
      </details>
      <AccountSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        profileLinks={profileSocialLinks}
      />
    </>
  );
}
