// src/hooks/useLocalStorage.ts
import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing localStorage with React state
 * Provides type-safe localStorage operations with automatic JSON serialization
 * 
 * Note: This hook is designed for client-side only. In Claude.ai artifacts,
 * localStorage is not available, so this will store values in memory only.
 */
export const useLocalStorage = <T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] => {
  // Get initial value from localStorage or use provided initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        return initialValue;
      }

      const item = window.localStorage?.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Set value in both state and localStorage
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function for same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Save to state
      setStoredValue(valueToStore);
      
      // Save to localStorage if available
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  // Remove value from localStorage and reset to initial value
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  // Listen for changes to localStorage from other tabs/windows
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch (error) {
          console.warn(`Error parsing localStorage value for key "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue, removeValue];
};

/**
 * Hook for storing sidebar collapsed state
 */
export const useSidebarState = () => {
  return useLocalStorage<boolean>('sidebar-collapsed', false);
};

/**
 * Hook for storing dashboard preferences
 */
export interface DashboardPreferences {
  currentDashboard: 'air-quality' | 'water-quality';
  showCountyBoundaries: boolean;
  showInfo: boolean;
}

export const useDashboardPreferences = () => {
  const defaultPreferences: DashboardPreferences = {
    currentDashboard: 'air-quality',
    showCountyBoundaries: true,
    showInfo: false
  };
  
  return useLocalStorage<DashboardPreferences>('dashboard-preferences', defaultPreferences);
};

/**
 * Hook for storing air quality filter preferences
 */
export interface AirQualityFilterPreferences {
  status: 'all' | 'active' | 'inactive';
  searchText: string;
  showRiskScores: boolean;
}

export const useAirQualityFilterPreferences = () => {
  const defaultFilters: AirQualityFilterPreferences = {
    status: 'all',
    searchText: '',
    showRiskScores: true
  };
  
  return useLocalStorage<AirQualityFilterPreferences>('air-quality-filters', defaultFilters);
};

/**
 * Hook for storing water quality filter preferences
 */
export interface WaterQualityFilterPreferences {
  status: 'all' | 'active' | 'inactive';
  waterBodyType: string;
  searchText: string;
  showAlerts: boolean;
}

export const useWaterQualityFilterPreferences = () => {
  const defaultFilters: WaterQualityFilterPreferences = {
    status: 'all',
    waterBodyType: 'all',
    searchText: '',
    showAlerts: true
  };
  
  return useLocalStorage<WaterQualityFilterPreferences>('water-quality-filters', defaultFilters);
};

/**
 * Utility function to clear all app-related localStorage
 */
export const clearAllPreferences = (): void => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const keysToRemove = [
        'sidebar-collapsed',
        'dashboard-preferences',
        'air-quality-filters',
        'water-quality-filters'
      ];
      
      keysToRemove.forEach(key => {
        window.localStorage.removeItem(key);
      });
    }
  } catch (error) {
    console.warn('Error clearing preferences:', error);
  }
};

export default useLocalStorage;