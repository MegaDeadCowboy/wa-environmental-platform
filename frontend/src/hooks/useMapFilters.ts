// src/hooks/useMapFilters.ts
import { useState, useMemo, useCallback } from 'react';

// Generic filter interface that can work for both air and water quality
export interface FilterState {
  status: 'all' | 'active' | 'inactive';
  searchText: string;
  customFilter?: string; // For domain-specific filters like water body type
}

export interface UseMapFiltersReturn<T> {
  filters: FilterState;
  filteredData: T[];
  updateFilter: (key: keyof FilterState, value: string) => void;
  resetFilters: () => void;
  clearSearch: () => void;
}

// Generic station interface for filtering
export interface FilterableStation {
  properties: {
    active: boolean;
    name: string;
    [key: string]: any; // Allow additional properties
  };
}

const DEFAULT_FILTERS: FilterState = {
  status: 'all',
  searchText: '',
  customFilter: 'all'
};

/**
 * Custom hook for managing map filters and filtering data
 * @param data - Array of data to filter (stations, etc.)
 * @param customFilterKey - Key to use for custom filtering (e.g., 'water_body_type')
 * @returns Filter state and filtered data
 */
export const useMapFilters = <T extends FilterableStation>(
  data: T[] = [],
  customFilterKey?: string
): UseMapFiltersReturn<T> => {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // Update a specific filter
  const updateFilter = useCallback((key: keyof FilterState, value: string): void => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  // Reset all filters to default
  const resetFilters = useCallback((): void => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  // Clear search text only
  const clearSearch = useCallback((): void => {
    setFilters(prev => ({
      ...prev,
      searchText: ''
    }));
  }, []);

  // Memoized filtered data
  const filteredData = useMemo((): T[] => {
    return data.filter(item => {
      // Status filter
      if (filters.status === 'active' && !item.properties.active) {
        return false;
      }
      if (filters.status === 'inactive' && item.properties.active) {
        return false;
      }

      // Search text filter (searches station name)
      if (filters.searchText && filters.searchText.trim() !== '') {
        const searchLower = filters.searchText.toLowerCase();
        const name = item.properties.name?.toLowerCase() || '';
        if (!name.includes(searchLower)) {
          return false;
        }
      }

      // Custom filter (e.g., water body type)
      if (customFilterKey && filters.customFilter && filters.customFilter !== 'all') {
        const customValue = (item.properties as any)[customFilterKey];
        if (customValue !== filters.customFilter) {
          return false;
        }
      }

      return true;
    });
  }, [data, filters, customFilterKey]);

  return {
    filters,
    filteredData,
    updateFilter,
    resetFilters,
    clearSearch
  };
};

/**
 * Specialized hook for air quality station filtering
 */
export const useAirQualityFilters = (stations: any[] = [], customFilterKey?: string) => {
  return useMapFilters(stations, customFilterKey);
};

/**
 * Specialized hook for water quality station filtering
 */
export const useWaterQualityFilters = (stations: any[] = []) => {
  return useMapFilters(stations, 'water_body_type');
};

export default useMapFilters;