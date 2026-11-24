import { getWorkspaceDestination } from "@/lib/auth/workspaces";
import { ApplicationStatus } from "@/components/auth/application-status";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Clock,
  BadgeCheck,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Home,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mentor Application Status",
};

export const dynamic = "force-dynamic";

export default async function MentorPendingPage() {
  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    redirect("/login");
  }

  const [profileResult, mentorResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("username,display_name,role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("mentor_profiles")
      .select("expertise,biography,availability_status,verification_status,created_at,verified_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const { data: application, error: applicationError } = await supabase.from("professional_applications").select("*")
    .eq("applicant_id", user.id).eq("kind", "mentor").maybeSingle();
  if (applicationError) throw new Error("Application could not be loaded.");
  const destination = await getWorkspaceDestination(supabase, user.id, "mentor");
  const canOpenMentor = destination === "/mentor";
  if (application) {
    return <ApplicationStatus application={application} username={profileResult.data?.username ?? "applicant"}
      workspaceHref={canOpenMentor ? "/mentor" : undefined} />;
  }
  const homeHref = destination === "/mentor/pending" ? "/" : destination;
  const profile = profileResult.data;
  const mentor = mentorResult.data;
  const status = mentor?.verification_status ?? "not_applied";

  return (
    <div className="min-h-screen bg-background px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/" className="text-sm font-semibold text-text-secondary hover:text-text-primary">
            ← DevStack
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href={homeHref}>
                <Home className="mr-1.5 size-4" />
                Workspace home
              </Link>
            </Button>
          </div>
        </header>

        {status === "approved" ? (
          <Card className="border-verification/40 bg-surface">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="verified">
                  <BadgeCheck className="size-3.5" />
                  Application Approved
                </Badge>
                {mentor?.verified_at ? (
                  <span className="text-xs text-text-muted">
                    Verified {new Date(mentor.verified_at).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
              <CardTitle className="mt-3 text-2xl">Mentor application approved</CardTitle>
              <CardDescription>
                {canOpenMentor
                  ? "Your approved Mentor membership gives you access to review features."
                  : "Your application was approved. You need an active Mentor membership to use Mentor features."}
              </CardDescription>
            </CardHeader>
            {canOpenMentor ? <CardContent className="space-y-4">
              <Button asChild className="w-full sm:w-auto">
                <Link href="/mentor">
                  Open Mentor Workspace
                  <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
            </CardContent> : null}
          </Card>
        ) : status === "rejected" ? (
          <Card className="border-danger/40 bg-surface">
            <CardHeader>
              <Badge variant="outline" className="w-fit border-danger/40 text-danger">
                <AlertCircle className="size-3.5" />
                Application Not Approved
              </Badge>
              <CardTitle className="mt-3 text-2xl">Application Status: Rejected</CardTitle>
              <CardDescription>
                Thank you for your interest in mentoring on DevStack. After reviewing your credentials against our current curriculum guidelines, your application was not approved at this time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-text-secondary">
                You can still use any workspace where you have active membership.
              </p>
              <Button asChild variant="secondary">
                <Link href={homeHref}>Return to workspace</Link>
              </Button>
            </CardContent>
          </Card>
        ) : status === "suspended" ? (
          <Card className="border-warning/40 bg-surface">
            <CardHeader>
              <Badge variant="outline" className="w-fit border-warning/40 text-warning">
                <AlertCircle className="size-3.5" />
                Privileges Suspended
              </Badge>
              <CardTitle className="mt-3 text-2xl">Mentor Access Suspended</CardTitle>
              <CardDescription>
                Your mentor workspace access is currently suspended. Privileged actions such as reviews and grading remain restricted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary">
                <Link href={homeHref}>Return to workspace</Link>
              </Button>
            </CardContent>
          </Card>
        ) : status === "pending" ? (
          <Card className="border-border bg-surface">
            <CardHeader className="border-b pb-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline" className="border-warning/40 text-warning">
                  <Clock className="size-3.5" />
                  Under Review
                </Badge>
                {mentor?.created_at ? (
                  <span className="text-xs text-text-muted">
                    Submitted {new Date(mentor.created_at).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
              <CardTitle className="mt-3 text-2xl">Mentor Application Pending</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                Thank you for applying to be a verified mentor on DevStack. To maintain high-fidelity peer and mentor evaluations, all mentor applications undergo server-authorized administrator verification.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              <div className="rounded-lg border bg-surface-elevated p-4">
                <h2 className="text-sm font-medium text-text-primary">What happens next?</h2>
                <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-verification" />
                    <span>A platform administrator verifies your linked engineering and domain expertise.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-verification" />
                    <span>Once approved, privileged reviews and voting access can unlock.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-verification" />
                    <span>You will be able to review challenge submissions and help evaluate practical evidence.</span>
                  </li>
                </ul>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-text-muted">Applicant username</p>
                  <p className="mt-1 font-mono text-sm font-medium wrap-anywhere">{profile?.username ?? user.email}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-text-muted">Verification workflow</p>
                  <p className="mt-1 text-sm font-medium flex items-center gap-1.5 text-accent-cyan">
                    <ShieldCheck className="size-4" />
                    Administrator controlled
                  </p>
                </div>
                {mentor?.expertise && mentor.expertise.length > 0 ? (
                  <div className="rounded-lg border p-3 sm:col-span-2">
                    <p className="text-xs text-text-muted">Declared domains</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {mentor.expertise.map((domain) => (
                        <Badge key={domain} variant="outline" className="text-xs">
                          {domain}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <Button asChild variant="outline" size="sm">
                  <Link href="/mentor/pending">
                    <RefreshCw className="size-3.5" />
                    Check status
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="sm">
                  <Link href={homeHref}>
                    Return to workspace
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-surface">
            <CardHeader>
              <CardTitle>No Mentor Application Found</CardTitle>
              <CardDescription>
                To join as a mentor, apply through the Mentor registration flow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary">
                <Link href={homeHref}>Return to workspace</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
