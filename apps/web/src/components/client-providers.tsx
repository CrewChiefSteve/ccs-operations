"use client";

import dynamic from "next/dynamic";
import { ReactNode } from "react";

// Dynamically import Providers with SSR disabled.
// This prevents @clerk/nextjs and convex/react from being evaluated
// during Next.js static prerendering (where React context is unavailable).
// The Providers module is only loaded on the client after hydration.
const Providers = dynamic(
  () => import("@/lib/providers").then((mod) => mod.Providers),
  { ssr: false }
);

export function ClientProviders({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
