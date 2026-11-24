import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { resolveCompanyWorkspace, WorkspaceAuthorizationError } from "@/lib/auth/workspaces";

function publicLink(value: string | null, hosts: string[], pattern: RegExp): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password
      && hosts.includes(url.hostname) && pattern.test(url.pathname)) return url.href;
  } catch {
    return;
  }
}

export default async function MentorDiscoveryPage({ params, searchParams }: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ q?: string; expertise?: string }>;
}) {
  const [{ workspaceSlug }, filters] = await Promise.all([params, searchParams]);
  const q = typeof filters.q === "string" ? filters.q.trim().slice(0, 100) : "";
  const expertise = typeof filters.expertise === "string" ? filters.expertise.trim().slice(0, 100) : "";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const company = await resolveCompanyWorkspace(supabase, user.id, workspaceSlug).catch((error: unknown) => {
    if (error instanceof WorkspaceAuthorizationError) return null;
    throw error;
  });
  if (company?.workspaceType !== "company") return null;

  const { data: mentors, error } = await supabase.rpc("discover_public_mentors", {
    p_company_id: company.companyId, p_query: q, p_expertise: expertise,
  });
  if (error) throw new Error("Mentor Discovery could not be loaded.");

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-text-secondary">Mentor Discovery</p>
        <h1 className="text-2xl font-semibold sm:text-3xl">Mentor Directory</h1>
        <p className="mt-2 text-sm text-text-secondary">Browse verified mentors who publish their profiles.</p>
      </header>
      <form className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 basis-44 text-sm">Name or headline
          <Input name="q" defaultValue={q} maxLength={100} className="mt-1" />
        </label>
        <label className="min-w-0 flex-1 basis-44 text-sm">Expertise
          <Input name="expertise" defaultValue={expertise} maxLength={100} className="mt-1" />
        </label>
        <Button type="submit" variant="secondary">Search mentors</Button>
      </form>
      {!mentors.length ? <p className="text-sm text-text-secondary">No public mentors match these filters.</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mentors.map((mentor) => {
          const github = publicLink(mentor.github_url, ["github.com", "www.github.com"], /^\/[\w-]+\/?$/);
          const linkedin = publicLink(mentor.linkedin_url, ["linkedin.com", "www.linkedin.com"], /^\/in\/[\w.%-]+\/?$/);
          return (
            <Card key={mentor.username} className="min-w-0">
              <CardHeader>
                <CardTitle className="wrap-anywhere">{mentor.display_name || mentor.username}</CardTitle>
                <Badge variant="verified" className="w-fit">Verified mentor</Badge>
                {mentor.headline ? <p className="text-sm text-text-secondary">{mentor.headline}</p> : null}
              </CardHeader>
              <CardContent className="space-y-3">
                {mentor.biography ? <p className="whitespace-pre-wrap text-sm text-text-secondary wrap-anywhere">{mentor.biography}</p> : null}
                <ul className="flex flex-wrap gap-1">
                  {mentor.expertise.map((skill, index) => <li key={`${skill}-${index}`}><Badge variant="outline">{skill.trim()}</Badge></li>)}
                </ul>
                <p className="text-sm capitalize text-text-muted">{mentor.availability_status}</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  <Link className="underline" href={`/u/${encodeURIComponent(mentor.username)}`}>Public profile</Link>
                  {github ? <a href={github} target="_blank" rel="noopener noreferrer" className="underline">GitHub</a> : null}
                  {linkedin ? <a href={linkedin} target="_blank" rel="noopener noreferrer" className="underline">LinkedIn</a> : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
