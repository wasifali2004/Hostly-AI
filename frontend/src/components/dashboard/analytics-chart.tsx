"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export function RegistrationChart({
  data
}: {
  data: Array<{ date: string; registrations: number }>;
}) {
  const formatted = data.map((point) => ({
    ...point,
    label: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
      new Date(point.date)
    )
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={formatted} margin={{ top: 12, right: 8, left: -26, bottom: 0 }}>
        <defs>
          <linearGradient id="registrationFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#2563eb" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(22,24,20,.08)" />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 9, fill: "rgba(22,24,20,.42)", fontWeight: 600 }}
          minTickGap={32}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          tick={{ fontSize: 9, fill: "rgba(22,24,20,.35)", fontWeight: 600 }}
        />
        <Tooltip
          cursor={{ stroke: "rgba(22,24,20,.18)", strokeDasharray: "3 3" }}
          contentStyle={{
            border: "1px solid rgba(22,24,20,.12)",
            borderRadius: 12,
            boxShadow: "0 12px 30px rgba(22,24,20,.1)",
            fontSize: 11
          }}
          labelStyle={{ fontWeight: 700, marginBottom: 4 }}
        />
        <Area
          type="monotone"
          dataKey="registrations"
          name="Registrations"
          stroke="#2563eb"
          strokeWidth={2}
          fill="url(#registrationFill)"
          activeDot={{ r: 4, fill: "#2563eb", stroke: "#fff", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
