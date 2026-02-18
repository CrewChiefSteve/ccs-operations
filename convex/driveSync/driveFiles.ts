import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// ============================================================
// DRIVE FILES — Google Drive Metadata Index
// ============================================================

export const list = query({
  args: {
    productName: v.optional(v.string()),
    folderType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.productName) {
      return await ctx.db
        .query("driveFiles")
        .withIndex("by_product", (q) => q.eq("productName", args.productName!))
        .take(args.limit ?? 100);
    }
    if (args.folderType) {
      return await ctx.db
        .query("driveFiles")
        .withIndex("by_folderType", (q) => q.eq("folderType", args.folderType!))
        .take(args.limit ?? 100);
    }
    return await ctx.db.query("driveFiles").take(args.limit ?? 200);
  },
});

export const getByDriveId = query({
  args: { driveFileId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("driveFiles")
      .withIndex("by_driveFileId", (q) => q.eq("driveFileId", args.driveFileId))
      .unique();
  },
});

export const search = query({
  args: {
    searchTerm: v.string(),
    productName: v.optional(v.string()),
    folderType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("driveFiles")
      .withSearchIndex("search_driveFiles", (q) => {
        let search = q.search("name", args.searchTerm);
        if (args.productName) search = search.eq("productName", args.productName);
        if (args.folderType) search = search.eq("folderType", args.folderType);
        return search;
      })
      .take(25);
  },
});

export const upsert = mutation({
  args: {
    driveFileId: v.string(),
    name: v.string(),
    mimeType: v.string(),
    parentDriveId: v.optional(v.string()),
    path: v.string(),
    productName: v.optional(v.string()),
    folderType: v.optional(v.string()),
    size: v.optional(v.number()),
    modifiedTime: v.optional(v.number()),
    modifiedBy: v.optional(v.string()),
    webViewLink: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("driveFiles")
      .withIndex("by_driveFileId", (q) => q.eq("driveFileId", args.driveFileId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        lastSyncedAt: Date.now(),
        status: "active",
      });
      return { id: existing._id, action: "updated" };
    }

    const id = await ctx.db.insert("driveFiles", {
      ...args,
      lastSyncedAt: Date.now(),
      status: "active",
    });
    return { id, action: "created" };
  },
});

export const markDeleted = mutation({
  args: { driveFileId: v.string() },
  handler: async (ctx, args) => {
    const file = await ctx.db
      .query("driveFiles")
      .withIndex("by_driveFileId", (q) => q.eq("driveFileId", args.driveFileId))
      .unique();

    if (file) {
      await ctx.db.patch(file._id, { status: "deleted", lastSyncedAt: Date.now() });
    }
    return file?._id;
  },
});

// Product file tree
export const getProductTree = query({
  args: { productName: v.string() },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("driveFiles")
      .withIndex("by_product", (q) => q.eq("productName", args.productName))
      .collect();

    const byFolder: Record<string, typeof files> = {};
    for (const f of files) {
      const folder = f.folderType ?? "Other";
      if (!byFolder[folder]) byFolder[folder] = [];
      byFolder[folder].push(f);
    }

    return {
      productName: args.productName,
      totalFiles: files.length,
      folders: byFolder,
    };
  },
});
