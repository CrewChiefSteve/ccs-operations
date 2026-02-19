import { mutation, query, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// ============================================================
// PUSH NOTIFICATIONS — Expo Push Token Management
// ============================================================

// Register or update a push token (called from mobile app on launch)
export const registerToken = mutation({
  args: {
    token: v.string(),
    userId: v.string(),
    deviceName: v.optional(v.string()),
    platform: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        userId: args.userId,
        deviceName: args.deviceName,
        platform: args.platform,
        isActive: true,
        lastUsedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("pushTokens", {
      token: args.token,
      userId: args.userId,
      deviceName: args.deviceName,
      platform: args.platform,
      isActive: true,
      registeredAt: Date.now(),
      lastUsedAt: Date.now(),
    });
  },
});

// Unregister token (called on logout or when device reports DeviceNotRegistered)
export const unregisterToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { isActive: false });
    }
  },
});

// Get all active tokens — used by sendPush
export const getActiveTokens = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("pushTokens")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();
  },
});

// Internal action: send push notification via Expo Push API
// Called by alert/task mutations via ctx.scheduler.runAfter
export const sendPush = internalAction({
  args: {
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
    channelId: v.optional(v.string()),
    priority: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tokens = await ctx.runQuery(api.notifications.getActiveTokens, {});

    if (tokens.length === 0) return;

    const messages = tokens.map((t) => ({
      to: t.token,
      sound: "default",
      title: args.title,
      body: args.body,
      data: args.data ?? {},
      channelId: args.channelId ?? "ccs-alerts",
      priority: args.priority ?? "high",
    }));

    // Expo Push API supports batches of up to 100
    const chunks: typeof messages[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      try {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(chunk),
        });

        const result = await response.json();

        // Mark tokens with DeviceNotRegistered as inactive
        if (result.data) {
          for (let i = 0; i < result.data.length; i++) {
            if (
              result.data[i].status === "error" &&
              result.data[i].details?.error === "DeviceNotRegistered"
            ) {
              const badToken = chunk[i].to;
              await ctx.runMutation(api.notifications.unregisterToken, {
                token: badToken,
              });
            }
          }
        }
      } catch (error) {
        console.error("Push notification send failed:", error);
      }
    }
  },
});
