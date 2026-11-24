import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { reviewApplication, reviewSchema } from "@/lib/auth/application-review";
import { ApplicationDetails } from "@/components/auth/application-details";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";

async function decide(form: FormData): Promise<void> {
  "use server";
  const parsed = reviewSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/admin/applications?review=invalid");
  const result = await reviewApplication(parsed.data);
  redirect(`/admin/applications?review=${result.status === 200 ? "saved" : "failed"}`);
}

export default async function AdminApplications({ searchParams }: { searchParams: Promise<{ review?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await supabase.rpc("list_professional_applications");
  if (error?.code === "42501") redirect("/app");
  if (error) throw new Error("Applications could not be loaded.");
  const { review } = await searchParams;

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-10">
      <h1 className="text-2xl font-semibold">Professional applications</h1>
      {review ? <p role={review === "saved" ? "status" : "alert"}>{review === "saved" ? "Decision saved." : "Decision could not be saved. Check the fields and current status."}</p> : null}
      {data.length === 0 ? <p>No applications to review.</p> : null}
      {data.map((item) => (
        <Card key={`${item.applicant_id}:${item.kind}`}>
          <CardHeader>
            <CardTitle className="capitalize">{item.kind} · {item.status.replaceAll("_", " ")}</CardTitle>
            <p className="text-sm text-text-secondary">Submitted {new Date(item.submitted_at).toLocaleDateString()}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ApplicationDetails details={item.details} />
            {["pending", "under_review", "approved"].includes(item.status) ? (
              <form action={decide} className="space-y-3">
                <input type="hidden" name="applicant" value={item.applicant_id} />
                <input type="hidden" name="kind" value={item.kind} />
                <label className="block text-sm">Decision
                  <select className="ml-2 rounded-md border bg-surface p-2" name="decision">
                    {item.status === "approved" ? <option value="suspended">Suspend approval</option> : <>
                      <option value="under_review">Under review</option><option value="approved">Approve</option>
                      <option value="rejected">Reject</option><option value="resubmission_required">Request resubmission</option>
                    </>}
                  </select>
                </label>
                <label className="block text-sm">Applicant feedback or rejection reason
                  <textarea name="feedback" rows={2} maxLength={500} className="block w-full rounded-md border bg-background p-2" />
                </label>
                <label className="block text-sm">Internal review notes
                  <textarea name="notes" rows={2} maxLength={3000} className="block w-full rounded-md border bg-background p-2" />
                </label>
                <Button>Save decision</Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </main>
  );
}
