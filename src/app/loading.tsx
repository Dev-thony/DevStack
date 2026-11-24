export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center px-4" aria-live="polite">
      <div className="w-full max-w-sm rounded-lg border bg-surface p-5">
        <div className="h-4 w-32 animate-pulse rounded bg-surface-elevated" />
        <div className="mt-4 h-24 animate-pulse rounded bg-surface-elevated" />
      </div>
    </main>
  );
}
