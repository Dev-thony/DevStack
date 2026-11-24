"use client";

import { useState } from "react";
import { Building2, Code2, GraduationCap } from "lucide-react";
import { RegistrationForm } from "./registration-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type RegistrationType = "developer" | "mentor" | "company";

const options: Array<{
  type: RegistrationType;
  title: string;
  description: string;
  icon: typeof Code2;
}> = [
  {
    type: "developer",
    title: "Continue as Developer",
    description: "Build a personal developer workspace and evidence-based passport.",
    icon: Code2,
  },
  {
    type: "mentor",
    title: "Register as Mentor",
    description: "Apply for mentor access with a pending verification status.",
    icon: GraduationCap,
  },
  {
    type: "company",
    title: "Register as Company",
    description: "Create a company workspace and become its owner.",
    icon: Building2,
  },
];

export function RegistrationSelector() {
  const [registrationType, setRegistrationType] =
    useState<RegistrationType>("developer");

  const selected =
    options.find((option) => option.type === registrationType) ?? options[0];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((option) => {
          const Icon = option.icon;
          const active = option.type === registrationType;
          return (
            <button
              key={option.type}
              type="button"
              aria-pressed={active}
              onClick={() => setRegistrationType(option.type)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                active
                  ? "border-verification bg-verification-soft"
                  : "border-border bg-surface hover:border-text-muted"
              }`}
            >
              <Icon className={`size-5 ${active ? "text-verification" : "text-text-secondary"}`} />
              <span className="mt-3 block text-sm font-medium">{option.title}</span>
              <span className="mt-1 block text-xs leading-5 text-text-secondary">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{selected.title}</CardTitle>
          <CardDescription>
            {registrationType === "mentor"
              ? "You will receive pending mentor status; verification is administrator-controlled."
              : registrationType === "company"
                ? "Submit your company information for review. Recruitment access opens after approval."
                : "Start a personal developer workspace and passport."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegistrationForm key={registrationType} kind={registrationType} />
        </CardContent>
      </Card>
    </div>
  );
}
