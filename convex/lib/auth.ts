import { QueryCtx, MutationCtx } from "../_generated/server";

// ============================================================
// AUTH HELPERS — Role-based authorization for Convex functions
// ============================================================
// Usage:
//   const userId = await getCurrentUserId(ctx);
//   await requireAdmin(ctx);
// ============================================================

/**
 * Get the current Clerk user ID from the Convex auth context.
 * Returns null if not authenticated.
 */
export async function getCurrentUserId(
  ctx: QueryCtx | MutationCtx
): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  // Clerk sets subject to the Clerk user ID
  return identity.subject;
}

/**
 * Require authentication. Throws if not authenticated.
 * Returns the Clerk user ID.
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<string> {
  const userId = await getCurrentUserId(ctx);
  if (!userId) {
    throw new Error("Authentication required");
  }
  return userId;
}

/**
 * Require admin role. Throws if not authenticated or not admin.
 * Returns the Clerk user ID.
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<string> {
  const clerkUserId = await requireAuth(ctx);

  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
    .unique();

  if (!profile) {
    throw new Error("User profile not found. Please log out and log back in.");
  }

  if (profile.role !== "admin") {
    throw new Error("Admin access required");
  }

  if (!profile.isActive) {
    throw new Error("User account is deactivated");
  }

  return clerkUserId;
}

/**
 * Get the current user's profile. Returns null if not authenticated
 * or profile doesn't exist yet.
 */
export async function getCurrentUserProfile(
  ctx: QueryCtx | MutationCtx
) {
  const clerkUserId = await getCurrentUserId(ctx);
  if (!clerkUserId) return null;

  return await ctx.db
    .query("userProfiles")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
    .unique();
}
