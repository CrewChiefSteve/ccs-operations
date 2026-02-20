"use client";

import { useRef, useState, useEffect, useCallback } from "react";

/**
 * Measures container width using ResizeObserver with debouncing
 * to avoid the infinite re-render loop caused by Recharts'
 * ResponsiveContainer on React 19.
 */
export function useChartDimensions() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  const handleResize = useCallback((entries: ResizeObserverEntry[]) => {
    const entry = entries[0];
    if (entry) {
      const newWidth = Math.floor(entry.contentRect.width);
      setWidth((prev) => {
        // Only update if the width actually changed by at least 1px
        // to prevent resize loops from sub-pixel rounding
        if (Math.abs(prev - newWidth) >= 1) {
          return newWidth;
        }
        return prev;
      });
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Set initial width synchronously
    const rect = el.getBoundingClientRect();
    setWidth(Math.floor(rect.width));

    const observer = new ResizeObserver(handleResize);
    observer.observe(el);

    return () => observer.disconnect();
  }, [handleResize]);

  return { ref, width };
}
