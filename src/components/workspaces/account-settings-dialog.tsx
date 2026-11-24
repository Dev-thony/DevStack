"use client";

import { useState, type FormEvent } from "react";
import { Globe, Github, Linkedin, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type ProfileSocialLinks = {
  githubProfileUrl: string | null;
  linkedinUrl: string | null;
  xUrl: string | null;
  websiteUrl: string | null;
};

type AccountSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileLinks: ProfileSocialLinks;
};

export function AccountSettingsDialog({
  open,
  onOpenChange,
  profileLinks,
}: AccountSettingsDialogProps) {
  const [values, setValues] = useState(profileLinks);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/profile/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubProfileUrl: values.githubProfileUrl ?? "",
          linkedinUrl: values.linkedinUrl ?? "",
          xUrl: values.xUrl ?? "",
          websiteUrl: values.websiteUrl ?? "",
        }),
      });

      let result: unknown = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "object" &&
          result.error !== null &&
          "message" in result.error &&
          typeof result.error.message === "string"
            ? result.error.message
            : "Profile settings could not be saved.";
        throw new Error(message);
      }

      setSuccessMessage("Social links updated.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Profile settings could not be saved. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function updateValue(key: keyof ProfileSocialLinks, value: string) {
    setValues((current) => ({ ...current, [key]: value || null }));
    setSuccessMessage(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="account-settings-description">
        <div className="space-y-1">
          <DialogTitle>Profile settings</DialogTitle>
          <DialogDescription id="account-settings-description">
            Add public profile links to your Skill Passport. Leave a field blank to remove it.
          </DialogDescription>
        </div>
        <form onSubmit={saveSettings} className="space-y-4">
          <label className="block space-y-1.5 text-sm font-medium">
            <span className="flex items-center gap-2"><Github className="size-4 text-text-muted" />GitHub profile</span>
            <Input
              type="url"
              name="githubProfileUrl"
              value={values.githubProfileUrl ?? ""}
              onChange={(event) => updateValue("githubProfileUrl", event.target.value)}
              placeholder="https://github.com/username"
              maxLength={500}
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            <span className="flex items-center gap-2"><Linkedin className="size-4 text-text-muted" />LinkedIn profile</span>
            <Input
              type="url"
              name="linkedinUrl"
              value={values.linkedinUrl ?? ""}
              onChange={(event) => updateValue("linkedinUrl", event.target.value)}
              placeholder="https://www.linkedin.com/in/username"
              maxLength={500}
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            <span className="flex items-center gap-2">X / Twitter profile</span>
            <Input
              type="url"
              name="xUrl"
              value={values.xUrl ?? ""}
              onChange={(event) => updateValue("xUrl", event.target.value)}
              placeholder="https://x.com/username"
              maxLength={500}
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            <span className="flex items-center gap-2"><Globe className="size-4 text-text-muted" />Personal website</span>
            <Input
              type="url"
              name="websiteUrl"
              value={values.websiteUrl ?? ""}
              onChange={(event) => updateValue("websiteUrl", event.target.value)}
              placeholder="https://example.com"
              maxLength={500}
            />
          </label>

          {errorMessage ? <p className="text-sm text-danger" role="alert">{errorMessage}</p> : null}
          {successMessage ? <p className="text-sm text-verification" role="status">{successMessage}</p> : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              <Settings2 className="size-4" />
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
