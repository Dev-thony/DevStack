import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) });

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_CHALLENGE", message: "Challenge slug is invalid." } },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in to read challenge progress." } },
      { status: 401 },
    );
  }

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id")
    .eq("slug", params.data.slug)
    .eq("is_published", true)
    .maybeSingle();

  if (challengeError || !challenge) {
    return NextResponse.json(
      { ok: false, error: { code: "CHALLENGE_NOT_FOUND", message: "Challenge was not found." } },
      { status: 404 },
    );
  }

  const { data, error } = await supabase
    .from("challenge_progress")
    .select("id,status,verified_score,awarded_xp,started_at,verified_at,updated_at")
    .eq("user_id", user.id)
    .eq("challenge_id", challenge.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "PROGRESS_READ_FAILED", message: "Challenge progress could not be loaded." } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data });
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_CHALLENGE", message: "Challenge slug is invalid." } },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in to start a challenge." } },
      { status: 401 },
    );
  }

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id")
    .eq("slug", params.data.slug)
    .eq("is_published", true)
    .maybeSingle();

  if (challengeError || !challenge) {
    return NextResponse.json(
      { ok: false, error: { code: "CHALLENGE_NOT_FOUND", message: "Challenge was not found." } },
      { status: 404 },
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("challenge_progress")
    .insert({
      user_id: user.id,
      challenge_id: challenge.id,
      status: "in_progress",
    })
    .select("id,status,verified_score,awarded_xp,started_at,verified_at,updated_at")
    .maybeSingle();

  if (!insertError && inserted) {
    return NextResponse.json({ ok: true, data: inserted }, { status: 201 });
  }

  if (insertError?.code === "23505") {
    const { data: existing, error: existingError } = await supabase
      .from("challenge_progress")
      .select("id,status,verified_score,awarded_xp,started_at,verified_at,updated_at")
      .eq("user_id", user.id)
      .eq("challenge_id", challenge.id)
      .maybeSingle();

    if (!existingError && existing) {
      return NextResponse.json({ ok: true, data: existing });
    }

    return NextResponse.json(
      { ok: false, error: { code: "PROGRESS_READ_FAILED", message: "Existing challenge progress could not be loaded." } },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: false, error: { code: "PROGRESS_START_FAILED", message: "Challenge could not be started." } },
    { status: 500 },
  );
}
