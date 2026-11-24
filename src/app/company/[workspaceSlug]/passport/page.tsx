import { CompanyPassportSearch } from "@/components/company/passport-search";

export default function CompanyPassportPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-text-secondary">Company workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Passport Search</h1>
      </header>
      <CompanyPassportSearch />
    </div>
  );
}
