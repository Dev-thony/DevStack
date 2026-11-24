import { BadgeCheck, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function WorkspaceAccessState({
  title,
  description,
  actionHref = "/app",
  actionLabel = "Return to Developer Workspace",
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <main className="mx-auto grid min-h-[60vh] max-w-2xl place-items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <div className="mb-2 grid size-9 place-items-center rounded-md border bg-verification-soft text-verification">
            <LockKeyhole className="size-4" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
          <Button asChild className="mt-4 w-fit" variant="secondary">
            <Link href={actionHref}>
              <BadgeCheck />
              {actionLabel}
            </Link>
          </Button>
        </CardHeader>
      </Card>
    </main>
  );
}
