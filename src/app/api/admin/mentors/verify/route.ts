import { NextRequest, NextResponse } from "next/server";
import { reviewApplication, reviewSchema } from "@/lib/auth/application-review";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = reviewSchema.safeParse({
    applicant: body?.mentorUserId, kind: "mentor", decision: body?.decision,
    feedback: body?.reason, notes: body?.notes,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: { message: "Review details are invalid." } }, { status: 400 });
  }

  const result = await reviewApplication(parsed.data);
  return NextResponse.json(result.status === 200
    ? { ok: true } : { ok: false, error: { message: result.message } }, { status: result.status });
}
