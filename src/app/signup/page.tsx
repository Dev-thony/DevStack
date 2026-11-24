import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { RegistrationSelector } from "@/components/auth/registration-selector";
import { CompactThemeToggle } from "@/components/theme/theme-toggle";

export const metadata: Metadata = {
  title: "Create account",
};

export default function SignupPage() {
  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl flex-col justify-center">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link href="/" aria-label="DevStack home">
            <BrandLogo markClassName="size-7" />
          </Link>
          <CompactThemeToggle />
        </div>
        <RegistrationSelector />
      </div>
    </main>
  );
}
