import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  FlatList,
  TextInput,
  Alert,
  TouchableOpacity,
  Modal,
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
import { Scanner } from '../../src/components/Scanner';
import { colors, spacing, priorityColor, TOUCH_TARGET } from '../../src/theme/colors';

function priorityVariant(p: string) {
  if (p === 'urgent') return 'critical' as const;
  if (p === 'high') return 'warning' as const;
  return 'muted' as const;
}

function formatDueDate(ts: number | null | undefined) {
  if (!ts) return null;
  const d = new Date(ts);
  const now = Date.now();
  const diffMs = ts - now;
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs < 0) {
    const overdue = Math.abs(diffHours);
    if (overdue < 24) return `${Math.round(overdue)}h overdue`;
    return `${Math.round(overdue / 24)}d overdue`;
  }
  if (diffHours < 24) return `Due in ${Math.round(diffHours)}h`;
  return `Due ${d.toLocaleDateString()}`;
}

export default function TasksScreen() {
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);

  const tasks = useQuery(api.agent.tasks.getPending);
  const completeTask = useMutation(api.agent.tasks.complete);
  const updateTask = useMutation(api.agent.tasks.updateStatus);

  const handleComplete = async () => {
    if (!selectedTask) return;
    try {
      await completeTask({
        taskId: selectedTask._id,
        completionNotes: completionNotes || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedTask(null);
      setCompletionNotes('');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to complete task.');
    }
  };

  const handleFlagBlocked = async (task: any) => {
    Alert.alert(
      'Flag as Blocked',
      `Mark "${task.title}" as blocked?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Flag Blocked',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateTask({ taskId: task._id, status: 'blocked' });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  // Scan QR to auto-complete relevant tasks
  const handleScan = (data: string) => {
    setScannerVisible(false);
    // Try to find a task related to the scanned entity
    const match = tasks?.find(
      (t: any) =>
        t.relatedEntityId === data ||
        t.description?.includes(data)
    );
    if (match) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedTask(match);
    } else {
      Alert.alert('No Matching Task', `No pending task found for "${data}".`);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerActions}>
        <ActionButton
          label="Scan to Complete"
          icon="qr-code-outline"
          onPress={() => setScannerVisible(true)}
          variant="secondary"
          style={{ flex: 1 }}
        />
      </View>

      {!tasks ? (
        <Text style={styles.loading}>Loading tasks…</Text>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon="checkmark-done-circle-outline"
          title="All Clear"
          message="No pending tasks. The Meat Bag Director has nothing for you right now."
        />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item: any) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item: task }: { item: any }) => {
            const isOverdue = task.dueDate && task.dueDate < Date.now();
            const dueStr = formatDueDate(task.dueDate);

            return (
              <Card style={styles.taskCard}>
                {/* Priority & Category */}
                <View style={styles.taskHeader}>
                  <View style={styles.taskTags}>
                    <StatusBadge
                      label={task.priority}
                      variant={priorityVariant(task.priority)}
                    />
                    <StatusBadge label={task.category} variant="info" />
                  </View>
                  {dueStr && (
                    <Text
                      style={[
                        styles.dueDate,
                        isOverdue && { color: colors.critical },
                      ]}
                    >
                      {dueStr}
                    </Text>
                  )}
                </View>

                {/* Title & Description */}
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskDescription} numberOfLines={3}>
                  {task.description}
                </Text>

                {/* Related Entity */}
                {task.relatedEntityType && (
                  <View style={styles.relatedRow}>
                    <Ionicons name="link-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.relatedText}>
                      {task.relatedEntityType}: {task.relatedEntityId}
                    </Text>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.taskActions}>
                  <ActionButton
                    label="Complete"
                    icon="checkmark-outline"
                    onPress={() => {
                      setSelectedTask(task);
                      setCompletionNotes('');
                    }}
                    variant="primary"
                    style={{ flex: 1 }}
                  />
                  <ActionButton
                    label="Blocked"
                    icon="hand-left-outline"
                    onPress={() => handleFlagBlocked(task)}
                    variant="ghost"
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* Completion Modal */}
      <Modal
        visible={!!selectedTask}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedTask(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Complete Task</Text>
            <TouchableOpacity
              onPress={() => setSelectedTask(null)}
              hitSlop={12}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalTaskTitle}>{selectedTask?.title}</Text>
          <Text style={styles.modalTaskDesc}>{selectedTask?.description}</Text>

          <Text style={styles.notesLabel}>Completion Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={completionNotes}
            onChangeText={setCompletionNotes}
            placeholder="What was done? Any issues?"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
          />

          <ActionButton
            label="Mark Complete"
            icon="checkmark-circle-outline"
            onPress={handleComplete}
            variant="primary"
            style={{ marginTop: spacing.xl }}
          />
        </View>
      </Modal>

      <Scanner
        visible={scannerVisible}
        onScan={handleScan}
        onClose={() => setScannerVisible(false)}
        title="Scan to Complete Task"
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
  loading: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  taskCard: {
    marginBottom: spacing.md,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  taskTags: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dueDate: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  taskDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  relatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  relatedText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  taskActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bgModal,
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
  modalTaskTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalTaskDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.xxl,
  },
  notesLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  notesInput: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.lg,
    color: colors.text,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
