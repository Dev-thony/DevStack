import { BadgeCheck, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { resolveMentorWorkspace, WorkspaceAuthorizationError } from "@/lib/auth/workspaces";

export default async function MentorOverviewPage() {
  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) return null;

  const workspace = await resolveMentorWorkspace(supabase, user.id).catch((error: unknown) => {
    if (error instanceof WorkspaceAuthorizationError) return null;
    throw error;
  });
  if (workspace?.workspaceType !== "mentor") return null;
  const verified = workspace.mentorVerificationStatus === "approved";
  const [mentorResult, reviewsResult] = await Promise.all([
    supabase
      .from("mentor_profiles")
      .select("expertise,biography,availability_status,verification_status")
      .eq("user_id", user.id)
      .maybeSingle(),
    verified ? supabase
      .from("reviews")
      .select("id,submission_id,total_score,decision,created_at")
      .eq("reviewer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(6) : Promise.resolve({ data: [] }),
  ]);

  const mentor = mentorResult.data;
  const recentReviews = reviewsResult.data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-text-secondary">Mentor workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Mentor Overview</h1>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Verification</CardDescription>
            <CardTitle className="flex items-center gap-2">
              {verified ? <Badge variant="verified"><BadgeCheck className="size-3.5" />Verified mentor</Badge>
                : <Badge variant="outline">Unverified</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-muted">
              {mentor?.availability_status ?? "Availability not set"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Expertise</CardDescription>
            <CardTitle>{mentor?.expertise.length ?? 0} domains</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-muted">
              {mentor?.expertise.length
                ? mentor.expertise.join(", ")
                : "No expertise domains configured"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Recent reviews</CardDescription>
            <CardTitle>{verified ? recentReviews.length : "Requires approval"}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-muted">Accessible review activity</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Professional verification</CardTitle>
            <CardDescription>View your application status and any review feedback.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href="/mentor/pending">
                View verification status
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Review activity</CardTitle>
            <CardDescription>Persisted reviews submitted through this account.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentReviews.length === 0 ? (
              <p className="text-sm text-text-secondary">No review activity yet.</p>
            ) : (
              <div className="space-y-2">
                {recentReviews.map((review) => (
                  <div key={review.id} className="flex items-center justify-between rounded-lg border px-3 py-3">
                    <span className="flex items-center gap-2 text-sm">
                      <MessageSquareText className="size-4 text-text-muted" />
                      {review.decision === "approved" ? "Approved" : "Revision requested"}
                    </span>
                    <span className="font-mono text-xs text-text-muted">
                      {review.total_score.toFixed(0)} / 100
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
