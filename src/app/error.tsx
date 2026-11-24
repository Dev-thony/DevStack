"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 grid size-9 place-items-center rounded-md border border-danger/30 bg-danger/10 text-danger">
            <AlertTriangle className="size-4" />
          </div>
          <CardTitle>DevStack could not load this page</CardTitle>
          <CardDescription>
            Try again. If the problem continues, return to the landing page.
          </CardDescription>
          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={reset}>Try again</Button>
            <Button type="button" variant="outline" onClick={() => router.push("/")}>
              Return home
            </Button>
          </div>
        </CardHeader>
      </Card>
    </main>
  );
}
