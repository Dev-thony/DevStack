"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CompanyPassportSearch() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Public passport search</CardTitle>
        <CardDescription>Search only publicly visible DevStack usernames.</CardDescription>
      </CardHeader>
      <form
        className="px-5 pb-5"
        onSubmit={(event) => {
          event.preventDefault();
          const normalized = username.trim();
          if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,30}$/.test(normalized)) {
            setError("Enter a valid public username.");
            return;
          }
          setError(null);
          router.push(`/u/${normalized}`);
        }}
      >
        <label className="block space-y-2 text-sm font-medium" htmlFor="passport-username">
          Username
          <Input
            id="passport-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="developer-name"
            pattern={String.raw`[A-Za-z0-9][A-Za-z0-9_\-]{2,30}`}
          />
        </label>
        {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
        <Button type="submit" className="mt-4" variant="secondary">
          <Search />
          Open public passport
        </Button>
      </form>
    </Card>
  );
}
