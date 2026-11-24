import { z } from "zod";

function httpsLink(hosts?: string[]) {
  return z.string().trim().max(500).transform((value, context) => {
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && !url.username && !url.password &&
        (!hosts || (hosts.includes(url.hostname) && url.pathname !== "/"))) {
        return url.href;
      }
    } catch {
      // Return a field validation error below.
    }
    context.addIssue({ code: "custom", message: "Enter a valid HTTPS profile or website URL." });
    return z.NEVER;
  });
}

const linkedin = httpsLink(["linkedin.com", "www.linkedin.com"]);
const github = httpsLink(["github.com", "www.github.com"]);
const short = z.string().trim().min(2).max(150);
const description = z.string().trim().min(20).max(3000);
const optionalLink = (schema = httpsLink()) => z.union([z.literal(""), schema]).optional();

export const mentorApplicationSchema = z.object({
  headline: short, biography: description, expertise: short,
  yearsExperience: z.coerce.number().int().min(0).max(80),
  linkedin, github, portfolio: httpsLink(),
  stackOverflow: optionalLink(httpsLink(["stackoverflow.com"])),
  social: optionalLink(httpsLink(["x.com", "twitter.com", "www.x.com", "www.twitter.com"])),
  otherLink: optionalLink(), mentoring: z.string().trim().max(1000).optional(),
  certifications: z.string().trim().max(1000).optional(),
});

export const companyApplicationSchema = z.object({
  companyName: short, position: short, website: httpsLink(), linkedin, industry: short, size: short,
  description, representativeLinkedin: linkedin, github: optionalLink(github),
  social: optionalLink(httpsLink(["x.com", "twitter.com", "www.x.com", "www.twitter.com"])),
  otherLink: optionalLink(), registrationNumber: z.string().trim().max(150).optional(),
});
