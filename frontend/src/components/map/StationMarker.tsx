// src/components/map/StationMarker.tsx
import React from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';

interface StationMarkerProps {
  position: [number, number];
  type: 'air-quality' | 'water-quality';
  status?: string;
  value?: number | string;
  color?: string;
  isActive?: boolean;
  hasAlert?: boolean;
  onClick?: () => void;
  children?: React.ReactNode; // For Popup content
  className?: string;
}

/**
 * Create custom DivIcon for stations with risk scores or health status
 */
const createStationIcon = (
  type: 'air-quality' | 'water-quality',
  options: {
    value?: number | string;
    color?: string;
    isActive?: boolean;
    hasAlert?: boolean;
    size?: number;
  }
): L.DivIcon => {
  const {
    value = '',
    color = '#6b7280',
    isActive = true,
    hasAlert = false,
    size = type === 'air-quality' ? 26 : 20
  } = options;

  const opacity = isActive ? 1 : 0.6;
  const pulseAnimation = hasAlert ? 'animation: pulse 2s infinite;' : '';
  
  // Different styling based on station type
  const iconContent = type === 'air-quality' 
    ? `
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
        opacity: ${opacity};
        ${pulseAnimation}
      ">
        ${value}
      </div>
    `
    : `
      <div style="
        width: ${size}px; 
        height: ${size}px; 
        border-radius: 50%; 
        background-color: ${color}; 
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 12px;
        font-weight: bold;
        opacity: ${opacity};
        ${pulseAnimation}
      ">
        ${hasAlert ? '!' : '💧'}
      </div>
    `;

  const keyframes = hasAlert ? `
    <style>
      @keyframes pulse {
        0% { transform: scale(1); opacity: ${opacity}; }
        50% { transform: scale(1.2); opacity: ${opacity * 0.7}; }
        100% { transform: scale(1); opacity: ${opacity}; }
      }
    </style>
  ` : '';

  return L.divIcon({
    className: `${type}-marker ${hasAlert ? 'alert' : ''} ${isActive ? 'active' : 'inactive'}`,
    html: iconContent + keyframes,
    iconSize: [size + 6, size + 6], // Account for border
    iconAnchor: [(size + 6) / 2, (size + 6) / 2]
  });
};

const StationMarker: React.FC<StationMarkerProps> = ({
  position,
  type,
  status,
  value,
  color,
  isActive = true,
  hasAlert = false,
  onClick,
  children,
  className
}) => {
  const customIcon = createStationIcon(type, {
    value,
    color,
    isActive,
    hasAlert
  });

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <Marker
      position={position}
      icon={customIcon}
      eventHandlers={{
        click: handleClick
      }}
    >
      {children}
    </Marker>
  );
};

export default StationMarker;