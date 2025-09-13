// src/hooks/useWaterQualityData.ts
import { useState, useEffect, useCallback } from 'react';
import L from 'leaflet';

// Water Quality Data Types
export interface WaterQualityStation {
  type: 'Feature';
  properties: {
    station_id: string;
    name: string;
    agency: string;
    active: boolean;
    county: string;
    water_body_name: string;
    water_body_type: string;
    huc_code: string;
    usgs_site_no: string;
    last_measurement_date?: string;
    measurement_count: number;
    data_provider: string;
    site_type: string;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

export interface WaterQualityParameter {
  parameter: string;
  unit: string;
  measurement_count: number;
  station_count: number;
  statistics: {
    average?: number;
    minimum?: number;
    maximum?: number;
    health_status: string;
  };
  date_range: {
    earliest?: string;
    latest?: string;
  };
}

export interface WaterQualityAlert {
  alert_id: string;
  station_id: string;
  station_name: string;
  parameter: string;
  value: number;
  unit: string;
  measurement_date: string;
  location: {
    longitude: number;
    latitude: number;
  };
  county: string;
  severity: string;
  message: string;
  alert_generated: string;
}

export interface WaterQualityData {
  stations: WaterQualityStation[];
  parameters: WaterQualityParameter[];
  alerts: WaterQualityAlert[];
}

export interface UseWaterQualityDataReturn {
  data: WaterQualityData;
  loading: boolean;
  error: string | null;
  lastUpdated: Date;
  refresh: () => Promise<void>;
  refreshing: boolean;
}

// API Base URL - could be moved to env config later
const API_BASE_URL = 'http://localhost:5000/api/water-quality';

/**
 * Custom hook for managing water quality data
 * Handles all API calls, loading states, error handling, and data refresh
 */
export const useWaterQualityData = (): UseWaterQualityDataReturn => {
  // State management
  const [data, setData] = useState<WaterQualityData>({
    stations: [],
    parameters: [],
    alerts: []
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Fetch water quality data from Flask API
  const fetchWaterQualityData = useCallback(async (): Promise<void> => {
    try {
      // Set refreshing state (but not loading if it's a refresh)
      if (!loading) {
        setRefreshing(true);
      }
      
      console.log('Fetching water quality data...');
      
      // Fetch stations
      const stationsResponse = await fetch(`${API_BASE_URL}/stations`);
      if (!stationsResponse.ok) {
        throw new Error(`Stations API error: ${stationsResponse.status}`);
      }
      const stationsData = await stationsResponse.json();
      console.log('Water quality stations loaded:', stationsData.features?.length || 0);
      
      // Fetch parameters
      const parametersResponse = await fetch(`${API_BASE_URL}/parameters`);
      if (!parametersResponse.ok) {
        throw new Error(`Parameters API error: ${parametersResponse.status}`);
      }
      const parametersData = await parametersResponse.json();
      console.log('Water quality parameters loaded:', parametersData.parameters?.length || 0);
      
      // Fetch alerts
      const alertsResponse = await fetch(`${API_BASE_URL}/alerts?days=30`);
      if (!alertsResponse.ok) {
        throw new Error(`Alerts API error: ${alertsResponse.status}`);
      }
      const alertsData = await alertsResponse.json();
      console.log('Water quality alerts loaded:', alertsData.alerts?.length || 0);

      // Update state with fetched data
      setData({
        stations: stationsData.features || [],
        parameters: parametersData.parameters || [],
        alerts: alertsData.alerts || []
      });
      
      setLastUpdated(new Date());
      setError(null); // Clear any previous errors
      console.log('Water quality data loaded successfully!');
      
    } catch (err) {
      console.error('Error fetching water quality data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch water quality data';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []); // Remove 'loading' dependency to prevent recreation

  // Refresh function that can be called externally
  const refresh = useCallback(async (): Promise<void> => {
    await fetchWaterQualityData();
  }, [fetchWaterQualityData]);

  // Initial data fetch on mount - only run once
  useEffect(() => {
    fetchWaterQualityData();
  }, []); // Empty dependency array ensures this only runs once

  // Return hook interface
  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh,
    refreshing
  };
};

/**
 * Utility function to get health status color
 * @param status - Health status string (good, moderate, poor, critical)
 * @returns Color hex code for the health status
 */
export const getHealthStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'good': return '#10b981';      // Green
    case 'moderate': return '#f59e0b';  // Yellow
    case 'poor': return '#ef4444';      // Red
    case 'critical': return '#dc2626';  // Dark Red
    default: return '#6b7280';          // Gray
  }
};

/**
 * Utility function to create station icon based on status
 * @param station - Water quality station data
 * @returns Leaflet DivIcon for the station
 */
export const createWaterStationIcon = (station: WaterQualityStation): L.DivIcon => {
  const isActive = station.properties.active;
  const color = isActive ? '#3b82f6' : '#9ca3af';
  
  return L.divIcon({
    html: `<div style="
      background-color: ${color};
      border: 2px solid white;
      border-radius: 50%;
      width: 12px;
      height: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    className: 'custom-station-marker',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -6]
  });
};

/**
 * Utility function to filter stations based on criteria
 * @param stations - Array of water quality stations
 * @param statusFilter - Filter by status ('all', 'active', 'inactive')
 * @param waterBodyTypeFilter - Filter by water body type
 * @returns Filtered array of stations
 */
export const filterWaterStations = (
  stations: WaterQualityStation[],
  statusFilter: string = 'all',
  waterBodyTypeFilter: string = 'all'
): WaterQualityStation[] => {
  return stations.filter(station => {
    if (statusFilter === 'active' && !station.properties.active) return false;
    if (statusFilter === 'inactive' && station.properties.active) return false;
    if (waterBodyTypeFilter !== 'all' && station.properties.water_body_type !== waterBodyTypeFilter) return false;
    return true;
  });
};

/**
 * Utility function to get unique water body types
 * @param stations - Array of water quality stations
 * @returns Array of unique water body types
 */
export const getWaterBodyTypes = (stations: WaterQualityStation[]): string[] => {
  return Array.from(new Set(stations.map(s => s.properties.water_body_type))).filter(Boolean);
};

/**
 * Utility function to get alerts for a specific station
 * @param stationId - Station ID to look up
 * @param alerts - Array of water quality alerts
 * @returns Array of alerts for the station
 */
export const getStationAlerts = (stationId: string, alerts: WaterQualityAlert[]): WaterQualityAlert[] => {
  return alerts.filter(alert => alert.station_id === stationId);
};

export default useWaterQualityData;