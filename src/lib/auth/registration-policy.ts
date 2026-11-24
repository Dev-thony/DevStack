import { z } from "zod";
import { companyApplicationSchema, mentorApplicationSchema } from "./professional-application";

export type RegistrationType = "developer" | "mentor" | "company";

export function normalizeWorkspaceSlug(value: string): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "")
    .replace(/^-+|-+$/g, "");
  return normalized || "workspace";
}

const workspaceSlugSchema = z
  .string()
  .trim()
  .min(1)
  .transform(normalizeWorkspaceSlug)
  .pipe(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/));

export const AuthCredentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72),
});

export const RegistrationSchema = z.discriminatedUnion("registrationType", [
  z.object({
    registrationType: z.literal("developer"),
    username: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{2,23}$/),
    displayName: z.string().trim().min(1).max(100).optional(),
  }),
  z.object({
    registrationType: z.literal("mentor"),
    application: mentorApplicationSchema.optional(),
    username: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{2,23}$/),
    displayName: z.string().trim().min(1).max(100).optional(),
  }),
  z.object({
    registrationType: z.literal("company"),
    application: companyApplicationSchema.optional(),
    username: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{2,23}$/),
    displayName: z.string().trim().min(1).max(100).optional(),
    companyName: z.string().trim().min(2).max(150),
    companySlug: workspaceSlugSchema,
  }),
]);

export type RegistrationInput = z.infer<typeof RegistrationSchema>;

export function canSelfAssignRegistrationType(
  requestedType: string,
): requestedType is RegistrationType {
  return (
    requestedType === "developer" ||
    requestedType === "mentor" ||
    requestedType === "company"
  );
}

export function isVerifiedMentorState(
  verificationStatus: string,
  membershipStatus: string,
): boolean {
  return verificationStatus === "approved" && membershipStatus === "active";
}
