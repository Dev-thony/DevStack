import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const reviewSchema = z.object({
  applicant: z.uuid(), kind: z.enum(["mentor", "company"]),
  decision: z.enum(["under_review", "approved", "rejected", "resubmission_required", "suspended"]),
  feedback: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(3000).optional(),
}).refine((input) => !["rejected", "resubmission_required"].includes(input.decision) || Boolean(input.feedback), {
  path: ["feedback"], message: "An applicant-facing reason is required.",
});

export async function reviewApplication(input: z.infer<typeof reviewSchema>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 401, message: "Administrator authentication required." };
  if (user.id === input.applicant) return { status: 403, message: "You cannot review your own application." };

  const { error } = await supabase.rpc("review_professional_application", {
    p_applicant: input.applicant, p_kind: input.kind, p_decision: input.decision,
    p_feedback: input.feedback || null, p_notes: input.notes || null,
  });
  if (!error) return { status: 200, message: "Decision saved." };
  if (error.code === "42501") return { status: 403, message: "Administrator access required." };
  if (error.code === "P0002") return { status: 404, message: "Application unavailable." };
  if (error.code === "23505") return { status: 409, message: "The application has changed. Reload the review queue." };
  if (error.code === "22023") return { status: 400, message: "Review details are invalid." };
  return { status: 500, message: "The decision could not be saved." };
}
