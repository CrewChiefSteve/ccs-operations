import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// ============================================================
// RECEIPT PHOTOS — Photo capture for PO receiving workflow
// ============================================================
// Uses Convex file storage for image uploads.
// Flow: client calls generateUploadUrl → uploads file → calls savePhoto
// ============================================================

// Generate a Convex storage upload URL (client calls this first)
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Save a photo record after upload
export const savePhoto = mutation({
  args: {
    purchaseOrderId: v.id("purchaseOrders"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const po = await ctx.db.get(args.purchaseOrderId);
    if (!po) throw new Error("Purchase order not found");

    return await ctx.db.insert("receiptPhotos", {
      purchaseOrderId: args.purchaseOrderId,
      storageId: args.storageId,
      fileName: args.fileName,
      uploadedBy: args.uploadedBy,
      uploadedAt: Date.now(),
    });
  },
});

// List photos for a PO
export const listByPO = query({
  args: { purchaseOrderId: v.id("purchaseOrders") },
  handler: async (ctx, args) => {
    const photos = await ctx.db
      .query("receiptPhotos")
      .withIndex("by_purchaseOrder", (q) =>
        q.eq("purchaseOrderId", args.purchaseOrderId)
      )
      .collect();

    // Get serving URLs for each photo
    return await Promise.all(
      photos.map(async (photo) => {
        const url = await ctx.storage.getUrl(photo.storageId);
        return {
          ...photo,
          url,
        };
      })
    );
  },
});

// Get a single photo URL
export const getPhotoUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Delete a photo
export const deletePhoto = mutation({
  args: { photoId: v.id("receiptPhotos") },
  handler: async (ctx, args) => {
    const photo = await ctx.db.get(args.photoId);
    if (!photo) throw new Error("Photo not found");

    // Delete the file from storage
    await ctx.storage.delete(photo.storageId);
    // Delete the record
    await ctx.db.delete(args.photoId);

    return args.photoId;
  },
});
