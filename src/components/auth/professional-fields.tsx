import { Input } from "@/components/ui/input";

const mentorFields = [
  ["headline", "Professional headline"], ["biography", "Professional biography", "textarea"],
  ["expertise", "Areas of expertise (comma-separated)"], ["yearsExperience", "Years of experience", "number"],
  ["linkedin", "LinkedIn profile URL", "url"], ["github", "GitHub profile URL", "url"],
  ["portfolio", "Portfolio or personal website URL", "url"], ["stackOverflow", "Stack Overflow URL", "url", true],
  ["social", "X or Twitter URL", "url", true], ["otherLink", "Other professional URL", "url", true],
  ["mentoring", "Previous mentoring experience", "textarea", true], ["certifications", "Certifications", "text", true],
] as const;

const companyFields = [
  ["website", "Company website", "url"], ["linkedin", "Company LinkedIn page", "url"],
  ["industry", "Industry"], ["size", "Company size"], ["description", "Business description", "textarea"],
  ["representativeLinkedin", "Representative LinkedIn profile URL", "url"], ["github", "GitHub organization URL", "url", true],
  ["social", "Company X or Twitter URL", "url", true], ["otherLink", "Other business profile URL", "url", true],
  ["registrationNumber", "Company registration number", "text", true],
] as const;

export function ProfessionalFields({ kind, values = {}, errors = {} }: {
  kind: "mentor" | "company";
  values?: Record<string, string | number>;
  errors?: Record<string, string>;
}) {
  return (
    <>
      <p className="text-sm text-text-secondary">Use HTTPS links, such as https://www.linkedin.com/in/your-name. A reviewer will assess the information you submit.</p>
      {(kind === "mentor" ? mentorFields : companyFields).map(([name, label, type = "text", optional]) => (
        <label key={name} className="block space-y-1 text-sm font-medium">
          {label}{optional ? " (optional)" : ""}
          {type === "textarea" ? (
            <textarea name={name} rows={4} required={!optional} defaultValue={values[name]}
              className="block w-full rounded-md border bg-background p-3 text-sm" maxLength={3000}
              aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `error-${name}` : undefined} />
          ) : (
            <Input name={name} type={type} required={!optional} defaultValue={values[name]}
              min={type === "number" ? 0 : undefined} max={type === "number" ? 80 : undefined}
              maxLength={type === "url" ? 500 : 150} aria-invalid={Boolean(errors[name])}
              aria-describedby={errors[name] ? `error-${name}` : undefined} />
          )}
          {errors[name] ? <span id={`error-${name}`} className="block text-danger">{errors[name]}</span> : null}
        </label>
      ))}
    </>
  );
}
