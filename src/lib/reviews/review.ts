import { z } from "zod";

export const ReviewSchema = z.object({
  submissionId: z.uuid(),
  functionality: z.number().int().min(0).max(30),
  codeQuality: z.number().int().min(0).max(25),
  userExperience: z.number().int().min(0).max(20),
  documentation: z.number().int().min(0).max(15),
  originality: z.number().int().min(0).max(10),
  feedback: z.string().trim().min(10).max(5000),
  decision: z.enum(["approved", "revision_requested"]),
  isPublic: z.boolean().default(true),
});

export type ValidReviewInput = z.infer<typeof ReviewSchema>;

export function calculateReviewTotal(input: ValidReviewInput): number {
  return (
    input.functionality +
    input.codeQuality +
    input.userExperience +
    input.documentation +
    input.originality
  );
}
