import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

// ============================================================
// CONVEX FILE STORAGE — Receipt Photo Upload
// ============================================================
// Two-step upload flow:
//   1. Client calls generateUploadUrl() → gets presigned POST URL
//   2. Client POSTs blob to that URL → gets storageId back
//   3. Client calls linkReceiptPhoto() to save the record
// ============================================================

// Step 1: generate a short-lived presigned upload URL
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Step 3: link the uploaded storageId to a purchase order
export const linkReceiptPhoto = mutation({
  args: {
    purchaseOrderId: v.id("purchaseOrders"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("receiptPhotos", {
      purchaseOrderId: args.purchaseOrderId,
      storageId: args.storageId,
      fileName: args.fileName,
      uploadedBy: args.uploadedBy,
      uploadedAt: Date.now(),
    });
  },
});

// Query: fetch all photos for a PO with resolved CDN URLs
export const getReceiptPhotos = query({
  args: { purchaseOrderId: v.id("purchaseOrders") },
  handler: async (ctx, args) => {
    const photos = await ctx.db
      .query("receiptPhotos")
      .withIndex("by_purchaseOrder", (q) => q.eq("purchaseOrderId", args.purchaseOrderId))
      .collect();

    return await Promise.all(
      photos.map(async (photo) => ({
        ...photo,
        url: await ctx.storage.getUrl(photo.storageId),
      }))
    );
  },
});
