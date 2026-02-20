"use client";

import { useRef, useState, useEffect } from "react";

/**
 * Measures container width for Recharts charts.
 *
 * Replaces ResponsiveContainer which causes infinite re-render loops
 * (React error #185) on React 19. Measures width on mount and window
 * resize only — NOT via ResizeObserver — to avoid the feedback loop
 * where chart render → container resize → observer fires → re-render.
 */
export function useChartDimensions() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const w = Math.floor(el.clientWidth);
      if (w > 0) setWidth(w);
    };

    // Initial measurement
    measure();

    // Re-measure only on window resize (not container resize)
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return { ref, width };
}
