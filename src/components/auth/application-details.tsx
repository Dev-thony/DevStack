import type { Json } from "@/types/database";

export function applicationValues(details: Json): Record<string, string | number> {
  if (typeof details !== "object" || details === null || Array.isArray(details)) return {};
  return Object.fromEntries(Object.entries(details).flatMap(([key, value]) =>
    typeof value === "string" || typeof value === "number" ? [[key, value]] : []));
}

export function ApplicationDetails({ details }: { details: Json }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {Object.entries(applicationValues(details)).filter(([, value]) => value !== "").map(([key, value]) => {
        let external: URL | null = null;
        if (typeof value === "string" && value.startsWith("https://")) {
          try {
            const url = new URL(value);
            if (!url.username && !url.password && url.protocol === "https:") external = url;
          } catch {
            // Invalid links are displayed as text.
          }
        }
        return (
          <div key={key} className="min-w-0 rounded-md border p-3 wrap-anywhere">
            <dt className="text-xs capitalize text-text-muted">{key.replace(/([A-Z])/g, " $1")}</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm">
              {external ? <a href={external.href} target="_blank" rel="noopener noreferrer" className="text-accent-cyan underline">{external.href}</a> : value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
