import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, TOUCH_TARGET } from '../theme/colors';

// ── Status Badge ──────────────────────────────────────────────

type BadgeVariant = 'critical' | 'warning' | 'success' | 'info' | 'muted';

const badgeColors: Record<BadgeVariant, { bg: string; text: string }> = {
  critical: { bg: colors.criticalBg, text: colors.critical },
  warning: { bg: colors.warningBg, text: colors.warning },
  success: { bg: colors.successBg, text: colors.success },
  info: { bg: colors.infoBg, text: colors.info },
  muted: { bg: colors.bgInput, text: colors.textMuted },
};

export function StatusBadge({
  label,
  variant = 'muted',
  style,
}: {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}) {
  const c = badgeColors[variant];
  return (
    <View style={[badgeStyles.badge, { backgroundColor: c.bg }, style]}>
      <Text style={[badgeStyles.text, { color: c.text }]}>{label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

// ── Action Button ─────────────────────────────────────────────

export function ActionButton({
  label,
  icon,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const bg =
    variant === 'primary' ? colors.primary :
    variant === 'danger' ? colors.critical :
    variant === 'ghost' ? 'transparent' :
    colors.bgInput;
  const textColor =
    variant === 'ghost' ? colors.primary :
    variant === 'secondary' ? colors.text :
    '#fff';
  const borderColor = variant === 'ghost' ? colors.border : bg;

  return (
    <TouchableOpacity
      style={[
        actionStyles.button,
        { backgroundColor: bg, borderColor },
        variant === 'ghost' && actionStyles.ghost,
        disabled && actionStyles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={18}
          color={textColor}
          style={{ marginRight: spacing.sm }}
        />
      )}
      <Text style={[actionStyles.label, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const actionStyles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 10,
    borderWidth: 1,
  },
  ghost: {
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
});

// ── Card ──────────────────────────────────────────────────────

export function Card({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[cardStyles.card, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {children}
    </Wrapper>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
});

// ── Stat Card ─────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  icon,
  color = colors.primary,
  onPress,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color?: string;
  onPress?: () => void;
}) {
  return (
    <Card onPress={onPress} style={statStyles.card}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </Card>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

// ── Empty State ───────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  message,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message: string;
}) {
  return (
    <View style={emptyStyles.container}>
      <Ionicons name={icon} size={48} color={colors.textMuted} />
      <Text style={emptyStyles.title}>{title}</Text>
      <Text style={emptyStyles.message}>{message}</Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
    gap: spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  message: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});

// ── Section Header ────────────────────────────────────────────

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={sectionStyles.header}>
      <Text style={sectionStyles.title}>{title}</Text>
      {action && onAction && (
        <TouchableOpacity onPress={onAction} hitSlop={12}>
          <Text style={sectionStyles.action}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.xxl,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  action: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
});
