// src/components/ui/index.ts

// Core UI Components for Environmental Dashboard
export { default as LoadingSpinner } from './LoadingSpinner';
export { default as ErrorMessage } from './ErrorMessage';
export { default as RefreshButton } from './RefreshButton';
export { default as StatsGrid } from './StatsGrid';
export { default as AlertBadge } from './AlertBadge';

// Type exports for components (these would be defined in the component files)
// export type { LoadingSpinnerProps } from './LoadingSpinner';
// export type { ErrorMessageProps } from './ErrorMessage';
// export type { RefreshButtonProps } from './RefreshButton';
// export type { StatsGridProps } from './StatsGrid';
// export type { AlertBadgeProps } from './AlertBadge';

// Export StatItem interface for StatsGrid
export interface StatItem {
  id: string;
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
  clickable?: boolean;
  onClick?: () => void;
}

// Re-export common types for convenience
export interface UITheme {
  air: 'air';
  water: 'water';
  default: 'default';
}

export interface UISize {
  small: 'small';
  medium: 'medium';
  large: 'large';
}

export interface TrendDirection {
  up: 'up';
  down: 'down';
  neutral: 'neutral';
}

export interface AlertStatus {
  good: 'good';
  moderate: 'moderate';
  unhealthy: 'unhealthy';
  dangerous: 'dangerous';
  critical: 'critical';
  unknown: 'unknown';
}

// Utility functions for UI components
export const formatStatValue = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
};

export const getTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};