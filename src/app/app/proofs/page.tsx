import type { Metadata } from "next";
import { ChallengeBrowser } from "@/components/challenges/challenge-browser";

export const metadata: Metadata = { title: "Proofs" };

export default function ProofsPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-text-secondary">Challenges</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Practical Proofs</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          Build real things. Prove real skills. Level up your developer passport.
        </p>
      </header>
      <ChallengeBrowser />
    </div>
  );
}
