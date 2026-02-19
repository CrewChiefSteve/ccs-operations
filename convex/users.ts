import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ============================================================
// USER PROFILES — CCS-specific user data on top of Clerk
// ============================================================
// Clerk handles authentication. This table adds:
//   - Role (admin/operator) for authorization
//   - Preferences (default location, notification settings)
//   - Activity tracking
// ============================================================

// Get or create a user profile (called on login)
export const getOrCreateProfile = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();

    if (existing) {
      // Update last active + display info if changed
      await ctx.db.patch(existing._id, {
        lastActiveAt: Date.now(),
        displayName: args.displayName,
        email: args.email,
        updatedAt: Date.now(),
      });
      return existing;
    }

    // First user is auto-admin, subsequent are operators
    const allUsers = await ctx.db.query("userProfiles").collect();
    const role = allUsers.length === 0 ? "admin" as const : "operator" as const;

    const id = await ctx.db.insert("userProfiles", {
      clerkUserId: args.clerkUserId,
      displayName: args.displayName,
      email: args.email,
      role,
      isActive: true,
      lastActiveAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(id);
  },
});

// Get current user's profile by Clerk ID
export const getProfile = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
  },
});

// List all users (admin only)
export const listUsers = query({
  handler: async (ctx) => {
    const users = await ctx.db.query("userProfiles").collect();
    return users.sort((a, b) => a.displayName.localeCompare(b.displayName));
  },
});

// Update user role (admin only)
export const updateRole = mutation({
  args: {
    userId: v.id("userProfiles"),
    role: v.union(v.literal("admin"), v.literal("operator")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Prevent removing the last admin
    if (user.role === "admin" && args.role !== "admin") {
      const admins = await ctx.db
        .query("userProfiles")
        .withIndex("by_role", (q) => q.eq("role", "admin"))
        .collect();
      const activeAdmins = admins.filter((a) => a.isActive);
      if (activeAdmins.length <= 1) {
        throw new Error("Cannot remove the last admin. Assign another admin first.");
      }
    }

    await ctx.db.patch(args.userId, {
      role: args.role,
      updatedAt: Date.now(),
    });

    return { userId: args.userId, role: args.role };
  },
});

// Update user preferences (self-service)
export const updatePreferences = mutation({
  args: {
    clerkUserId: v.string(),
    preferences: v.object({
      notifications: v.optional(v.boolean()),
      defaultLocationId: v.optional(v.id("locations")),
    }),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();

    if (!user) throw new Error("User profile not found");

    await ctx.db.patch(user._id, {
      preferences: args.preferences,
      updatedAt: Date.now(),
    });

    return user._id;
  },
});

// Deactivate a user (admin only)
export const deactivateUser = mutation({
  args: { userId: v.id("userProfiles") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Prevent deactivating the last admin
    if (user.role === "admin") {
      const admins = await ctx.db
        .query("userProfiles")
        .withIndex("by_role", (q) => q.eq("role", "admin"))
        .collect();
      const activeAdmins = admins.filter((a) => a.isActive);
      if (activeAdmins.length <= 1) {
        throw new Error("Cannot deactivate the last admin.");
      }
    }

    await ctx.db.patch(args.userId, {
      isActive: false,
      updatedAt: Date.now(),
    });

    return args.userId;
  },
});

// Reactivate a user (admin only)
export const reactivateUser = mutation({
  args: { userId: v.id("userProfiles") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(args.userId, {
      isActive: true,
      updatedAt: Date.now(),
    });

    return args.userId;
  },
});
