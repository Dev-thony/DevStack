import { BadgeCheck, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { applicationValues } from "@/components/auth/application-details";
import { createClient } from "@/lib/supabase/server";

export default async function MentorProfilePage() {
  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) return null;

  const { data: mentor } = await supabase
    .from("mentor_profiles")
    .select("expertise,biography,availability_status,verification_status")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: application } = await supabase.from("professional_applications").select("details")
    .eq("applicant_id", user.id).eq("kind", "mentor").maybeSingle();
  const evidence = applicationValues(application?.details ?? null);
  const expertise = typeof evidence.expertise === "string" ? evidence.expertise : mentor?.expertise.join(", ");
  const biography = typeof evidence.biography === "string" ? evidence.biography : mentor?.biography;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-text-secondary">Mentor workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Mentor Profile</h1>
      </header>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="size-5" />
                Mentor profile
              </CardTitle>
              <CardDescription>Your professional profile and submitted background.</CardDescription>
            </div>
            {mentor?.verification_status === "approved" ? (
              <Badge variant="verified">
                <BadgeCheck className="size-3.5" />
                Verified
              </Badge>
            ) : <Badge variant="outline">Unverified</Badge>}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-text-muted">Expertise</p>
            <p className="mt-1 text-sm">
              {expertise || "No expertise configured"}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Availability</p>
            <p className="mt-1 text-sm">{mentor?.availability_status ?? "Unavailable"}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-text-muted">Biography</p>
            <p className="mt-1 text-sm text-text-secondary">
              {biography ?? "No mentor biography configured"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
