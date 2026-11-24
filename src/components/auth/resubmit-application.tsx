"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ProfessionalFields } from "./professional-fields";
import { Button } from "@/components/ui/button";
import { companyApplicationSchema, mentorApplicationSchema } from "@/lib/auth/professional-application";

export function ResubmitApplication({ kind, username, values }: {
  kind: "mentor" | "company"; username: string; values: Record<string, string | number>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrors({});
    const details = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = (kind === "mentor" ? mentorApplicationSchema : companyApplicationSchema).safeParse({ ...details, companyName: values.companyName });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      setMessage("Check the highlighted fields.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationType: kind, username, companyName: values.companyName, companySlug: "application", application: parsed.data }),
      });
      if (response.ok) router.refresh();
      else setMessage((await response.json()).error?.message ?? "Application could not be resubmitted.");
    } catch {
      setMessage("Application could not be resubmitted.");
    } finally {
      setBusy(false);
    }
  }

  return <details className="rounded-lg border p-4">
    <summary className="cursor-pointer font-medium">Correct and resubmit application</summary>
    <form onSubmit={submit} className="mt-4 space-y-3">
      {kind === "company" ? <label className="block text-sm">Representative position
        <input className="block w-full rounded-md border bg-background p-2" name="position" defaultValue={values.position} required maxLength={150} />
        {errors.position ? <span className="text-danger">{errors.position}</span> : null}
      </label> : null}
      <ProfessionalFields kind={kind} values={values} errors={errors} />
      {message ? <p role="alert" className="text-danger">{message}</p> : null}
      <Button disabled={busy}>{busy ? "Submitting…" : "Resubmit application"}</Button>
    </form>
  </details>;
}
