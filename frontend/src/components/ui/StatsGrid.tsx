// src/components/ui/StatsGrid.tsx
import React from 'react';
import styles from './StatsGrid.module.css';

interface StatItem {
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

interface StatsGridProps {
  stats: StatItem[];
  columns?: 1 | 2 | 3 | 4;
  theme?: 'air' | 'water' | 'default';
  size?: 'small' | 'medium' | 'large';
  showTrends?: boolean;
}

const StatsGrid: React.FC<StatsGridProps> = ({
  stats,
  columns = 2,
  theme = 'default',
  size = 'medium',
  showTrends = true
}) => {
  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      case 'neutral': return '→';
      default: return '';
    }
  };

  const formatValue = (value: string | number): string => {
    if (typeof value === 'number') {
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
      }
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return value.toLocaleString();
    }
    return value;
  };

  return (
    <div 
      className={`${styles.grid} ${styles[`columns${columns}`]} ${styles[size]} ${styles[theme]}`}
      role="grid"
      aria-label="Environmental statistics"
    >
      {stats.map((stat) => (
        <div
          key={stat.id}
          className={`${styles.card} ${stat.color ? styles[stat.color] : ''} ${
            stat.clickable ? styles.clickable : ''
          }`}
          role="gridcell"
          onClick={stat.clickable ? stat.onClick : undefined}
          tabIndex={stat.clickable ? 0 : undefined}
          onKeyDown={
            stat.clickable
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    stat.onClick?.();
                  }
                }
              : undefined
          }
        >
          {stat.icon && (
            <div className={styles.icon} aria-hidden="true">
              {stat.icon}
            </div>
          )}
          
          <div className={styles.content}>
            <div className={styles.valueContainer}>
              <div className={styles.value} title={stat.value.toString()}>
                {formatValue(stat.value)}
              </div>
              
              {showTrends && stat.trend && (
                <div className={`${styles.trend} ${styles[stat.trend]}`}>
                  <span className={styles.trendIcon} aria-hidden="true">
                    {getTrendIcon(stat.trend)}
                  </span>
                  {stat.trendValue && (
                    <span className={styles.trendValue}>
                      {stat.trendValue}
                    </span>
                  )}
                </div>
              )}
            </div>
            
            <div className={styles.label} title={stat.label}>
              {stat.label}
            </div>
            
            {stat.subtitle && (
              <div className={styles.subtitle} title={stat.subtitle}>
                {stat.subtitle}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsGrid;