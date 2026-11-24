import Link from "next/link";
import type { ProfessionalApplication } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApplicationDetails, applicationValues } from "./application-details";
import { ResubmitApplication } from "./resubmit-application";

export function ApplicationStatus({ application, username, workspaceHref }: {
  application: ProfessionalApplication; username: string; workspaceHref?: string;
}) {
  const label = application.kind === "mentor" ? "Mentor" : "Company";
  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-10">
      <Link href="/" className="text-sm underline">DevStack home</Link>
      <Card>
        <CardHeader>
          <CardTitle>{application.status === "pending" ? `${label} Application Pending` : `${label} application status`}</CardTitle>
          <Badge className="w-fit capitalize" variant={application.status === "approved" ? "verified" : "outline"}>{application.status.replaceAll("_", " ")}</Badge>
          <p className="text-sm text-text-secondary">Submitted {new Date(application.submitted_at).toLocaleDateString()}</p>
          {application.status === "pending" ? <p>Your {label} application has been submitted. Our team will review the professional information you provided.</p> : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <ApplicationDetails details={application.details} />
          {application.feedback ? <p className="whitespace-pre-wrap wrap-anywhere rounded-md border p-3">{application.feedback}</p> : null}
          {workspaceHref ? <Link href={workspaceHref} className="text-accent-cyan underline">Open {label} Workspace</Link> : null}
          {["draft", "rejected", "resubmission_required"].includes(application.status) ? (
            <ResubmitApplication kind={application.kind} username={username} values={applicationValues(application.details)} />
          ) : null}
          <form method="post" action="/auth/signout"><button className="text-sm underline">Sign out</button></form>
        </CardContent>
      </Card>
    </main>
  );
}
