// src/components/ui/RefreshButton.tsx
import React, { useState } from 'react';
import styles from './RefreshButton.module.css';

interface RefreshButtonProps {
  onRefresh: () => void | Promise<void>;
  isLoading?: boolean;
  lastUpdated?: Date;
  theme?: 'air' | 'water' | 'default';
  size?: 'small' | 'medium' | 'large';
  showLastUpdated?: boolean;
  cooldownSeconds?: number;
}

const RefreshButton: React.FC<RefreshButtonProps> = ({
  onRefresh,
  isLoading = false,
  lastUpdated,
  theme = 'default',
  size = 'medium',
  showLastUpdated = true,
  cooldownSeconds = 3
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cooldownActive, setCooldownActive] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing || cooldownActive || isLoading) return;

    setIsRefreshing(true);
    setCooldownActive(true);

    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
      
      // Start cooldown timer
      setTimeout(() => {
        setCooldownActive(false);
      }, cooldownSeconds * 1000);
    }
  };

  const formatLastUpdated = (date: Date): string => {
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

  const getRefreshIcon = () => {
    if (isRefreshing || isLoading) {
      return '⟳';
    }
    return '↻';
  };

  const getStatusMessage = () => {
    if (isRefreshing) return 'Refreshing...';
    if (cooldownActive) return `Wait ${cooldownSeconds}s`;
    if (isLoading) return 'Loading...';
    return 'Refresh data';
  };

  return (
    <div className={`${styles.container} ${styles[size]} ${styles[theme]}`}>
      <button
        className={`${styles.button} ${isRefreshing || cooldownActive || isLoading ? styles.disabled : ''}`}
        onClick={handleRefresh}
        disabled={isRefreshing || cooldownActive || isLoading}
        aria-label={getStatusMessage()}
        title={getStatusMessage()}
      >
        <span 
          className={`${styles.icon} ${isRefreshing || isLoading ? styles.spinning : ''}`}
          aria-hidden="true"
        >
          {getRefreshIcon()}
        </span>
        
        <span className={styles.label}>
          {size !== 'small' && getStatusMessage()}
        </span>
      </button>
      
      {showLastUpdated && lastUpdated && size !== 'small' && (
        <div className={styles.timestamp} title={lastUpdated.toLocaleString()}>
          <span className={styles.timestampLabel}>Updated:</span>
          <time dateTime={lastUpdated.toISOString()}>
            {formatLastUpdated(lastUpdated)}
          </time>
        </div>
      )}
    </div>
  );
};

export default RefreshButton;