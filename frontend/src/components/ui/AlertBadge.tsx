// src/components/ui/AlertBadge.tsx
import React from 'react';
import styles from './AlertBadge.module.css';

interface AlertBadgeProps {
  status: 'good' | 'moderate' | 'unhealthy' | 'dangerous' | 'critical' | 'unknown';
  label?: string;
  value?: string | number;
  size?: 'small' | 'medium' | 'large';
  variant?: 'filled' | 'outline' | 'subtle';
  showIcon?: boolean;
  clickable?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}

const AlertBadge: React.FC<AlertBadgeProps> = ({
  status,
  label,
  value,
  size = 'medium',
  variant = 'filled',
  showIcon = true,
  clickable = false,
  onClick,
  ariaLabel
}) => {
  const getStatusIcon = (status: AlertBadgeProps['status']) => {
    switch (status) {
      case 'good': return '✓';
      case 'moderate': return '⚠';
      case 'unhealthy': return '⚠';
      case 'dangerous': return '⚠';
      case 'critical': return '⚠';
      case 'unknown': return '?';
      default: return '?';
    }
  };

  const getStatusLabel = (status: AlertBadgeProps['status']) => {
    switch (status) {
      case 'good': return 'Good';
      case 'moderate': return 'Moderate';
      case 'unhealthy': return 'Unhealthy';
      case 'dangerous': return 'Dangerous';
      case 'critical': return 'Critical';
      case 'unknown': return 'Unknown';
      default: return 'Unknown';
    }
  };

  const displayLabel = label || getStatusLabel(status);
  const accessibilityLabel = ariaLabel || `${displayLabel}${value ? `: ${value}` : ''}`;

  const handleClick = () => {
    if (clickable && onClick) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (clickable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <span
      className={`${styles.badge} ${styles[status]} ${styles[size]} ${styles[variant]} ${
        clickable ? styles.clickable : ''
      }`}
      role={clickable ? 'button' : 'status'}
      tabIndex={clickable ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={accessibilityLabel}
      title={accessibilityLabel}
    >
      {showIcon && (
        <span className={styles.icon} aria-hidden="true">
          {getStatusIcon(status)}
        </span>
      )}
      
      <span className={styles.content}>
        <span className={styles.label}>
          {displayLabel}
        </span>
        
        {value && (
          <span className={styles.value}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
        )}
      </span>
    </span>
  );
};

export default AlertBadge;