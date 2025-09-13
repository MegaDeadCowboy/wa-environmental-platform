// src/components/map/index.ts
// Export all map components for easy importing

export { default as BaseMap } from './BaseMap';
export { default as StationMarker } from './StationMarker';
export { default as CountyBoundaries } from './CountyBoundaries';
export { default as StationPopup } from './StationPopup';
export { default as MapControls } from './MapControls';

// Type exports
export interface MapComponentProps {
  className?: string;
  theme?: 'air' | 'water' | 'default';
}

export interface StationData {
  station_id?: string;
  station_name?: string;
  name?: string;
  location?: string;
  county?: string;
  water_body_name?: string;
  water_body_type?: string;
  parameter_name?: string;
  agency?: string;
  active?: boolean;
  last_updated?: string | Date;
  last_sampled?: string | Date;
  primary_pollutant?: string;
  overall_health?: string;
  [key: string]: any;
}

export interface StationAlert {
  parameter?: string;
  severity?: string;
  station_id?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}