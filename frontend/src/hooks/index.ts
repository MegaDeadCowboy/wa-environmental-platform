// src/hooks/index.ts
// Export all custom hooks for easy importing

// Data Management Hooks
export { 
  useAirQualityData,
  getRiskScore,
  getRiskColor,
  createStationIcon,
  type County,
  type Station,
  type RiskScore,
  type AirQualityData,
  type UseAirQualityDataReturn
} from './useAirQualityData';

export {
  useWaterQualityData,
  getHealthStatusColor,
  createWaterStationIcon,
  filterWaterStations,
  getWaterBodyTypes,
  getStationAlerts,
  type WaterQualityStation,
  type WaterQualityParameter,
  type WaterQualityAlert,
  type WaterQualityData,
  type UseWaterQualityDataReturn
} from './useWaterQualityData';

// Filter Management Hooks
export {
  useMapFilters,
  useAirQualityFilters,
  useWaterQualityFilters,
  type FilterState,
  type UseMapFiltersReturn,
  type FilterableStation
} from './useMapFilters';

// LocalStorage Hooks
export {
  useLocalStorage,
  useSidebarState,
  useDashboardPreferences,
  useAirQualityFilterPreferences,
  useWaterQualityFilterPreferences,
  clearAllPreferences,
  type DashboardPreferences,
  type AirQualityFilterPreferences,
  type WaterQualityFilterPreferences
} from './useLocalStorage';