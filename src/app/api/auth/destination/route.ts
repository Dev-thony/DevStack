import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceDestination } from "@/lib/auth/workspaces";

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return NextResponse.json({ destination: user ? await getWorkspaceDestination(supabase, user.id) : "/login" });
  } catch {
    return NextResponse.json({ error: "Your workspace could not be loaded. Try again." }, { status: 503 });
  }
}
