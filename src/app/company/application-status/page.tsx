import { getWorkspaceDestination } from "@/lib/auth/workspaces";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApplicationStatus } from "@/components/auth/application-status";

export default async function CompanyApplicationStatusPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: application, error } = await supabase.from("professional_applications").select("*")
    .eq("applicant_id", user.id).eq("kind", "company").maybeSingle();
  if (error) throw new Error("Application could not be loaded.");
  if (!application) return <main className="px-4 py-10">No company application has been submitted.</main>;
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  const destination = await getWorkspaceDestination(supabase, user.id, "company");
  const workspaceHref = destination.startsWith("/company/") && destination !== "/company/application-status"
    ? destination : undefined;
  return <ApplicationStatus application={application} username={profile?.username ?? "applicant"} workspaceHref={workspaceHref} />;
}
