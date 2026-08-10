"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsd } from "@/lib/utils";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EquityCurvePoint } from "@/lib/portfolio/types";

export function EquityCurveChart({ points }: { points: EquityCurvePoint[] }) {
  if (points.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bankroll over time</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-neutral-500">
            Close a trade to start plotting your bankroll curve.
          </p>
        </CardContent>
      </Card>
    );
  }

  const data = points.map((p) => ({
    date: new Date(p.label).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    bankroll: p.bankroll,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bankroll over time</CardTitle>
      </CardHeader>
      <CardContent className="h-64 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
            <XAxis dataKey="date" stroke="#737373" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis
              stroke="#737373"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatUsd(v, { compact: true })}
              width={56}
            />
            <Tooltip
              contentStyle={{ background: "#171717", border: "1px solid #262626", borderRadius: 8 }}
              labelStyle={{ color: "#d4d4d4" }}
              formatter={(value) => [formatUsd(typeof value === "number" ? value : Number(value)), "Bankroll"]}
            />
            <Line type="monotone" dataKey="bankroll" stroke="#34d399" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
