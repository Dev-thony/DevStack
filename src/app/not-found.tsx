import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 grid size-9 place-items-center rounded-md border bg-surface-elevated text-text-secondary">
            <Compass className="size-4" />
          </div>
          <CardTitle>Page not found</CardTitle>
          <CardDescription>
            The route may have moved or the link may be incomplete.
          </CardDescription>
          <Button asChild className="mt-4 w-fit" variant="secondary">
            <Link href="/">Return home</Link>
          </Button>
        </CardHeader>
      </Card>
    </main>
  );
}
