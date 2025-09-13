// src/components/layout/Sidebar.tsx
import React from 'react';
import { ChevronLeft, ChevronRight } from '../icons';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  children: React.ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  title?: string;
  width?: number;
  collapsedWidth?: number;
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  children,
  collapsed,
  onToggle,
  title,
  width = 280,
  collapsedWidth = 60,
  className = '',
}) => {
  const sidebarStyle = {
    width: collapsed ? `${collapsedWidth}px` : `${width}px`,
    maxWidth: collapsed ? `${collapsedWidth}px` : `${width}px`,
  };

  return (
    <div 
      className={`${styles.sidebar} ${className}`}
      style={sidebarStyle}
    >
      {/* Toggle Header */}
      <div className={styles.header}>
        {!collapsed && title && (
          <h2 className={styles.title}>{title}</h2>
        )}
        <button
          onClick={onToggle}
          className={styles.toggleButton}
          type="button"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </div>

      {/* Sidebar Content */}
      {!collapsed && (
        <div className={styles.content}>
          {children}
        </div>
      )}
    </div>
  );
};

export default Sidebar;