import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { RegistrationInput } from "./registration-policy";

export class RegistrationError extends Error {
  constructor(public readonly code: string) {
    super("Registration could not be completed.");
  }
}

export async function completeRegistration(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: RegistrationInput,
): Promise<void> {
  const { data: userResult } = await supabase.auth.getUser();
  if (userResult.user?.id !== userId) {
    throw new Error("Authenticated identity mismatch.");
  }

  const { error } = await supabase.rpc("complete_registration", {
    p_application: "application" in input ? input.application ?? null : null,
    p_registration_type: input.registrationType,
    p_username: input.username,
    p_display_name: input.displayName ?? null,
    p_company_name:
      input.registrationType === "company" ? input.companyName : null,
    p_company_slug:
      input.registrationType === "company" ? input.companySlug : null,
  });

  if (error) {
    throw new RegistrationError(error.code);
  }
}
