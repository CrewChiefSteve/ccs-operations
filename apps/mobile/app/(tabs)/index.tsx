import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@/convex-api';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import {
  StatCard,
  Card,
  ActionButton,
  SectionHeader,
  StatusBadge,
} from '../../src/components/ui';
import { colors, spacing, severityColor } from '../../src/theme/colors';

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [refreshing, setRefreshing] = React.useState(false);

  const overview = useQuery(api.dashboard.overview);
  const activeAlerts = useQuery(api.agent.alerts.getActive);
  const pendingTasks = useQuery(api.agent.tasks.getPending);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Convex subscriptions are real-time, so "refresh" is mostly for UX feel
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const alertCount = activeAlerts?.length ?? 0;
  const criticalAlerts = activeAlerts?.filter(
    (a: any) => a.severity === 'critical'
  ).length ?? 0;
  const taskCount = pendingTasks?.length ?? 0;
  const overdueTasks = pendingTasks?.filter(
    (t: any) => t.dueDate && t.dueDate < Date.now()
  ).length ?? 0;

  const greeting = React.useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Greeting */}
      <View style={styles.greetingRow}>
        <View>
          <Text style={styles.greeting}>
            {greeting}, {user?.firstName ?? 'Steve'}
          </Text>
          <Text style={styles.greetingSub}>CCS Operations</Text>
        </View>
      </View>

      {/* Critical Alert Banner */}
      {criticalAlerts > 0 && (
        <Card
          style={styles.criticalBanner}
          onPress={() => router.push('/(tabs)/alerts')}
        >
          <View style={styles.criticalRow}>
            <Ionicons name="alert-circle" size={20} color={colors.critical} />
            <Text style={styles.criticalText}>
              {criticalAlerts} critical alert{criticalAlerts > 1 ? 's' : ''} — tap to view
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.critical} />
          </View>
        </Card>
      )}

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <StatCard
          label="Alerts"
          value={alertCount}
          icon="warning-outline"
          color={alertCount > 0 ? colors.warning : colors.success}
          onPress={() => router.push('/(tabs)/alerts')}
        />
        <View style={{ width: spacing.md }} />
        <StatCard
          label="Tasks"
          value={taskCount}
          icon="checkmark-circle-outline"
          color={overdueTasks > 0 ? colors.critical : colors.primary}
          onPress={() => router.push('/(tabs)/tasks')}
        />
        <View style={{ width: spacing.md }} />
        <StatCard
          label="Low Stock"
          value={overview?.lowStockCount ?? '—'}
          icon="trending-down-outline"
          color={
            (overview?.lowStockCount ?? 0) > 0 ? colors.warning : colors.success
          }
        />
      </View>

      {/* Quick Actions */}
      <SectionHeader title="Quick Actions" />
      <View style={styles.quickActions}>
        <ActionButton
          label="Start Receiving"
          icon="cube-outline"
          onPress={() => router.push('/(tabs)/receive')}
          variant="primary"
          style={styles.quickActionBtn}
        />
        <ActionButton
          label="Quick Count"
          icon="calculator-outline"
          onPress={() => router.push('/(tabs)/count')}
          variant="secondary"
          style={styles.quickActionBtn}
        />
        <ActionButton
          label="Lookup Part"
          icon="search-outline"
          onPress={() => router.push('/(tabs)/component-lookup')}
          variant="secondary"
          style={styles.quickActionBtn}
        />
      </View>

      {/* Recent Alerts Preview */}
      {activeAlerts && activeAlerts.length > 0 && (
        <>
          <SectionHeader
            title="Active Alerts"
            action="View All"
            onAction={() => router.push('/(tabs)/alerts')}
          />
          {activeAlerts.slice(0, 3).map((alert: any) => (
            <Card key={alert._id} style={styles.alertCard}>
              <View style={styles.alertRow}>
                <View
                  style={[
                    styles.severityDot,
                    { backgroundColor: severityColor(alert.severity) },
                  ]}
                />
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle} numberOfLines={1}>
                    {alert.title}
                  </Text>
                  <Text style={styles.alertMessage} numberOfLines={2}>
                    {alert.message}
                  </Text>
                </View>
                <StatusBadge
                  label={alert.severity}
                  variant={
                    alert.severity === 'critical' ? 'critical' :
                    alert.severity === 'warning' ? 'warning' : 'info'
                  }
                />
              </View>
            </Card>
          ))}
        </>
      )}

      {/* Recent Tasks Preview */}
      {pendingTasks && pendingTasks.length > 0 && (
        <>
          <SectionHeader
            title="Pending Tasks"
            action="View All"
            onAction={() => router.push('/(tabs)/tasks')}
          />
          {pendingTasks.slice(0, 3).map((task: any) => (
            <Card key={task._id} style={styles.taskCard}>
              <View style={styles.taskRow}>
                <View
                  style={[
                    styles.priorityBar,
                    {
                      backgroundColor:
                        task.priority === 'urgent' ? colors.urgent :
                        task.priority === 'high' ? colors.high :
                        task.priority === 'medium' ? colors.medium :
                        colors.low,
                    },
                  ]}
                />
                <View style={styles.taskContent}>
                  <Text style={styles.taskTitle} numberOfLines={1}>
                    {task.title}
                  </Text>
                  <Text style={styles.taskMeta}>
                    {task.category} · {task.priority}
                    {task.dueDate && task.dueDate < Date.now()
                      ? ' · OVERDUE'
                      : ''}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </>
      )}

      <View style={{ height: spacing.xxxl }} />
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
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  greetingSub: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  criticalBanner: {
    backgroundColor: colors.criticalBg,
    borderColor: colors.critical,
    marginBottom: spacing.lg,
  },
  criticalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  criticalText: {
    flex: 1,
    color: colors.critical,
    fontSize: 14,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickActions: {
    gap: spacing.sm,
  },
  quickActionBtn: {
    width: '100%',
  },
  alertCard: {
    marginBottom: spacing.sm,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  alertMessage: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  taskCard: {
    marginBottom: spacing.sm,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  priorityBar: {
    width: 4,
    height: 36,
    borderRadius: 2,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  taskMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
