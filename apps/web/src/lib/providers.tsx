"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { ConvexReactClient, useMutation } from "convex/react";
import { ClerkProvider, useAuth, useUser } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { dark } from "@clerk/themes";
import { api } from "@convex/_generated/api";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string
);

function ProfileSync({ children }: { children: ReactNode }) {
  const { isSignedIn, user } = useUser();
  const getOrCreate = useMutation(api.users.getOrCreateProfile);
  const synced = useRef(false);

  useEffect(() => {
    if (isSignedIn && user && !synced.current) {
      synced.current = true;
      getOrCreate({
        clerkUserId: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? "",
        displayName: user.fullName ?? user.firstName ?? "User",
      }).catch(() => {
        // Best-effort profile sync
        synced.current = false;
      });
    }
  }, [isSignedIn, user, getOrCreate]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  // Guard: skip providers during static prerendering (SSR/SSG).
  // Next.js prerenders /_error, /404, /500 pages statically. During that
  // phase, ClerkProvider and ConvexProviderWithClerk call useContext which
  // fails if there are React version mismatches in the monorepo, or if
  // the React server environment doesn't support the context. Deferring
  // to client-only rendering avoids this entirely.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Render children without providers during SSR — the page shell
    // still renders, and providers attach on the client.
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#e85d26",
          colorBackground: "#111114",
        },
      }}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ProfileSync>{children}</ProfileSync>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
