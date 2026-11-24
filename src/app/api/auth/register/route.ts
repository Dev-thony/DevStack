import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  completeRegistration, RegistrationError,
} from "@/lib/auth/registration";
import { getWorkspaceDestination } from "@/lib/auth/workspaces";
import { RegistrationSchema } from "@/lib/auth/registration-policy";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsed = RegistrationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success || (parsed.data.registrationType !== "developer" && !parsed.data.application)) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_REGISTRATION", message: "Registration details are invalid." } },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult.user) {
      return NextResponse.json(
        { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in before completing registration." } },
        { status: 401 },
      );
    }

    await completeRegistration(supabase, userResult.user.id, parsed.data);
    const destination = await getWorkspaceDestination(supabase, userResult.user.id, parsed.data.registrationType);
    return NextResponse.json({ ok: true, data: { registrationType: parsed.data.registrationType, destination } });
  } catch (error) {
    if (error instanceof RegistrationError) {
      const response = {
        "23505": [409, "An application is already submitted or the username is unavailable."],
        "42501": [403, "This application cannot be changed. Contact an administrator."],
        "22023": [400, "Professional application details are invalid."],
        "P0001": [429, "Wait a minute before resubmitting your application."],
      }[error.code] as [number, string] | undefined;
      if (response) return NextResponse.json({ ok: false, error: { message: response[1] } }, { status: response[0] });
    }
    return NextResponse.json(
      { ok: false, error: { code: "REGISTRATION_FAILED", message: "Registration could not be completed." } },
      { status: 503 },
    );
  }
}
