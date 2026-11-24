import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ChallengeDetail } from "@/components/challenges/challenge-detail";
import { createClient } from "@/lib/supabase/server";

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const metadata: Metadata = { title: "Challenge" };

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const parsed = slugSchema.safeParse((await params).slug);
  if (!parsed.success) notFound();

  const supabase = await createClient();
  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select(
      "id,slug,title,description,short_description,instructions,problem_statement,scenario,learning_objectives,requirements,acceptance_criteria,submission_requirements,technologies,tags,skill_domain,difficulty,xp_reward,estimated_hours,estimated_minutes,rubric",
    )
    .eq("slug", parsed.data)
    .eq("is_published", true)
    .maybeSingle();

  if (challengeError) {
    throw new Error("Challenge details could not be loaded.");
  }
  if (!challenge) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const [progressResult, submissionsResult] = await Promise.all([
    supabase
      .from("challenge_progress")
      .select("id,status,verified_score,awarded_xp,started_at,verified_at,updated_at")
      .eq("user_id", user.id)
      .eq("challenge_id", challenge.id)
      .maybeSingle(),
    supabase
      .from("submissions")
      .select("id,repo_url,repo_full_name,status,repo_evidence_score,submitted_at,last_synced_at")
      .eq("user_id", user.id)
      .eq("challenge_id", challenge.id)
      .order("submitted_at", { ascending: false }),
  ]);

  if (progressResult.error || submissionsResult.error) {
    throw new Error("Challenge progress could not be loaded.");
  }

  return (
    <ChallengeDetail
      challenge={challenge}
      initialProgress={progressResult.data}
      initialSubmissions={submissionsResult.data ?? []}
    />
  );
}
