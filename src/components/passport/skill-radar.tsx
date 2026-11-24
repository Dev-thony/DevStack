"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "@/components/theme/theme-provider";

export type RadarDatum = {
  domain: string;
  score: number;
};

export function SkillRadar({ data }: { data: RadarDatum[] }) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === "light";

  const gridColor = isLight ? "#e2e8f0" : "#27272A";
  const textColor = isLight ? "#64748b" : "#A1A1AA";
  const accentColor = isLight ? "#0284c7" : "#22D3EE";

  return (
    <div className="h-64 w-full sm:h-72" role="img" aria-label="Six-domain skill radar">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="52%" margin={{ top: 12, right: 24, bottom: 12, left: 24 }}>
          <PolarGrid stroke={gridColor} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <PolarAngleAxis
            dataKey="domain"
            tick={{ fill: textColor, fontSize: 11 }}
          />
          <Radar
            name="Skill score"
            dataKey="score"
            stroke={accentColor}
            fill={accentColor}
            fillOpacity={0.16}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
