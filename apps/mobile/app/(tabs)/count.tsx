import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex-api';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import {
  Card,
  ActionButton,
  EmptyState,
  SectionHeader,
} from '../../src/components/ui';
import { Scanner } from '../../src/components/Scanner';
import { colors, spacing, TOUCH_TARGET } from '../../src/theme/colors';

type ViewMode = 'locations' | 'counting';

interface CountEntry {
  componentId: string;
  componentName: string;
  systemQty: number;
  actualQty: string;
}

export default function CountScreen() {
  const [mode, setMode] = useState<ViewMode>('locations');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [counts, setCounts] = useState<Record<string, CountEntry>>({});
  const [submitting, setSubmitting] = useState(false);

  const locations = useQuery(api.inventory.locations.list);
  const locationTree = useQuery(api.inventory.locations.getTree);
  const stockAtLocation = useQuery(
    api.inventory.stock.getByLocation,
    selectedLocationId ? { locationId: selectedLocationId } : 'skip'
  );

  const recordCount = useMutation(api.inventory.stock.recordCount);

  // Scan location QR → jump to that location's inventory
  const handleLocationScan = (data: string) => {
    setScannerVisible(false);
    // QR format: "LOC:location_id" or just the location ID
    const locId = data.startsWith('LOC:') ? data.slice(4) : data;
    const match = locations?.find(
      (l: any) => l._id === locId || l.name === locId
    );
    if (match) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedLocationId(match._id);
      setMode('counting');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Unknown Location', `Location "${locId}" not found.`);
    }
  };

  const selectLocation = (locId: string) => {
    setSelectedLocationId(locId);
    setCounts({});
    setMode('counting');
  };

  const updateCount = (componentId: string, name: string, systemQty: number, value: string) => {
    setCounts((prev) => ({
      ...prev,
      [componentId]: {
        componentId,
        componentName: name,
        systemQty,
        actualQty: value,
      },
    }));
  };

  const handleSubmitCounts = async () => {
    const entries = Object.values(counts).filter(
      (c) => c.actualQty !== ''
    );

    if (entries.length === 0) {
      Alert.alert('No Counts', 'Enter actual quantities for at least one item.');
      return;
    }

    const variances = entries.filter(
      (c) => parseInt(c.actualQty) !== c.systemQty
    );

    const message = variances.length > 0
      ? `${entries.length} items counted, ${variances.length} with variance. Submit?`
      : `${entries.length} items counted, all match. Submit?`;

    Alert.alert('Confirm Count', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Submit',
        onPress: async () => {
          setSubmitting(true);
          try {
            for (const entry of entries) {
              await recordCount({
                componentId: entry.componentId,
                locationId: selectedLocationId,
                actualQuantity: parseInt(entry.actualQty),
                systemQuantity: entry.systemQty,
              });
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Count Submitted', 'Inventory counts recorded successfully.');
            setCounts({});
            setMode('locations');
          } catch (err: any) {
            Alert.alert('Error', err.message ?? 'Failed to submit counts.');
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  // ── Location Browser ──────────────────────────────────────

  if (mode === 'locations') {
    return (
      <View style={styles.container}>
        <View style={styles.headerActions}>
          <ActionButton
            label="Scan Location QR"
            icon="qr-code-outline"
            onPress={() => setScannerVisible(true)}
            variant="primary"
            style={{ flex: 1 }}
          />
        </View>

        {!locations ? (
          <Text style={styles.loading}>Loading locations…</Text>
        ) : locations.length === 0 ? (
          <EmptyState
            icon="location-outline"
            title="No Locations"
            message="No warehouse locations defined yet. Add locations from the web dashboard."
          />
        ) : (
          <FlatList
            data={locations}
            keyExtractor={(item: any) => item._id}
            contentContainerStyle={styles.list}
            renderItem={({ item: loc }: { item: any }) => (
              <Card
                style={styles.locationCard}
                onPress={() => selectLocation(loc._id)}
              >
                <View style={styles.locationRow}>
                  <View style={styles.locationIcon}>
                    <Ionicons
                      name={
                        loc.type === 'room' ? 'home-outline' :
                        loc.type === 'shelf' ? 'layers-outline' :
                        loc.type === 'bin' ? 'cube-outline' :
                        'location-outline'
                      }
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locationName}>{loc.name}</Text>
                    <Text style={styles.locationType}>
                      {loc.type}{loc.description ? ` · ${loc.description}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
              </Card>
            )}
          />
        )}

        <Scanner
          visible={scannerVisible}
          onScan={handleLocationScan}
          onClose={() => setScannerVisible(false)}
          title="Scan Location QR"
        />
      </View>
    );
  }

  // ── Counting Mode ─────────────────────────────────────────

  const selectedLocation = locations?.find((l: any) => l._id === selectedLocationId);

  return (
    <View style={styles.container}>
      {/* Location Header */}
      <View style={styles.countHeader}>
        <TouchableOpacity
          onPress={() => setMode('locations')}
          style={styles.backButton}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.countTitle}>{selectedLocation?.name ?? 'Location'}</Text>
          <Text style={styles.countSubtitle}>
            {stockAtLocation?.length ?? 0} items at this location
          </Text>
        </View>
      </View>

      {!stockAtLocation ? (
        <Text style={styles.loading}>Loading inventory…</Text>
      ) : stockAtLocation.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          title="No Inventory"
          message="No components stored at this location."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {stockAtLocation.map((item: any) => {
            const entry = counts[item.componentId];
            const actualQty = parseInt(entry?.actualQty || '');
            const hasVariance = !isNaN(actualQty) && actualQty !== item.quantity;

            return (
              <Card key={item._id} style={styles.countCard}>
                <Text style={styles.componentName}>{item.componentName}</Text>
                <Text style={styles.componentPN}>{item.partNumber ?? ''}</Text>

                <View style={styles.countRow}>
                  <View style={styles.countCol}>
                    <Text style={styles.countLabel}>System</Text>
                    <Text style={styles.countValue}>{item.quantity}</Text>
                  </View>

                  <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />

                  <View style={styles.countCol}>
                    <Text style={styles.countLabel}>Actual</Text>
                    <TextInput
                      style={[
                        styles.countInput,
                        hasVariance && styles.countInputVariance,
                      ]}
                      value={entry?.actualQty ?? ''}
                      onChangeText={(v) =>
                        updateCount(item.componentId, item.componentName, item.quantity, v)
                      }
                      keyboardType="numeric"
                      placeholder="—"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>

                {hasVariance && (
                  <View style={styles.varianceRow}>
                    <Ionicons name="warning" size={14} color={colors.warning} />
                    <Text style={styles.varianceText}>
                      Variance: {actualQty - item.quantity > 0 ? '+' : ''}
                      {actualQty - item.quantity}
                    </Text>
                  </View>
                )}
              </Card>
            );
          })}

          {/* Submit */}
          <View style={styles.submitRow}>
            <ActionButton
              label={submitting ? 'Submitting…' : 'Submit Count'}
              icon="checkmark-circle-outline"
              onPress={handleSubmitCounts}
              variant="primary"
              disabled={submitting}
              style={{ width: '100%' }}
            />
          </View>

          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      )}
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
  loading: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  locationCard: {
    marginBottom: spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.infoBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  locationType: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Counting mode
  countHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  backButton: {
    minHeight: TOUCH_TARGET,
    minWidth: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  countSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  countCard: {
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
    marginBottom: spacing.md,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  countCol: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  countLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  countValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  countInput: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    minHeight: TOUCH_TARGET,
    width: '100%',
  },
  countInputVariance: {
    borderColor: colors.warning,
  },
  varianceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  varianceText: {
    fontSize: 13,
    color: colors.warning,
    fontWeight: '600',
  },
  submitRow: {
    marginTop: spacing.xl,
  },
});
