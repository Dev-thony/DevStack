import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mentors & Reviews" };

export default async function DeveloperMentorsPage() {
  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  let isApprovedMentor = false;
  if (user) {
    const { data: mentor } = await supabase
      .from("mentor_profiles")
      .select("verification_status")
      .eq("user_id", user.id)
      .maybeSingle();
    isApprovedMentor = mentor?.verification_status === "approved";
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-text-secondary">Workspace transition</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Mentor &amp; Review Workspace</h1>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-verification">
            <GraduationCap className="size-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Dedicated Workspace</span>
          </div>
          <CardTitle className="mt-2 text-xl">
            Mentoring and Rubric Reviews have moved to the Mentor Workspace
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            In accordance with the DevStack workspace architecture, privileged mentor reviews and voting activities are housed in the dedicated, server-authorized Mentor Workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-text-secondary">
            Your developer workspace remains focused on your practical challenges, GitHub evidence, and personal Live Skill Passport.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild variant="secondary">
              <Link href="/app">
                Return to Developer Overview
                <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
            {isApprovedMentor ? (
              <Button asChild>
                <Link href="/mentor">
                  <ShieldCheck className="mr-1.5 size-4" />
                  Open Mentor Workspace
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/mentor/pending">
                  Check Mentor Application Status
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
