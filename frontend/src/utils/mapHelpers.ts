// src/utils/mapHelpers.ts
// Map utility functions for Leaflet integration

import L from 'leaflet';

// Common map configurations
export const MAP_CONFIG = {
  defaultCenter: [47.3, -121.5] as [number, number], // Washington State center
  defaultZoom: 7,
  minZoom: 5,
  maxZoom: 18,
  maxBounds: [
    [45.5, -125.0], // Southwest corner
    [49.5, -116.0]  // Northeast corner
  ] as [[number, number], [number, number]]
};

// Tile layer configurations
export const TILE_LAYERS = {
  openStreetMap: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.arcgis.com/">ArcGIS</a>'
  },
  terrain: {
    url: 'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg',
    attribution: '&copy; <a href="https://stamen.com">Stamen Design</a>'
  }
};

/**
 * Create custom DivIcon for stations with risk scores
 * @param score - Risk score (0-100)
 * @param color - Background color
 * @param size - Icon size in pixels
 * @returns Leaflet DivIcon
 */
export const createRiskScoreIcon = (
  score: number | string, 
  color: string, 
  size: number = 26
): L.DivIcon => {
  return L.divIcon({
    className: 'risk-score-marker',
    html: `
      <div style="
        width: ${size}px; 
        height: ${size}px; 
        border-radius: 50%; 
        background-color: ${color}; 
        border: 3px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: ${Math.max(10, size * 0.4)}px;
        color: white;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      ">
        ${score}
      </div>
    `,
    iconSize: [size + 6, size + 6], // Account for border
    iconAnchor: [(size + 6) / 2, (size + 6) / 2]
  });
};

/**
 * Create simple colored circle marker
 * @param color - Circle color
 * @param size - Circle diameter
 * @param active - Whether to show as active/inactive
 * @returns Leaflet DivIcon
 */
export const createCircleMarker = (
  color: string, 
  size: number = 12, 
  active: boolean = true
): L.DivIcon => {
  const opacity = active ? 1 : 0.6;
  
  return L.divIcon({
    className: 'circle-marker',
    html: `
      <div style="
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        width: ${size}px;
        height: ${size}px;
        opacity: ${opacity};
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [size + 4, size + 4], // Account for border
    iconAnchor: [(size + 4) / 2, (size + 4) / 2],
    popupAnchor: [0, -(size + 4) / 2]
  });
};

/**
 * Create pulsing marker for alerts or active monitoring
 * @param color - Pulse color
 * @param size - Marker size
 * @returns Leaflet DivIcon
 */
export const createPulsingMarker = (color: string, size: number = 16): L.DivIcon => {
  return L.divIcon({
    className: 'pulsing-marker',
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
      ">
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: ${color};
          border-radius: 50%;
          opacity: 0.6;
          animation: pulse 2s infinite;
        "></div>
        <div style="
          position: absolute;
          top: 2px;
          left: 2px;
          width: ${size - 4}px;
          height: ${size - 4}px;
          background-color: ${color};
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>
      </div>
      <style>
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.5); opacity: 0.3; }
          100% { transform: scale(2); opacity: 0; }
        }
      </style>
    `,
    iconSize: [size * 2, size * 2], // Account for pulse animation
    iconAnchor: [size, size],
    popupAnchor: [0, -size]
  });
};

/**
 * Calculate distance between two coordinates in miles
 * @param lat1 - Latitude 1
 * @param lon1 - Longitude 1
 * @param lat2 - Latitude 2
 * @param lon2 - Longitude 2
 * @returns Distance in miles
 */
export const calculateDistance = (
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Find stations within radius of a point
 * @param stations - Array of station objects with coordinates
 * @param centerLat - Center latitude
 * @param centerLon - Center longitude
 * @param radiusMiles - Search radius in miles
 * @returns Filtered stations within radius
 */
export const findStationsNear = <T extends { geometry: { coordinates: [number, number] } }>(
  stations: T[],
  centerLat: number,
  centerLon: number,
  radiusMiles: number
): T[] => {
  return stations.filter(station => {
    const [lon, lat] = station.geometry.coordinates;
    const distance = calculateDistance(centerLat, centerLon, lat, lon);
    return distance <= radiusMiles;
  });
};

/**
 * Calculate bounding box for array of stations
 * @param stations - Array of stations with coordinates
 * @returns Bounding box [[south, west], [north, east]]
 */
export const calculateBounds = <T extends { geometry: { coordinates: [number, number] } }>(
  stations: T[]
): [[number, number], [number, number]] | null => {
  if (stations.length === 0) return null;
  
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  
  stations.forEach(station => {
    const [lon, lat] = station.geometry.coordinates;
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  });
  
  return [[minLat, minLon], [maxLat, maxLon]];
};

/**
 * Validate coordinates
 * @param lat - Latitude
 * @param lon - Longitude
 * @returns True if coordinates are valid
 */
export const validateCoordinates = (lat: number, lon: number): boolean => {
  return !isNaN(lat) && !isNaN(lon) && 
         lat >= -90 && lat <= 90 && 
         lon >= -180 && lon <= 180;
};

/**
 * Create popup content for stations
 * @param title - Popup title
 * @param data - Data object to display
 * @param excludeKeys - Keys to exclude from display
 * @returns HTML string for popup
 */
export const createPopupContent = (
  title: string,
  data: Record<string, any>,
  excludeKeys: string[] = []
): string => {
  const entries = Object.entries(data)
    .filter(([key]) => !excludeKeys.includes(key))
    .map(([key, value]) => {
      const label = key.replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      let displayValue = value;
      if (typeof value === 'boolean') {
        displayValue = value ? 'Yes' : 'No';
      } else if (value === null || value === undefined) {
        displayValue = 'N/A';
      } else if (typeof value === 'number') {
        displayValue = value.toLocaleString();
      }
      
      return `<p><strong>${label}:</strong> ${displayValue}</p>`;
    })
    .join('');
  
  return `
    <div style="padding: 1rem; min-width: 250px; max-width: 400px;">
      <h3 style="margin: 0 0 0.75rem 0; font-size: 1.1rem; color: #111827;">
        ${title}
      </h3>
      ${entries}
    </div>
  `;
};

/**
 * Create GeoJSON style function for polygons
 * @param options - Style options
 * @returns Leaflet style function
 */
export const createPolygonStyle = (options: {
  fillColor?: string;
  fillOpacity?: number;
  color?: string;
  weight?: number;
  opacity?: number;
} = {}) => {
  return {
    fillColor: options.fillColor || '#e5e7eb',
    fillOpacity: options.fillOpacity || 0.1,
    color: options.color || '#6b7280',
    weight: options.weight || 2,
    opacity: options.opacity || 0.8
  };
};

/**
 * Cluster markers by proximity
 * @param stations - Array of stations with coordinates
 * @param threshold - Distance threshold for clustering (miles)
 * @returns Array of clusters with stations and center coordinates
 */
export const clusterStations = <T extends { geometry: { coordinates: [number, number] } }>(
  stations: T[],
  threshold: number = 5
): Array<{ stations: T[]; center: [number, number]; count: number }> => {
  const clusters: Array<{ stations: T[]; center: [number, number]; count: number }> = [];
  const processed = new Set<number>();
  
  stations.forEach((station, index) => {
    if (processed.has(index)) return;
    
    const [lon, lat] = station.geometry.coordinates;
    const cluster = { stations: [station], center: [lat, lon] as [number, number], count: 1 };
    processed.add(index);
    
    // Find nearby stations
    stations.forEach((otherStation, otherIndex) => {
      if (processed.has(otherIndex) || index === otherIndex) return;
      
      const [otherLon, otherLat] = otherStation.geometry.coordinates;
      const distance = calculateDistance(lat, lon, otherLat, otherLon);
      
      if (distance <= threshold) {
        cluster.stations.push(otherStation);
        cluster.count++;
        processed.add(otherIndex);
        
        // Update cluster center (simple average)
        const totalLat = cluster.stations.reduce((sum, s) => sum + s.geometry.coordinates[1], 0);
        const totalLon = cluster.stations.reduce((sum, s) => sum + s.geometry.coordinates[0], 0);
        cluster.center = [totalLat / cluster.count, totalLon / cluster.count];
      }
    });
    
    clusters.push(cluster);
  });
  
  return clusters;
};

export default {
  MAP_CONFIG,
  TILE_LAYERS,
  createRiskScoreIcon,
  createCircleMarker,
  createPulsingMarker,
  calculateDistance,
  findStationsNear,
  calculateBounds,
  validateCoordinates,
  createPopupContent,
  createPolygonStyle,
  clusterStations
};