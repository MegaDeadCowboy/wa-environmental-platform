// src/components/map/BaseMap.tsx
import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface BaseMapProps {
  center?: LatLngExpression;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  height?: string | number;
  width?: string | number;
  className?: string;
  children?: React.ReactNode;
  theme?: 'air' | 'water' | 'default';
  tileLayer?: 'openstreetmap' | 'satellite' | 'terrain';
}

// Common map configurations
const MAP_CONFIG = {
  defaultCenter: [47.3, -121.5] as LatLngExpression, // Washington State center
  defaultZoom: 7,
  minZoom: 5,
  maxZoom: 18,
  maxBounds: [
    [45.5, -125.0], // Southwest corner
    [49.5, -116.0]  // Northeast corner
  ] as [[number, number], [number, number]]
};

// Tile layer configurations
const TILE_LAYERS = {
  openstreetmap: {
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

const BaseMap: React.FC<BaseMapProps> = ({
  center = MAP_CONFIG.defaultCenter,
  zoom = MAP_CONFIG.defaultZoom,
  minZoom = MAP_CONFIG.minZoom,
  maxZoom = MAP_CONFIG.maxZoom,
  height = '100%',
  width = '100%',
  className = '',
  children,
  theme = 'default',
  tileLayer = 'openstreetmap'
}) => {
  const selectedTileLayer = TILE_LAYERS[tileLayer];
  
  const mapStyle: React.CSSProperties = {
    height,
    width,
    borderRadius: theme === 'air' ? '8px' : theme === 'water' ? '12px' : '6px',
    border: theme === 'air' ? '2px solid #fde68a' : theme === 'water' ? '2px solid #bfdbfe' : '1px solid #e5e7eb'
  };

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      minZoom={minZoom}
      maxZoom={maxZoom}
      maxBounds={MAP_CONFIG.maxBounds}
      style={mapStyle}
      className={`base-map ${theme}-theme ${className}`}
      scrollWheelZoom={true}
      zoomControl={true}
    >
      <TileLayer
        url={selectedTileLayer.url}
        attribution={selectedTileLayer.attribution}
        maxZoom={maxZoom}
      />
      {children}
    </MapContainer>
  );
};

export default BaseMap;