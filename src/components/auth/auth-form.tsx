"use client";

import { Github, LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthCredentialsSchema } from "@/lib/auth/registration-policy";

export function AuthForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  async function signInWithGithub() {
    setPending(true);
    setError(null);
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setError(error.message);
    } catch {
      setError("Unable to start GitHub sign-in.");
    } finally {
      setPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = AuthCredentialsSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setError("Enter a valid email and a password with at least 8 characters.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { error } = await createClient().auth.signInWithPassword(parsed.data);
      if (error) {
        setError(error.message);
        return;
      }
      const response = await fetch("/api/auth/destination");
      if (!response.ok) {
        setError("Your workspace could not be loaded. Try again.");
        return;
      }
      const { destination } = await response.json();
      router.replace(destination);
      router.refresh();
    } catch {
      setError("Authentication is temporarily unavailable.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>
          Continue to your evidence-first developer passport.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={pending}
          onClick={signInWithGithub}
        >
          {pending ? <LoaderCircle className="animate-spin" /> : <Github />}
          Continue with GitHub
        </Button>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-text-muted">or use email</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <label className="block space-y-2 text-sm font-medium" htmlFor="email">
            Email
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </label>
          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              required
            />
          </div>
            <div className="text-right">
              <button
                type="button"
                disabled={pending}
                onClick={async (event) => {
                  const email = (event.currentTarget.form ? String(new FormData(event.currentTarget.form).get("email") ?? "").trim() : "");
                  if (!email) {
                    setResetNotice("Enter your email address first.");
                    return;
                  }
                  setPending(true);
                  setResetNotice(null);
                  try {
                    const supabase = createClient();
                    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
                    });
                    setResetNotice(
                      resetError
                        ? readableAuthError(resetError.message)
                        : "If an account exists for that email, a password reset link has been sent.",
                    );
                  } catch {
                    setResetNotice("Unable to send the password reset email.");
                  } finally {
                    setPending(false);
                  }
                }}
                className="text-xs font-medium text-text-secondary underline underline-offset-4 hover:text-text-primary disabled:opacity-50"
              >
                Forgot password?
              </button>
            </div>
          {error ? (
            <p role="alert" className="rounded-md border border-danger/40 bg-background px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          {resetNotice ? (
            <p role="status" className="rounded-md border border-border bg-background px-3 py-2 text-sm text-text-secondary">
              {resetNotice}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : null}
            Log in
          </Button>
        </form>

        <p className="text-center text-sm text-text-secondary">
          New to DevStack? 
          <a className="text-text-primary underline underline-offset-4" href="/signup">
            Create account
          </a>
        </p>
      </CardContent>
    </Card>
  );
}

function readableAuthError(message: string): string {
  return message || "Authentication failed.";
}
