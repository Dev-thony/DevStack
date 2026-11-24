import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getWorkspaceDestination, requireMentorApproval, WorkspaceAuthorizationError } from "@/lib/auth/workspaces";
import { CheckSquare } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function MentorVotesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  try {
    await requireMentorApproval(supabase, user.id);
  } catch (error) {
    if (!(error instanceof WorkspaceAuthorizationError)) throw error;
    const destination = await getWorkspaceDestination(supabase, user.id);
    redirect(destination);
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-text-secondary">Mentor workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Votes</h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="size-5" />
            Voting arrives in Phase 4
          </CardTitle>
          <CardDescription>
            This workspace is read-only for now. No vote records or approval counts are fabricated.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
