import { z } from "zod";
import { parseGitHubProfileUrl } from "@/lib/github/url";

function parseHttpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

const optionalValue = z.string().trim().max(500).transform((value) => value || null);

export const ProfileSettingsSchema = z.object({
  githubProfileUrl: optionalValue
    .refine((value) => value === null || parseGitHubProfileUrl(value) !== null, {
      message: "Enter a valid https://github.com/username profile URL.",
    })
    .transform((value) => value === null ? null : parseGitHubProfileUrl(value)),
  linkedinUrl: optionalValue.refine((value) => {
    if (value === null) return true;
    const url = parseHttpsUrl(value);
    const segments = url?.pathname.split("/").filter(Boolean);
    return Boolean(
      url &&
        ["linkedin.com", "www.linkedin.com"].includes(url.hostname) &&
        !url.port &&
        !url.search &&
        !url.hash &&
        segments?.length === 2 &&
        segments[0] === "in" &&
        /^[A-Za-z0-9._%-]+$/.test(segments[1]),
    );
  }, { message: "Enter a LinkedIn profile URL, such as https://www.linkedin.com/in/username." }),
  xUrl: optionalValue.refine((value) => {
    if (value === null) return true;
    const url = parseHttpsUrl(value);
    const segments = url?.pathname.split("/").filter(Boolean);
    return Boolean(
      url &&
        ["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname) &&
        !url.port &&
        !url.search &&
        !url.hash &&
        segments?.length === 1 &&
        /^[A-Za-z0-9_]{1,15}$/.test(segments[0]),
    );
  }, { message: "Enter a valid X or Twitter profile URL." }),
  websiteUrl: optionalValue.refine((value) => {
    if (value === null) return true;
    const url = parseHttpsUrl(value);
    return Boolean(url && !url.port);
  }, { message: "Enter a valid HTTPS website URL." }),
});

export type ProfileSettings = z.output<typeof ProfileSettingsSchema>;
