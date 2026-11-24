import { FolderGit2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function CompanyProjectsPage() {
  const supabase = await createClient();
  const { data: submissions } = await supabase
    .from("public_submissions")
    .select("id,repo_full_name,repo_url,skill_domain,status,repo_evidence_score,last_synced_at")
    .order("last_synced_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-text-secondary">Company workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Public Projects</h1>
      </header>
      {submissions?.length ? (
        <div className="grid gap-4">
          {submissions.map((submission) => (
            <Card key={submission.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderGit2 className="size-4 shrink-0" />
                  <span className="min-w-0 wrap-anywhere">{submission.repo_full_name}</span>
                </CardTitle>
                <CardDescription>
                  {submission.skill_domain.replace("_", " ")} · {submission.status}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <a
                  href={submission.repo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-accent-cyan underline underline-offset-4"
                >
                  View repository
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No public approved projects</CardTitle>
            <CardDescription>
              Public verified or approved submissions will appear here.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
