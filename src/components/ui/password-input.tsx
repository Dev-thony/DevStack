"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

type PasswordInputProps = React.ComponentProps<typeof Input>;

export function PasswordInput({
  className,
  disabled,
  "aria-invalid": ariaInvalid,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  function toggleVisibility() {
    const input = inputRef.current;
    const start = input?.selectionStart;
    const end = input?.selectionEnd;

    setVisible((current) => !current);

    if (input) {
      requestAnimationFrame(() => {
        input.focus();
        if (start !== null && end !== null && start !== undefined && end !== undefined) {
          input.setSelectionRange(start, end);
        }
      });
    }
  }

  return (
    <div className="relative">
      <Input
        {...props}
        ref={inputRef}
        type={visible ? "text" : "password"}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        className={cn("pr-11", className)}
      />
      <button
        type="button"
        onClick={toggleVisibility}
        disabled={disabled}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-text-muted hover:bg-surface-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan disabled:pointer-events-none disabled:opacity-50"
      >
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
}
