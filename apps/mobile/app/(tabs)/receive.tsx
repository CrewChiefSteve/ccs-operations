import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@/convex-api';
import { Ionicons } from '@expo/vector-icons';
import {
  Card,
  StatusBadge,
  ActionButton,
  EmptyState,
  SectionHeader,
} from '../../src/components/ui';
import { Scanner } from '../../src/components/Scanner';
import { colors, spacing, poStatusColor } from '../../src/theme/colors';

const PO_RECEIVABLE_STATUSES = ['shipped', 'confirmed', 'submitted'];

function poStatusVariant(status: string) {
  if (status === 'shipped') return 'warning' as const;
  if (status === 'confirmed') return 'info' as const;
  if (status === 'received') return 'success' as const;
  return 'muted' as const;
}

export default function ReceiveScreen() {
  const router = useRouter();
  const [scannerVisible, setScannerVisible] = useState(false);

  const allOrders = useQuery(api.inventory.purchaseOrders.list, {});
  const purchaseOrders = allOrders?.filter((po: any) =>
    PO_RECEIVABLE_STATUSES.includes(po.status)
  );

  const handleScan = (data: string) => {
    setScannerVisible(false);
    // QR data format: "PO:PO-2026-001" or raw PO number
    const poNumber = data.startsWith('PO:') ? data.slice(3) : data;
    const match = purchaseOrders?.find(
      (po: any) => po.poNumber === poNumber
    );
    if (match) {
      router.push({
        pathname: '/(tabs)/po-detail',
        params: { poId: match._id },
      });
    }
  };

  if (!purchaseOrders) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading purchase orders…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Actions */}
      <View style={styles.headerActions}>
        <ActionButton
          label="Scan PO"
          icon="scan-outline"
          onPress={() => setScannerVisible(true)}
          variant="primary"
          style={{ flex: 1 }}
        />
      </View>

      {purchaseOrders.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          title="No POs to Receive"
          message="All purchase orders have been received or there are none with shipped/confirmed status."
        />
      ) : (
        <FlatList
          data={purchaseOrders}
          keyExtractor={(item: any) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item: po }: { item: any }) => (
            <Card
              style={styles.poCard}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/po-detail',
                  params: { poId: po._id },
                })
              }
            >
              <View style={styles.poHeader}>
                <Text style={styles.poNumber}>{po.poNumber}</Text>
                <StatusBadge
                  label={po.status}
                  variant={poStatusVariant(po.status)}
                />
              </View>

              <Text style={styles.supplierName}>
                {po.supplierName ?? 'Unknown Supplier'}
              </Text>

              <View style={styles.poMeta}>
                {po.trackingNumber && (
                  <View style={styles.metaItem}>
                    <Ionicons name="airplane-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.metaText}>{po.trackingNumber}</Text>
                  </View>
                )}
                {po.expectedDelivery && (
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.metaText}>
                      Expected {new Date(po.expectedDelivery).toLocaleDateString()}
                    </Text>
                  </View>
                )}
                <View style={styles.metaItem}>
                  <Ionicons name="cash-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.metaText}>
                    ${po.total?.toFixed(2) ?? '—'}
                  </Text>
                </View>
              </View>

              <View style={styles.poFooter}>
                <Text style={styles.tapHint}>Tap to receive items →</Text>
              </View>
            </Card>
          )}
        />
      )}

      <Scanner
        visible={scannerVisible}
        onScan={handleScan}
        onClose={() => setScannerVisible(false)}
        title="Scan PO Barcode"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerActions: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  poCard: {
    marginBottom: spacing.md,
  },
  poHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  poNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  supplierName: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  poMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  poFooter: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tapHint: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
});
