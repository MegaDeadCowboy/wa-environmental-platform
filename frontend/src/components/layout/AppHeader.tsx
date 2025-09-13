// src/components/layout/AppHeader.tsx
import React from 'react';
import { Activity, Info, RefreshCw } from '../icons';
import styles from './AppHeader.module.css';

export interface AppHeaderProps {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  onRefresh?: () => void;
  onInfoClick?: () => void;
  refreshing?: boolean;
  showRefreshButton?: boolean;
  showInfoButton?: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  icon = <Activity />,
  onRefresh,
  onInfoClick,
  refreshing = false,
  showRefreshButton = true,
  showInfoButton = true,
}) => {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>
            {icon}
            {title}
          </h1>
          <p className={styles.subtitle}>
            {subtitle}
          </p>
        </div>
        
        <div className={styles.actions}>
          {showInfoButton && onInfoClick && (
            <button
              onClick={onInfoClick}
              className={styles.infoButton}
              type="button"
            >
              <Info />
              About
            </button>
          )}
          
          {showRefreshButton && onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className={`${styles.refreshButton} ${refreshing ? styles.refreshing : ''}`}
              type="button"
            >
              <RefreshCw className={refreshing ? styles.spinning : ''} />
              {refreshing ? 'Updating...' : 'Refresh Data'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;