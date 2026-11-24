import type { Metadata } from "next";
import { RepositoryList } from "@/components/projects/repository-list";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-text-secondary">Repository evidence</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Projects</h1>
      </header>
      <RepositoryList />
    </div>
  );
}
