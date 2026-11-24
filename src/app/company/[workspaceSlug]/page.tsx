import { Search, FolderGit2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { resolveCompanyWorkspace, WorkspaceAuthorizationError } from "@/lib/auth/workspaces";

type CompanyOverviewProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function CompanyOverviewPage({ params }: CompanyOverviewProps) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) return null;

  const company = await resolveCompanyWorkspace(supabase, user.id, workspaceSlug).catch((error: unknown) => {
    if (error instanceof WorkspaceAuthorizationError) return null;
    throw error;
  });
  if (company?.workspaceType !== "company") return null;
  const [profilesResult, submissionsResult, membershipResult] = await Promise.all([
    supabase.from("public_profiles").select("id").limit(20),
    supabase.from("public_submissions").select("id").limit(20),
    supabase
      .from("company_memberships")
      .select("membership_role,membership_status")
      .eq("company_id", company.companyId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-text-secondary">Company workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{company.name}</h1>
        <Link href="/company/application-status" className="mt-2 inline-block text-sm underline">Company profile and verification</Link>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Verification</CardDescription>
            <CardTitle>
              <Badge variant={company.verificationStatus === "approved" ? "verified" : "outline"}>
                {company.verificationStatus === "approved" ? "Verified company" : "Unverified"}
              </Badge>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Membership role</CardDescription>
            <CardTitle className="capitalize">{membershipResult.data?.membership_role ?? company.membershipRole}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Public developer records</CardDescription>
            <CardTitle>{profilesResult.data?.length ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Passport search</CardTitle>
            <CardDescription>Open an existing public DevStack passport by username.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href={`/company/${workspaceSlug}/passport`}>
                <Search />
                Search passports
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Public projects</CardTitle>
            <CardDescription>
              {submissionsResult.data?.length
                ? `${submissionsResult.data.length} public approved or verified submissions available`
                : "No public approved projects are available"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href={`/company/${workspaceSlug}/projects`}>
                <FolderGit2 />
                View projects
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
