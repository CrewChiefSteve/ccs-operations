import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex-api';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import {
  Card,
  ActionButton,
  StatusBadge,
  EmptyState,
} from '../../src/components/ui';
import { colors, spacing, severityColor, TOUCH_TARGET } from '../../src/theme/colors';

function severityVariant(s: string) {
  if (s === 'critical') return 'critical' as const;
  if (s === 'warning') return 'warning' as const;
  return 'info' as const;
}

function severityIcon(s: string): React.ComponentProps<typeof Ionicons>['name'] {
  if (s === 'critical') return 'alert-circle';
  if (s === 'warning') return 'warning';
  return 'information-circle';
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AlertsScreen() {
  const [selectedAlert, setSelectedAlert] = useState<any>(null);

  const alerts = useQuery(api.agent.alerts.getActive);
  const alertStats = useQuery(api.agent.alerts.stats);

  const acknowledgeAlert = useMutation(api.agent.alerts.acknowledge);
  const resolveAlert = useMutation(api.agent.alerts.resolve);
  const dismissAlert = useMutation(api.agent.alerts.dismiss);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert({ alertId });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      await resolveAlert({ alertId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedAlert(null);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDismiss = async (alertId: string) => {
    Alert.alert('Dismiss Alert', 'Are you sure? This will hide the alert.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Dismiss',
        style: 'destructive',
        onPress: async () => {
          try {
            await dismissAlert({ alertId });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setSelectedAlert(null);
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  // Sort: critical first, then warning, then info; within each, newest first
  const sortedAlerts = React.useMemo(() => {
    if (!alerts) return [];
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    return [...alerts].sort((a: any, b: any) => {
      const sDiff = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
      if (sDiff !== 0) return sDiff;
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });
  }, [alerts]);

  return (
    <View style={styles.container}>
      {/* Stats Bar */}
      {alertStats && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.critical }]}>
              {alertStats.critical ?? 0}
            </Text>
            <Text style={styles.statLabel}>Critical</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.warning }]}>
              {alertStats.warning ?? 0}
            </Text>
            <Text style={styles.statLabel}>Warning</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.info }]}>
              {alertStats.info ?? 0}
            </Text>
            <Text style={styles.statLabel}>Info</Text>
          </View>
        </View>
      )}

      {!alerts ? (
        <Text style={styles.loading}>Loading alerts…</Text>
      ) : sortedAlerts.length === 0 ? (
        <EmptyState
          icon="shield-checkmark-outline"
          title="All Clear"
          message="No active alerts. Everything is running smoothly."
        />
      ) : (
        <FlatList
          data={sortedAlerts}
          keyExtractor={(item: any) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item: alert }: { item: any }) => (
            <Card
              style={styles.alertCard}
              onPress={() => setSelectedAlert(alert)}
            >
              <View style={styles.alertRow}>
                <View
                  style={[
                    styles.severityStrip,
                    { backgroundColor: severityColor(alert.severity) },
                  ]}
                />
                <View style={styles.alertContent}>
                  <View style={styles.alertHeader}>
                    <Ionicons
                      name={severityIcon(alert.severity)}
                      size={18}
                      color={severityColor(alert.severity)}
                    />
                    <Text style={styles.alertType}>{alert.type.replace(/_/g, ' ')}</Text>
                    <Text style={styles.timeAgo}>{timeAgo(alert.createdAt)}</Text>
                  </View>

                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  <Text style={styles.alertMessage} numberOfLines={2}>
                    {alert.message}
                  </Text>

                  <View style={styles.alertActions}>
                    {alert.status === 'open' && (
                      <TouchableOpacity
                        style={styles.inlineAction}
                        onPress={() => handleAcknowledge(alert._id)}
                      >
                        <Text style={styles.inlineActionText}>Acknowledge</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.inlineAction}
                      onPress={() => handleResolve(alert._id)}
                    >
                      <Text style={[styles.inlineActionText, { color: colors.success }]}>
                        Resolve
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Card>
          )}
        />
      )}

      {/* Alert Detail Modal */}
      <Modal
        visible={!!selectedAlert}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedAlert(null)}
      >
        <ScrollView style={styles.modalContainer} contentContainerStyle={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Alert Detail</Text>
            <TouchableOpacity onPress={() => setSelectedAlert(null)} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {selectedAlert && (
            <>
              <View style={styles.detailSeverity}>
                <Ionicons
                  name={severityIcon(selectedAlert.severity)}
                  size={24}
                  color={severityColor(selectedAlert.severity)}
                />
                <StatusBadge
                  label={selectedAlert.severity}
                  variant={severityVariant(selectedAlert.severity)}
                />
                <StatusBadge label={selectedAlert.status} variant="muted" />
              </View>

              <Text style={styles.detailTitle}>{selectedAlert.title}</Text>
              <Text style={styles.detailType}>
                {selectedAlert.type.replace(/_/g, ' ')} · {timeAgo(selectedAlert.createdAt)}
              </Text>

              <Text style={styles.detailMessage}>{selectedAlert.message}</Text>

              {selectedAlert.relatedEntityType && (
                <View style={styles.relatedEntity}>
                  <Ionicons name="link-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.relatedText}>
                    Related: {selectedAlert.relatedEntityType} ({selectedAlert.relatedEntityId})
                  </Text>
                </View>
              )}

              <View style={styles.modalActions}>
                {selectedAlert.status === 'open' && (
                  <ActionButton
                    label="Acknowledge"
                    icon="eye-outline"
                    onPress={() => handleAcknowledge(selectedAlert._id)}
                    variant="secondary"
                    style={{ flex: 1 }}
                  />
                )}
                <ActionButton
                  label="Resolve"
                  icon="checkmark-circle-outline"
                  onPress={() => handleResolve(selectedAlert._id)}
                  variant="primary"
                  style={{ flex: 1 }}
                />
                <ActionButton
                  label="Dismiss"
                  icon="close-circle-outline"
                  onPress={() => handleDismiss(selectedAlert._id)}
                  variant="ghost"
                  style={{ flex: 1 }}
                />
              </View>
            </>
          )}
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  loading: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  alertCard: {
    marginBottom: spacing.sm,
    padding: 0,
    overflow: 'hidden',
  },
  alertRow: {
    flexDirection: 'row',
  },
  severityStrip: {
    width: 4,
  },
  alertContent: {
    flex: 1,
    padding: spacing.lg,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  alertType: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
    flex: 1,
  },
  timeAgo: {
    fontSize: 12,
    color: colors.textMuted,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  alertMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  alertActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inlineAction: {
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
  },
  inlineActionText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bgModal,
  },
  modalContent: {
    padding: spacing.xxl,
    paddingTop: 60,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  detailSeverity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  detailType: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  detailMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  relatedEntity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgInput,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.xl,
  },
  relatedText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
