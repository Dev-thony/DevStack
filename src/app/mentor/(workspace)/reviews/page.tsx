import { redirect } from "next/navigation";
import { getWorkspaceDestination, requireMentorApproval, WorkspaceAuthorizationError } from "@/lib/auth/workspaces";
import { MessageSquareText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function MentorReviewsPage() {
  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) redirect("/login");
  try {
    await requireMentorApproval(supabase, user.id);
  } catch (error) {
    if (!(error instanceof WorkspaceAuthorizationError)) throw error;
    const destination = await getWorkspaceDestination(supabase, user.id);
    redirect(destination);
  }


  const { data: reviews } = await supabase
    .from("reviews")
    .select("id,total_score,feedback,decision,created_at")
    .eq("reviewer_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-text-secondary">Mentor workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Reviews</h1>
      </header>
      {reviews?.length ? (
        <div className="grid gap-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquareText className="size-4" />
                  {review.total_score.toFixed(0)} / 100
                </CardTitle>
                <CardDescription>
                  {review.decision === "approved" ? "Approved" : "Revision requested"} ·{" "}
                  {new Date(review.created_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-text-secondary">{review.feedback}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No reviews submitted</CardTitle>
            <CardDescription>Existing review activity will appear here.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
