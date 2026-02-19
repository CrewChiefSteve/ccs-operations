"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CCSAreaChartProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  dataKey: string;
  name: string;
  color?: string;
  height?: number;
  yFormatter?: (value: number) => string;
}

export function CCSAreaChart({
  data,
  xKey,
  dataKey,
  name,
  color = "#e85d26",
  height = 280,
  yFormatter,
}: CCSAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey={xKey}
          tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={yFormatter}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(17,17,17,0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            fontSize: 12,
            color: "rgba(255,255,255,0.8)",
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={((value: any) => [
            yFormatter ? yFormatter(Number(value ?? 0)) : value,
            name,
          ]) as any}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          name={name}
          stroke={color}
          strokeWidth={2}
          fill={`url(#gradient-${dataKey})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
