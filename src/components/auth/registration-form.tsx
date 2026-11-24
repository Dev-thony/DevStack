"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, createPasswordSignupClient } from "@/lib/supabase/client";
import { AuthCredentialsSchema, normalizeWorkspaceSlug, RegistrationSchema, type RegistrationType } from "@/lib/auth/registration-policy";
import { companyApplicationSchema, mentorApplicationSchema } from "@/lib/auth/professional-application";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { ProfessionalFields } from "./professional-fields";

export function RegistrationForm({ kind }: { kind: RegistrationType }) {
  const router = useRouter();
  const [account, setAccount] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [professional, setProfessional] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [createdEmail, setCreatedEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [resume, setResume] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    const fields = Object.fromEntries(Array.from(new FormData(event.currentTarget), ([key, value]) => [key, String(value)]));
    const identity = professional ? account : fields;
    const parsed = AuthCredentialsSchema.safeParse(identity);
    if (!parsed.success || identity.password !== identity.confirmPassword) {
      setError("Enter a valid email and matching passwords of 8–72 characters.");
      return;
    }
    if (!identity.displayName.trim() || (kind === "company" && identity.position.trim().length < 2)) {
      setError("Enter a full name and, for Company accounts, a representative position.");
      return;
    }
    if (!professional && kind !== "developer") {
      setAccount(fields);
      setProfessional(true);
      return;
    }
    if (professional) {
      setEvidence(fields);
      const application = kind === "mentor" ? mentorApplicationSchema.safeParse(fields)
        : companyApplicationSchema.safeParse({ ...fields, position: identity.position });
      if (!application.success) {
        setFieldErrors(Object.fromEntries(application.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
        setError("Check the highlighted professional fields.");
        return;
      }
    }

    const registration = RegistrationSchema.safeParse({
      registrationType: kind,
      username: identity.username || `rep-${crypto.randomUUID().slice(0, 16)}`,
      displayName: identity.displayName,
      companyName: fields.companyName,
      companySlug: normalizeWorkspaceSlug(fields.companyName ?? ""),
      application: professional ? { ...fields, position: identity.position } : undefined,
    });
    if (!registration.success) {
      setError("Check the account name, username, and company name.");
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      if (createdEmail !== parsed.data.email) {
        const { data, error: signupError } = resume
          ? await supabase.auth.signInWithPassword(parsed.data)
          : await createPasswordSignupClient().auth.signUp({
            ...parsed.data,
            options: { data: { username: registration.data.username, full_name: registration.data.displayName } },
          });
        if (signupError) {
          if (!resume && ["user_already_exists", "email_exists"].includes(signupError.code ?? "")) {
            setResume(true);
            setError("This account already exists. Sign in to resume setup, or recover your password from login.");
          } else setError(signupError.message);
          return;
        }
        if (!data.session) {
          setError(data.user?.identities?.length === 0
            ? "An account may already exist. Try logging in or recovering your password."
            : "Immediate signup is unavailable in this environment. Contact the project owner.");
          return;
        }
        if (!resume) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
          if (sessionError) {
            setResume(true);
            setError("Your account was created. Sign in to finish setting it up.");
            return;
          }
        }
        setCreatedEmail(parsed.data.email);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email?.toLowerCase() !== parsed.data.email.toLowerCase()) {
          setCreatedEmail("");
          setResume(true);
          setError("Your session changed. Sign in to resume setup.");
          return;
        }
      }
      const response = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(registration.data),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error?.message ?? "Account setup failed. Try again.");
        return;
      }
      setSuccess(true);
      router.replace(result.data.destination);
      router.refresh();
    } catch {
      setError("Registration is temporarily unavailable. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        {kind !== "developer" ? <p className="text-sm text-text-secondary">Step {professional ? "2 of 2 · Professional information" : "1 of 2 · Account information"}</p> : null}
      </CardHeader>
      <CardContent>
        <form key={professional ? "professional" : "account"} className="space-y-4" onSubmit={submit}>
          {professional && kind !== "developer" ? (
            <>
              {kind === "company" ? <label className="block space-y-1 text-sm">Official company name<Input name="companyName" required maxLength={150} defaultValue={evidence.companyName} /></label> : null}
              <ProfessionalFields kind={kind} values={evidence} errors={fieldErrors} />
            </>
          ) : (
            <>
              <label className="block space-y-1 text-sm">Full name<Input id="displayName" name="displayName" autoComplete="name" required maxLength={100} defaultValue={account.displayName} /></label>
              {kind === "company" ? <label className="block space-y-1 text-sm">Representative position<Input name="position" required maxLength={150} defaultValue={account.position} /></label>
                : <label className="block space-y-1 text-sm">Username<Input id="username" name="username" autoComplete="username" required pattern={String.raw`[A-Za-z0-9][A-Za-z0-9_\-]{2,23}`} defaultValue={account.username} /></label>}
              <label className="block space-y-1 text-sm">Email<Input id="email" name="email" type="email" autoComplete="email" required defaultValue={account.email} /></label>
              {(["password", "confirmPassword"] as const).map((name) => (
                <div key={name} className="space-y-1">
                  <label htmlFor={name} className="text-sm">{name === "password" ? "Password" : "Confirm password"}</label>
                  <PasswordInput id={name} name={name} required minLength={8} maxLength={72} autoComplete="new-password" defaultValue={account[name]} />
                </div>
              ))}
            </>
          )}
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          {success ? <p role="status" className="text-sm text-verification">Registration complete. Opening your workspace.</p> : null}
          <div className="flex flex-wrap gap-2">
            {professional ? <Button type="button" variant="outline" disabled={pending || success || Boolean(createdEmail)} onClick={() => { setError(""); setProfessional(false); }}>Back</Button> : null}
            <Button type="submit" disabled={pending || success}>{pending ? "Creating account…" : professional || kind === "developer" ? resume ? "Sign in and resume setup" : "Create account" : "Continue"}</Button>
          </div>
        </form>
        <p className="mt-4 text-sm text-text-secondary">Already registered? <Link href="/login" className="underline">Log in</Link></p>
      </CardContent>
    </Card>
  );
}
