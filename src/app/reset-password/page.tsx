"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [updated, setUpdated] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = data.get("password");
    if (typeof password !== "string" || password.length < 8 || password.length > 72 || password !== data.get("confirm")) {
      setMessage("Enter matching passwords of 8–72 characters.");
      return;
    }
    setPending(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) setMessage("Password update failed. Request a fresh recovery link from login.");
      else setUpdated(true);
    } catch {
      setMessage("Password update is temporarily unavailable.");
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-12">
      <h1 className="text-2xl font-semibold">Reset password</h1>
      {updated ? <p role="status">Password updated.</p> : (
        <form onSubmit={submit} className="space-y-4">
          <div><label htmlFor="reset-password">New password</label><PasswordInput id="reset-password" name="password" required autoComplete="new-password" /></div>
          <div><label htmlFor="reset-confirm">Confirm password</label><PasswordInput id="reset-confirm" name="confirm" required autoComplete="new-password" /></div>
          {message ? <p role="alert" className="text-danger">{message}</p> : null}
          <Button disabled={pending}>Update password</Button>
        </form>
      )}
      <Link href={updated ? "/app" : "/login"} className="underline">{updated ? "Open DevStack" : "Return to login"}</Link>
    </main>
  );
}
