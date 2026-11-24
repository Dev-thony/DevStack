import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  q: z.string().trim().max(120).optional().default(""),
  domain: z.enum(["all", "frontend", "backend", "data", "devops", "system_design", "product"]).default("all"),
  difficulty: z.enum(["all", "beginner", "intermediate", "advanced"]).default("all"),
  status: z.enum(["all", "not_started", "in_progress", "submitted", "verified"]).default("all"),
  sort: z.enum(["recommended", "newest", "highest_xp", "shortest_time", "difficulty"]).default("recommended"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(24).default(12),
});

const challengeFields =
  "id,slug,title,description,short_description,instructions,problem_statement,scenario,learning_objectives,requirements,acceptance_criteria,submission_requirements,technologies,tags,skill_domain,difficulty,xp_reward,estimated_hours,estimated_minutes,rubric,created_at";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_QUERY", message: "Challenge filters are invalid." } },
      { status: 400 },
    );
  }

  const filters = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in to browse your challenge progress." } },
      { status: 401 },
    );
  }

  const { data: progress, error: progressError } = await supabase
    .from("challenge_progress")
    .select("challenge_id,status,awarded_xp")
    .eq("user_id", user.id);

  if (progressError) {
    return NextResponse.json(
      { ok: false, error: { code: "PROGRESS_READ_FAILED", message: "Challenge progress could not be loaded." } },
      { status: 500 },
    );
  }

  const { count: availableChallenges, error: challengeCountError } = await supabase
    .from("challenges")
    .select("id", { count: "exact", head: true })
    .eq("is_published", true);
  if (challengeCountError) {
    return NextResponse.json(
      { ok: false, error: { code: "CHALLENGES_READ_FAILED", message: "Challenge totals could not be loaded." } },
      { status: 500 },
    );
  }

  const progressRows = progress ?? [];
  const progressByChallenge = new Map(progressRows.map((row) => [row.challenge_id, row]));
  const completedChallenges = progressRows.filter((row) => row.status === "verified").length;
  const inProgressChallenges = progressRows.filter((row) => row.status === "in_progress").length;
  const submittedChallenges = progressRows.filter((row) =>
    row.status === "submitted" || row.status === "verifying",
  ).length;
  const earnedXp = progressRows.reduce((total, row) => total + row.awarded_xp, 0);

  const matchingProgress = progressRows.filter((row) => {
    if (filters.status === "in_progress") return row.status === "in_progress";
    if (filters.status === "submitted") return row.status === "submitted" || row.status === "verifying";
    if (filters.status === "verified") return row.status === "verified";
    return false;
  });

  let query = supabase
    .from("challenges")
    .select(challengeFields, { count: "exact" })
    .eq("is_published", true);

  if (filters.q) {
    query = query.textSearch("search_document", filters.q, {
      type: "websearch",
      config: "simple",
    });
  }
  if (filters.domain !== "all") query = query.eq("skill_domain", filters.domain);
  if (filters.difficulty !== "all") query = query.eq("difficulty", filters.difficulty);

  if (filters.status === "not_started") {
    const startedIds = progressRows.map((row) => row.challenge_id);
    if (startedIds.length > 0) query = query.not("id", "in", `(${startedIds.join(",")})`);
  } else if (filters.status !== "all") {
    const ids = matchingProgress.map((row) => row.challenge_id);
    if (ids.length === 0) {
      return NextResponse.json({
        ok: true,
        data: [],
        meta: {
          page: filters.page,
          pageSize: filters.pageSize,
          total: 0,
          totalPages: 0,
          stats: {
            totalChallenges: availableChallenges ?? 0,
            completedChallenges,
            inProgressChallenges,
            submittedChallenges,
            earnedXp,
          },
        },
      });
    }
    query = query.in("id", ids);
  }

  if (filters.sort === "newest") {
    query = query.order("created_at", { ascending: false });
  } else if (filters.sort === "highest_xp") {
    query = query.order("xp_reward", { ascending: false }).order("created_at", { ascending: false });
  } else if (filters.sort === "shortest_time") {
    query = query.order("estimated_minutes", { ascending: true, nullsFirst: false });
  } else if (filters.sort === "difficulty") {
    query = query
      .order("difficulty_rank", { ascending: true })
      .order("xp_reward", { ascending: false })
      .order("created_at", { ascending: false });
  } else {
    query = query
      .order("difficulty_rank", { ascending: true })
      .order("xp_reward", { ascending: false })
      .order("created_at", { ascending: false });
  }

  const from = (filters.page - 1) * filters.pageSize;
  const { data, error, count } = await query.range(from, from + filters.pageSize - 1);

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "CHALLENGES_READ_FAILED", message: "Challenges could not be loaded." } },
      { status: 500 },
    );
  }

  const total = count ?? 0;
  return NextResponse.json({
    ok: true,
    data: (data ?? []).map((challenge) => ({
      ...challenge,
      progress: progressByChallenge.get(challenge.id) ?? null,
    })),
    meta: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.ceil(total / filters.pageSize),
      stats: {
        totalChallenges: availableChallenges ?? 0,
        completedChallenges,
        inProgressChallenges,
        submittedChallenges,
        earnedXp,
      },
    },
  });
}
