"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useChartDimensions } from "./useChartDimensions";

interface CCSLineChartProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  lines: Array<{
    dataKey: string;
    name: string;
    color?: string;
    dashed?: boolean;
  }>;
  height?: number;
  yFormatter?: (value: number) => string;
}

const COLORS = [
  "#e85d26", // accent/CCS orange
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
];

export function CCSLineChart({
  data,
  xKey,
  lines,
  height = 280,
  yFormatter,
}: CCSLineChartProps) {
  const { ref, width } = useChartDimensions();

  return (
    <div ref={ref} style={{ position: "relative", width: "100%", height, overflow: "hidden" }}>
      {width > 0 && (
        <div style={{ position: "absolute", top: 0, left: 0, width, height }}>
          <LineChart width={width} height={height} data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
              formatter={((value: any, name: any) => [
                yFormatter ? yFormatter(Number(value ?? 0)) : value,
                name,
              ]) as any}
            />
            {lines.length > 1 && (
              <Legend
                wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}
              />
            )}
            {lines.map((line, i) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.name}
                stroke={line.color ?? COLORS[i % COLORS.length]}
                strokeWidth={2}
                strokeDasharray={line.dashed ? "5 5" : undefined}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </div>
      )}
    </div>
  );
}
