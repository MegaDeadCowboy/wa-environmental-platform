// src/components/layout/PageLayout.tsx
import React from 'react';
import AppHeader from './AppHeader';
import type { AppHeaderProps } from './AppHeader';
import Sidebar from './Sidebar';
import styles from './PageLayout.module.css';

export interface PageLayoutProps {
  // Header props
  headerProps: AppHeaderProps;
  
  // Sidebar props
  sidebarContent: React.ReactNode;
  sidebarTitle?: string;
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  
  // Main content
  children: React.ReactNode;
  
  // Optional styling
  className?: string;
  theme?: 'air-quality' | 'water-quality' | 'default';
}

const PageLayout: React.FC<PageLayoutProps> = ({
  headerProps,
  sidebarContent,
  sidebarTitle,
  sidebarCollapsed,
  onSidebarToggle,
  children,
  className = '',
  theme = 'default',
}) => {
  const layoutClass = `${styles.layout} ${styles[`theme-${theme}`]} ${className}`;

  return (
    <div className={layoutClass}>
      {/* Header */}
      <AppHeader {...headerProps} />

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={onSidebarToggle}
          title={sidebarTitle}
          className={styles.sidebar}
        >
          {sidebarContent}
        </Sidebar>

        {/* Content Area */}
        <main className={styles.contentArea}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default PageLayout;