/**
 * CCS Operations — Dark theme for warehouse use.
 * Large-target friendly, high-contrast status colors.
 */

export const colors = {
  // Backgrounds
  bg: '#0a0a0a',
  bgCard: '#141414',
  bgCardHover: '#1a1a1a',
  bgInput: '#1c1c1e',
  bgModal: '#1c1c1e',

  // Borders
  border: '#2a2a2a',
  borderFocused: '#3b82f6',

  // Text
  text: '#f5f5f5',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  textInverse: '#0a0a0a',

  // Status colors — warehouse-optimized high contrast
  critical: '#ef4444',
  criticalBg: '#451a1a',
  warning: '#f97316',
  warningBg: '#431f07',
  success: '#22c55e',
  successBg: '#0a2e14',
  info: '#3b82f6',
  infoBg: '#0c1e3d',

  // Priority colors
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#6b7280',

  // Accent
  primary: '#3b82f6',
  primaryDark: '#1d4ed8',

  // PO Status colors
  draft: '#6b7280',
  submitted: '#3b82f6',
  confirmed: '#8b5cf6',
  shipped: '#f97316',
  received: '#22c55e',
  cancelled: '#ef4444',
} as const;

export const severityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return colors.critical;
    case 'warning': return colors.warning;
    case 'info': return colors.info;
    default: return colors.textSecondary;
  }
};

export const priorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return colors.urgent;
    case 'high': return colors.high;
    case 'medium': return colors.medium;
    case 'low': return colors.low;
    default: return colors.textSecondary;
  }
};

export const poStatusColor = (status: string) => {
  switch (status) {
    case 'draft': return colors.draft;
    case 'submitted': return colors.submitted;
    case 'confirmed': return colors.confirmed;
    case 'shipped': return colors.shipped;
    case 'received': return colors.received;
    case 'cancelled': return colors.cancelled;
    default: return colors.textSecondary;
  }
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Minimum touch target for gloved warehouse use */
export const TOUCH_TARGET = 48;
