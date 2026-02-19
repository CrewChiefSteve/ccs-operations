"use client";

import { ReactNode, useEffect, useRef } from "react";
import { ConvexReactClient, useMutation } from "convex/react";
import { ClerkProvider, useAuth, useUser } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { dark } from "@clerk/themes";
import { api } from "@convex/_generated/api";

// Lazily create the Convex client so the module can safely be imported
// even if NEXT_PUBLIC_CONVEX_URL is not yet available. This component is
// loaded via next/dynamic with ssr:false so it only runs on the client.
let _convex: ConvexReactClient | null = null;
function getConvexClient(): ConvexReactClient {
  if (!_convex) {
    _convex = new ConvexReactClient(
      process.env.NEXT_PUBLIC_CONVEX_URL as string
    );
  }
  return _convex;
}

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
        synced.current = false;
      });
    }
  }, [isSignedIn, user, getOrCreate]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const convex = getConvexClient();

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
