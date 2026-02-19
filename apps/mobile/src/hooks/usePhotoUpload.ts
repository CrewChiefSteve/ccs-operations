import { useMutation } from 'convex/react';
import { api } from '@/convex-api';

/**
 * Two-step Convex file storage upload flow:
 *   1. generateUploadUrl()  → presigned POST URL
 *   2. POST blob to URL     → { storageId }
 *   3. linkReceiptPhoto()   → saves record in receiptPhotos table
 */
export function usePhotoUpload() {
  const generateUploadUrl = useMutation(api.inventory.storage.generateUploadUrl);
  const linkReceiptPhoto = useMutation(api.inventory.storage.linkReceiptPhoto);

  async function uploadPhoto(
    localUri: string,
    purchaseOrderId: string,
    uploadedBy: string,
  ): Promise<string> {
    // Step 1: get presigned upload URL
    const uploadUrl = await generateUploadUrl({});

    // Step 2: read the local file as a blob and POST to Convex storage
    const response = await fetch(localUri);
    const blob = await response.blob();

    const uploadResult = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'image/jpeg' },
      body: blob,
    });

    if (!uploadResult.ok) {
      throw new Error(`Photo upload failed: ${uploadResult.statusText}`);
    }

    const { storageId } = await uploadResult.json();

    // Step 3: link storageId to the purchase order record
    const fileName = `receipt-${purchaseOrderId}-${Date.now()}.jpg`;
    await linkReceiptPhoto({
      purchaseOrderId: purchaseOrderId as any,
      storageId,
      fileName,
      uploadedBy,
    });

    return storageId;
  }

  return { uploadPhoto };
}
