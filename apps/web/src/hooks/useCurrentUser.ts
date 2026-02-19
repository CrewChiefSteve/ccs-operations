"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useEffect } from "react";

/**
 * Hook that combines Clerk auth with CCS user profile.
 * Auto-creates/updates the profile on mount.
 * Returns: { user, profile, isAdmin, isLoading }
 */
export function useCurrentUser() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();

  const profile = useQuery(
    api.users.getProfile,
    clerkUser ? { clerkUserId: clerkUser.id } : "skip"
  );

  const getOrCreate = useMutation(api.users.getOrCreateProfile);

  // Auto-create/update profile when Clerk user is available
  useEffect(() => {
    if (!clerkUser) return;
    if (profile !== undefined) return; // Already loaded (or loading)

    // Profile doesn't exist yet — create it
    getOrCreate({
      clerkUserId: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress ?? "",
      displayName:
        clerkUser.fullName ??
        clerkUser.primaryEmailAddress?.emailAddress ??
        "User",
    });
  }, [clerkUser, profile, getOrCreate]);

  // Sync profile on initial load (even if it exists — updates lastActiveAt)
  useEffect(() => {
    if (!clerkUser || profile === undefined) return;
    if (profile === null) {
      // Profile not found, create it
      getOrCreate({
        clerkUserId: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress ?? "",
        displayName:
          clerkUser.fullName ??
          clerkUser.primaryEmailAddress?.emailAddress ??
          "User",
      });
    }
  }, [clerkUser, profile, getOrCreate]);

  const isLoading = !clerkLoaded || (clerkUser && profile === undefined);

  return {
    user: clerkUser,
    profile: profile ?? null,
    isAdmin: profile?.role === "admin",
    isOperator: profile?.role === "operator",
    isLoading,
    isAuthenticated: !!clerkUser,
  };
}
