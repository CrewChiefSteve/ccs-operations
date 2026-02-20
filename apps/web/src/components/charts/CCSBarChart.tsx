"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import { useChartDimensions } from "./useChartDimensions";

interface CCSBarChartProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  bars: Array<{
    dataKey: string;
    name: string;
    color?: string;
    stackId?: string;
  }>;
  height?: number;
  yFormatter?: (value: number) => string;
  colorByIndex?: boolean;
}

const COLORS = [
  "#e85d26", // accent/CCS orange
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#6366f1", // indigo-500
  "#14b8a6", // teal-500
];

export function CCSBarChart({
  data,
  xKey,
  bars,
  height = 280,
  yFormatter,
  colorByIndex = false,
}: CCSBarChartProps) {
  const { ref, width } = useChartDimensions();

  return (
    <div ref={ref} style={{ position: "relative", width: "100%", height, overflow: "hidden" }}>
      {width > 0 && (
        <div style={{ position: "absolute", top: 0, left: 0, width, height }}>
          <BarChart width={width} height={height} data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
            {bars.length > 1 && (
              <Legend
                wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}
              />
            )}
            {bars.map((bar, i) => (
              <Bar
                key={bar.dataKey}
                dataKey={bar.dataKey}
                name={bar.name}
                fill={bar.color ?? COLORS[i % COLORS.length]}
                stackId={bar.stackId}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              >
                {colorByIndex &&
                  data.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
              </Bar>
            ))}
          </BarChart>
        </div>
      )}
    </div>
  );
}
