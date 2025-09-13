// src/hooks/useAirQualityData.ts
import { useState, useEffect, useCallback } from 'react';
import L from 'leaflet';

// Air Quality Data Types
export interface County {
  type: 'Feature';
  properties: {
    county_name: string;
    fips_code: string;
  };
  geometry: any;
}

export interface Station {
  type: 'Feature';
  properties: {
    station_id: string;
    name: string;
    type: string;
    agency: string;
    active: boolean;
    county: string;
    parameter_name: string;
    elevation_m?: number;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

export interface RiskScore {
  location_id: string;
  risk_score: number;
  risk_category: string;
}

export interface AirQualityData {
  counties: County[];
  stations: Station[];
  riskScores: RiskScore[];
  averageAQI: number;
  totalStations: number;
  activeStations: number;
}

export interface UseAirQualityDataReturn {
  data: AirQualityData;
  loading: boolean;
  error: string | null;
  lastUpdated: Date;
  refresh: () => Promise<void>;
  refreshing: boolean;
}

// API Base URL - could be moved to env config later
const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Calculate average AQI from risk scores
 * @param riskScores - Array of risk score objects
 * @returns Average AQI value
 */
const calculateAverageAQI = (riskScores: RiskScore[]): number => {
  if (riskScores.length === 0) return 0;
  
  const totalRiskScore = riskScores.reduce((sum, score) => sum + score.risk_score, 0);
  return totalRiskScore / riskScores.length;
};

/**
 * Calculate station statistics
 * @param stations - Array of station objects
 * @returns Object with total and active station counts
 */
const calculateStationStats = (stations: Station[]): { total: number; active: number } => {
  const total = stations.length;
  const active = stations.filter(station => station.properties.active).length;
  
  return { total, active };
};

/**
 * Custom hook for managing air quality data
 * Handles all API calls, loading states, error handling, and data refresh
 */
export const useAirQualityData = (): UseAirQualityDataReturn => {
  // State management
  const [data, setData] = useState<AirQualityData>({
    counties: [],
    stations: [],
    riskScores: [],
    averageAQI: 0,
    totalStations: 0,
    activeStations: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Fetch air quality data from Flask API
  const fetchAirQualityData = useCallback(async (): Promise<void> => {
    try {
      // Set refreshing state (but not loading if it's a refresh)
      if (!loading) {
        setRefreshing(true);
      }
      
      console.log('Fetching air quality data...');
      
      // Fetch counties
      const countiesResponse = await fetch(`${API_BASE_URL}/counties`);
      if (!countiesResponse.ok) {
        throw new Error(`Counties API error: ${countiesResponse.status}`);
      }
      const countiesData = await countiesResponse.json();
      console.log('Counties loaded:', countiesData.features?.length || 0);
      
      // Fetch monitoring stations  
      const stationsResponse = await fetch(`${API_BASE_URL}/stations`);
      if (!stationsResponse.ok) {
        throw new Error(`Stations API error: ${stationsResponse.status}`);
      }
      const stationsData = await stationsResponse.json();
      console.log('Stations loaded:', stationsData.features?.length || 0);
      
      // Fetch risk scores
      const riskResponse = await fetch(`${API_BASE_URL}/risk-scores?type=station`);
      if (!riskResponse.ok) {
        throw new Error(`Risk scores API error: ${riskResponse.status}`);
      }
      const riskData = await riskResponse.json();
      console.log('Risk scores loaded:', riskData.risk_scores?.length || 0);

      // Process fetched data
      const counties = countiesData.features || [];
      const stations = stationsData.features || [];
      const riskScores = riskData.risk_scores || [];
      
      // Calculate derived statistics
      const averageAQI = calculateAverageAQI(riskScores);
      const stationStats = calculateStationStats(stations);

      // Update state with fetched data and calculated stats
      setData({
        counties,
        stations,
        riskScores,
        averageAQI,
        totalStations: stationStats.total,
        activeStations: stationStats.active
      });
      
      setLastUpdated(new Date());
      setError(null); // Clear any previous errors
      console.log('All air quality data loaded successfully!');
      console.log(`Average AQI: ${averageAQI.toFixed(1)}, Active Stations: ${stationStats.active}/${stationStats.total}`);
      
    } catch (err) {
      console.error('Error fetching air quality data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load air quality data';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []); // Remove 'loading' dependency to prevent recreation

  // Refresh function that can be called externally
  const refresh = useCallback(async (): Promise<void> => {
    await fetchAirQualityData();
  }, [fetchAirQualityData]);

  // Initial data fetch on mount - only run once
  useEffect(() => {
    fetchAirQualityData();
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
 * Utility function to get risk score for a specific station
 * @param stationId - The station ID to look up
 * @param riskScores - Array of risk scores
 * @returns Risk score object or undefined if not found
 */
export const getRiskScore = (stationId: string, riskScores: RiskScore[]): RiskScore | undefined => {
  return riskScores.find(score => score.location_id === stationId);
};

/**
 * Utility function to get risk color based on score
 * @param riskScore - Risk score from 0-100
 * @returns Color hex code for the risk level
 */
export const getRiskColor = (riskScore: number): string => {
  if (riskScore < 25) return '#22c55e'; // Green - Good
  if (riskScore < 50) return '#eab308';  // Yellow - Moderate
  if (riskScore < 75) return '#f97316';  // Orange - Unhealthy for Sensitive
  if (riskScore < 90) return '#ef4444';  // Red - Unhealthy
  return '#991b1b';                      // Dark Red - Very Unhealthy/Hazardous
};

/**
 * Utility function to create station icon with risk score
 * @param station - Air quality station data
 * @param riskScores - Array of risk scores
 * @returns Leaflet DivIcon for the station
 */
export const createStationIcon = (station: Station, riskScores: RiskScore[]): L.DivIcon => {
  const riskScore = getRiskScore(station.properties.station_id, riskScores);
  const color = riskScore ? getRiskColor(riskScore.risk_score) : '#6b7280';
  const score = riskScore ? Math.round(riskScore.risk_score) : '?';
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        width: 26px; 
        height: 26px; 
        border-radius: 50%; 
        background-color: ${color}; 
        border: 3px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 11px;
        color: white;
      ">
        ${score}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

export default useAirQualityData;