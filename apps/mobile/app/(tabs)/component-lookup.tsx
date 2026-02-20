import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex-api';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Card,
  StatusBadge,
  ActionButton,
  EmptyState,
  SectionHeader,
} from '../../src/components/ui';
import { Scanner } from '../../src/components/Scanner';
import { colors, spacing, TOUCH_TARGET } from '../../src/theme/colors';

export default function ComponentLookupScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState('');
  const [selectedComponent, setSelectedComponent] = useState<any>(null);
  const [scannerVisible, setScannerVisible] = useState(false);

  const searchResults = useQuery(
    api.inventory.components.search,
    searchText.length >= 2 ? { searchTerm: searchText } : 'skip'
  );

  const stockLevels = useQuery(
    api.inventory.stock.getByComponent,
    selectedComponent ? { componentId: selectedComponent._id } : 'skip'
  );

  const handleScan = (data: string) => {
    setScannerVisible(false);
    setSearchText(data);
  };

  // ── Detail View ───────────────────────────────────────────

  if (selectedComponent) {
    const totalStock = stockLevels?.reduce(
      (sum: number, s: any) => sum + (s.quantity ?? 0),
      0
    ) ?? 0;
    const totalAvailable = stockLevels?.reduce(
      (sum: number, s: any) => sum + (s.availableQuantity ?? 0),
      0
    ) ?? 0;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => setSelectedComponent(null)}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
          <Text style={styles.backText}>Back to Search</Text>
        </TouchableOpacity>

        {/* Component Info */}
        <Text style={styles.componentName}>{selectedComponent.name}</Text>
        <Text style={styles.partNumber}>{selectedComponent.partNumber}</Text>

        {selectedComponent.category && (
          <View style={styles.tagRow}>
            <StatusBadge label={selectedComponent.category} variant="info" />
            {selectedComponent.subcategory && (
              <StatusBadge label={selectedComponent.subcategory} variant="muted" />
            )}
          </View>
        )}

        {selectedComponent.description && (
          <Text style={styles.description}>{selectedComponent.description}</Text>
        )}

        {/* Stock Summary */}
        <SectionHeader title="Stock Levels" />
        <View style={styles.stockSummary}>
          <View style={styles.stockCol}>
            <Text style={styles.stockValue}>{totalStock}</Text>
            <Text style={styles.stockLabel}>Total</Text>
          </View>
          <View style={styles.stockCol}>
            <Text style={[styles.stockValue, { color: colors.success }]}>
              {totalAvailable}
            </Text>
            <Text style={styles.stockLabel}>Available</Text>
          </View>
          <View style={styles.stockCol}>
            <Text style={[styles.stockValue, { color: colors.warning }]}>
              {totalStock - totalAvailable}
            </Text>
            <Text style={styles.stockLabel}>Reserved</Text>
          </View>
        </View>

        {/* Stock by Location */}
        {stockLevels && stockLevels.length > 0 && (
          <>
            <SectionHeader title="By Location" />
            {stockLevels.map((stock: any) => (
              <Card key={stock._id} style={styles.locationStockCard}>
                <View style={styles.locationStockRow}>
                  <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.locationName}>
                    {stock.locationName ?? 'Unassigned'}
                  </Text>
                  <Text style={styles.locationQty}>{stock.quantity}</Text>
                </View>
              </Card>
            ))}
          </>
        )}

        {/* Supplier Info */}
        {selectedComponent.manufacturer && (
          <>
            <SectionHeader title="Manufacturer" />
            <Card>
              <Text style={styles.mfgName}>{selectedComponent.manufacturer}</Text>
              {selectedComponent.manufacturerPN && (
                <Text style={styles.mfgPN}>MPN: {selectedComponent.manufacturerPN}</Text>
              )}
            </Card>
          </>
        )}

        {/* Quick Actions */}
        <SectionHeader title="Actions" />
        <View style={styles.actionRow}>
          <ActionButton
            label="Start Count"
            icon="calculator-outline"
            onPress={() => router.push('/(tabs)/count')}
            variant="secondary"
            style={{ flex: 1 }}
          />
          {selectedComponent.datasheetDriveId && (
            <ActionButton
              label="Datasheet"
              icon="document-outline"
              onPress={() => {
                // Open datasheet in Drive
                Linking.openURL(
                  `https://drive.google.com/file/d/${selectedComponent.datasheetDriveId}/view`
                );
              }}
              variant="ghost"
              style={{ flex: 1 }}
            />
          )}
        </View>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    );
  }

  // ── Search View ───────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search by name, part number, or barcode…"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')} hitSlop={12}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => setScannerVisible(true)}
        >
          <Ionicons name="scan-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {searchText.length < 2 ? (
        <EmptyState
          icon="search-outline"
          title="Search Components"
          message="Enter at least 2 characters to search, or scan a barcode."
        />
      ) : !searchResults ? (
        <Text style={styles.loading}>Searching…</Text>
      ) : searchResults.length === 0 ? (
        <EmptyState
          icon="alert-circle-outline"
          title="No Results"
          message={`No components found for "${searchText}"`}
        />
      ) : (
        <FlatList
          data={searchResults}
          keyExtractor={(item: any) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }: { item: any }) => (
            <Card
              style={styles.resultCard}
              onPress={() => setSelectedComponent(item)}
            >
              <View style={styles.resultRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Text style={styles.resultPN}>{item.partNumber}</Text>
                </View>
                <View style={styles.resultMeta}>
                  {item.category && (
                    <StatusBadge label={item.category} variant="info" />
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Card>
          )}
        />
      )}

      <Scanner
        visible={scannerVisible}
        onScan={handleScan}
        onClose={() => setScannerVisible(false)}
        title="Scan Component"
      />
    </View>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    margin: spacing.lg,
    paddingHorizontal: spacing.md,
    minHeight: TOUCH_TARGET,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: spacing.md,
  },
  scanButton: {
    minHeight: TOUCH_TARGET,
    minWidth: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
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
  resultCard: {
    marginBottom: spacing.sm,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  resultPN: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  resultMeta: {
    alignItems: 'flex-end',
  },
  // Detail view
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
    minHeight: TOUCH_TARGET,
  },
  backText: {
    fontSize: 16,
    color: colors.text,
  },
  componentName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  partNumber: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  tagRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.lg,
  },
  stockSummary: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  stockCol: {
    flex: 1,
    alignItems: 'center',
  },
  stockValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  stockLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  locationStockCard: {
    marginBottom: spacing.sm,
  },
  locationStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  locationName: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  locationQty: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  mfgName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  mfgPN: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
