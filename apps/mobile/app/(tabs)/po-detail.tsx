import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { useUser } from '@clerk/clerk-expo';
import { api } from '@/convex-api';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Card, ActionButton, StatusBadge } from '../../src/components/ui';
import { Scanner } from '../../src/components/Scanner';
import { usePhotoUpload } from '../../src/hooks/usePhotoUpload';
import { colors, spacing, TOUCH_TARGET } from '../../src/theme/colors';

interface ReceivedQty {
  lineId: string;
  qty: string;
  flagged: boolean;
  notes: string;
}

export default function PODetailScreen() {
  const { poId } = useLocalSearchParams<{ poId: string }>();
  const router = useRouter();
  const { user } = useUser();

  const po = useQuery(api.inventory.purchaseOrders.get, { id: poId });
  const lines = useQuery(api.inventory.purchaseOrders.getLines, {
    purchaseOrderId: poId,
  });
  const existingPhotos = useQuery(
    api.inventory.storage.getReceiptPhotos,
    poId ? { purchaseOrderId: poId as any } : 'skip'
  );

  const receiveLine = useMutation(api.inventory.purchaseOrders.receiveLine);
  const { uploadPhoto } = usePhotoUpload();

  const [received, setReceived] = useState<Record<string, ReceivedQty>>({});
  const [scannerVisible, setScannerVisible] = useState(false);
  // Local URIs of newly captured photos (not yet uploaded)
  const [newPhotos, setNewPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const userId = user?.primaryEmailAddress?.emailAddress ?? user?.id ?? 'unknown';

  // Update received qty for a line
  const updateLine = (lineId: string, field: keyof ReceivedQty, value: any) => {
    setReceived((prev) => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        lineId,
        qty: prev[lineId]?.qty ?? '',
        flagged: prev[lineId]?.flagged ?? false,
        notes: prev[lineId]?.notes ?? '',
        [field]: value,
      },
    }));
  };

  // Barcode scan → try to match a component in the PO lines
  const handleScan = (data: string) => {
    setScannerVisible(false);
    const match = lines?.find(
      (line: any) =>
        line.componentPartNumber === data ||
        line.componentBarcode === data
    );
    if (match) {
      const remaining = match.quantity - (match.quantityReceived ?? 0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateLine(match._id, 'qty', String(remaining));
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('No Match', `Barcode "${data}" doesn't match any PO line items.`);
    }
  };

  // Capture a new photo
  const capturePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setNewPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  // Remove a new (not yet uploaded) photo from local state
  const removeNewPhoto = (uri: string) => {
    setNewPhotos((prev) => prev.filter((u) => u !== uri));
  };

  // Submit all received lines and upload any pending photos
  const handleSubmit = async () => {
    const linesToReceive = Object.values(received).filter(
      (r) => r.qty && parseInt(r.qty) > 0
    );

    if (linesToReceive.length === 0) {
      Alert.alert('Nothing to Submit', 'Enter received quantities for at least one line item.');
      return;
    }

    Alert.alert(
      'Confirm Receipt',
      `Receive ${linesToReceive.length} line item(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setSubmitting(true);
            try {
              // Upload new photos first (non-blocking — failure doesn't abort receipt)
              if (newPhotos.length > 0) {
                setUploadingPhotos(true);
                for (const photoUri of newPhotos) {
                  try {
                    await uploadPhoto(photoUri, poId!, userId);
                  } catch (err) {
                    console.warn('Photo upload failed:', err);
                  }
                }
                setNewPhotos([]);
                setUploadingPhotos(false);
              }

              // Record received quantities
              for (const line of linesToReceive) {
                await receiveLine({
                  purchaseOrderLineId: line.lineId,
                  quantityReceived: parseInt(line.qty),
                  notes: line.notes || undefined,
                  flagDiscrepancy: line.flagged,
                });
              }

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Items received and inventory updated.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (err: any) {
              Alert.alert('Error', err.message ?? 'Failed to receive items.');
            } finally {
              setSubmitting(false);
              setUploadingPhotos(false);
            }
          },
        },
      ]
    );
  };

  const submitLabel = uploadingPhotos
    ? 'Uploading photos…'
    : submitting
    ? 'Submitting…'
    : 'Submit Receipt';

  if (!po || !lines) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading PO details…</Text>
      </View>
    );
  }

  const hasPhotos = (existingPhotos && existingPhotos.length > 0) || newPhotos.length > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* PO Header */}
      <View style={styles.poHeader}>
        <Text style={styles.poNumber}>{po.poNumber}</Text>
        <StatusBadge label={po.status} variant="warning" />
      </View>
      <Text style={styles.supplier}>{po.supplierName ?? 'Unknown Supplier'}</Text>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        <ActionButton
          label="Scan Item"
          icon="scan-outline"
          onPress={() => setScannerVisible(true)}
          variant="secondary"
          style={{ flex: 1 }}
        />
        <ActionButton
          label="Photo"
          icon="camera-outline"
          onPress={capturePhoto}
          variant="secondary"
          style={{ flex: 1 }}
        />
      </View>

      {/* Photo Strip — existing (uploaded) + new (local) */}
      {hasPhotos && (
        <ScrollView horizontal style={styles.photoRow} showsHorizontalScrollIndicator={false}>
          {/* Already-uploaded photos from Convex storage */}
          {existingPhotos?.map((photo: any) => (
            <View key={photo._id} style={styles.photoWrapper}>
              <Image source={{ uri: photo.url }} style={styles.photoThumb} />
              <View style={styles.photoUploadedBadge}>
                <Ionicons name="cloud-done-outline" size={12} color={colors.success} />
              </View>
            </View>
          ))}

          {/* Newly captured local photos */}
          {newPhotos.map((uri) => (
            <View key={uri} style={styles.photoWrapper}>
              <Image source={{ uri }} style={styles.photoThumb} />
              <TouchableOpacity
                style={styles.photoDeleteBtn}
                onPress={() => removeNewPhoto(uri)}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={20} color={colors.critical} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Line Items */}
      <Text style={styles.sectionTitle}>
        Line Items ({lines.length})
      </Text>

      {lines.map((line: any) => {
        const rec = received[line._id];
        const remaining = line.quantity - (line.quantityReceived ?? 0);
        const isFullyReceived = remaining <= 0;
        const enteredQty = parseInt(rec?.qty || '0');
        const hasDiscrepancy = rec?.qty && enteredQty !== remaining;

        return (
          <Card key={line._id} style={[styles.lineCard, isFullyReceived && styles.lineCardReceived]}>
            <View style={styles.lineHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.componentName, isFullyReceived && styles.textDimmed]}>
                  {line.componentName ?? 'Unknown Component'}
                </Text>
                <Text style={styles.componentPN}>
                  {line.componentPartNumber ?? ''}
                </Text>
              </View>
              <View style={styles.expectedCol}>
                <Text style={styles.expectedLabel}>
                  {isFullyReceived ? 'Received' : 'Expected'}
                </Text>
                <Text style={[styles.expectedQty, isFullyReceived && { color: colors.success }]}>
                  {isFullyReceived ? `${line.quantityReceived}/${line.quantity}` : line.quantity}
                </Text>
              </View>
            </View>

            {isFullyReceived ? (
              <View style={styles.fullyReceivedBadge}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.fullyReceivedText}>Fully received</Text>
              </View>
            ) : (
              <>
                {line.quantityReceived > 0 && (
                  <Text style={styles.alreadyReceived}>
                    Already received: {line.quantityReceived} — {remaining} remaining
                  </Text>
                )}

                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Qty Received:</Text>
                  <TextInput
                    style={[
                      styles.qtyInput,
                      hasDiscrepancy && styles.qtyInputDiscrepancy,
                    ]}
                    value={rec?.qty ?? ''}
                    onChangeText={(v) => updateLine(line._id, 'qty', v)}
                    keyboardType="numeric"
                    placeholder={String(remaining)}
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity
                    style={styles.matchButton}
                    onPress={() => updateLine(line._id, 'qty', String(remaining))}
                    hitSlop={8}
                  >
                    <Text style={styles.matchButtonText}>Match</Text>
                  </TouchableOpacity>
                </View>

                {hasDiscrepancy && (
                  <View style={styles.discrepancyRow}>
                    <Ionicons name="warning" size={16} color={colors.warning} />
                    <Text style={styles.discrepancyText}>
                      Discrepancy: expected {remaining}, entering {enteredQty}
                    </Text>
                  </View>
                )}

                <TextInput
                  style={styles.notesInput}
                  value={rec?.notes ?? ''}
                  onChangeText={(v) => updateLine(line._id, 'notes', v)}
                  placeholder="Notes (optional)"
                  placeholderTextColor={colors.textMuted}
                />
              </>
            )}
          </Card>
        );
      })}

      {/* Submit */}
      <View style={styles.submitRow}>
        <ActionButton
          label={submitLabel}
          icon="checkmark-circle-outline"
          onPress={handleSubmit}
          variant="primary"
          disabled={submitting || uploadingPhotos}
          style={{ width: '100%' }}
        />
      </View>

      <View style={{ height: spacing.xxxl }} />

      <Scanner
        visible={scannerVisible}
        onScan={handleScan}
        onClose={() => setScannerVisible(false)}
        title="Scan Component"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
  },
  loading: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  poHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  poNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  supplier: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  actionBar: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  photoRow: {
    marginBottom: spacing.lg,
  },
  photoWrapper: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.bgCard,
  },
  photoDeleteBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  photoUploadedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    padding: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  lineCard: {
    marginBottom: spacing.md,
  },
  lineCardReceived: {
    opacity: 0.6,
  },
  textDimmed: {
    color: colors.textSecondary,
  },
  fullyReceivedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fullyReceivedText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  componentName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  componentPN: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  expectedCol: {
    alignItems: 'center',
  },
  expectedLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  expectedQty: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  alreadyReceived: {
    fontSize: 13,
    color: colors.success,
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  inputLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  qtyInput: {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    minHeight: TOUCH_TARGET,
  },
  qtyInputDiscrepancy: {
    borderColor: colors.warning,
  },
  matchButton: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
  },
  matchButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  discrepancyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  discrepancyText: {
    fontSize: 13,
    color: colors.warning,
  },
  notesInput: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 14,
    marginTop: spacing.sm,
    minHeight: TOUCH_TARGET,
  },
  submitRow: {
    marginTop: spacing.xxl,
  },
});
