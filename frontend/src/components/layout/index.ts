// src/components/layout/index.ts

// Export all layout components
export { default as AppHeader } from './AppHeader';
export { default as Sidebar } from './Sidebar';
export { default as PageLayout } from './PageLayout';
// export { default as SidebarToggle } from './SidebarToggle';

// Export types if needed
export type { AppHeaderProps } from './AppHeader';
export type { SidebarProps } from './Sidebar';
export type { PageLayoutProps } from './PageLayout';

// Re-export common layout utilities
export interface LayoutTheme {
  air: 'air';
  water: 'water';
  default: 'default';
}