import type { SVGProps } from "react";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";

type BrandMarkProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

export function BrandMark({
  title = "DevStack",
  className,
  ...props
}: BrandMarkProps) {
  return (
    <Layers
      role="img"
      aria-label={title}
      className={cn("size-8", className)}
      {...props}
    />
  );
}

type BrandLogoProps = {
  markClassName?: string;
  wordmarkClassName?: string;
};

export function BrandLogo({
  markClassName,
  wordmarkClassName,
}: BrandLogoProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <BrandMark className={cn("text-verification", markClassName)} />
      <span className={cn("text-sm font-semibold", wordmarkClassName)}>DevStack</span>
    </span>
  );
}
