import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Redirect to login if Supabase is not configured locally.
  }
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
