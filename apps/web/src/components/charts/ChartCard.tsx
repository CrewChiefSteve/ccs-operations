"use client";

import type { JSX } from "react";

interface ChartCardProps {
  title: string;
  description?: string;
  action?: JSX.Element;
  children: JSX.Element | JSX.Element[] | null | false;
  className?: string;
}

export function ChartCard({
  title,
  description,
  action,
  children,
  className,
}: ChartCardProps) {
  return (
    <div className={`card ${className ?? ""}`}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {description && (
            <p className="mt-0.5 text-2xs text-text-tertiary">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
