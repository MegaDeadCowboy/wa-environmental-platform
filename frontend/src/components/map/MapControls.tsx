// src/components/map/MapControls.tsx
import React, { useState } from 'react';

interface MapControlsProps {
  onLayerChange?: (layer: 'openstreetmap' | 'satellite' | 'terrain') => void;
  onToggleCounties?: (show: boolean) => void;
  onToggleClustering?: (enabled: boolean) => void;
  onZoomToFit?: () => void;
  showLayerSelector?: boolean;
  showCountyToggle?: boolean;
  showClusterToggle?: boolean;
  showZoomToFit?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  theme?: 'air' | 'water' | 'default';
  className?: string;
}

const MapControls: React.FC<MapControlsProps> = ({
  onLayerChange,
  onToggleCounties,
  onToggleClustering,
  onZoomToFit,
  showLayerSelector = true,
  showCountyToggle = true,
  showClusterToggle = false,
  showZoomToFit = true,
  position = 'top-right',
  theme = 'default',
  className
}) => {
  const [currentLayer, setCurrentLayer] = useState<'openstreetmap' | 'satellite' | 'terrain'>('openstreetmap');
  const [showCounties, setShowCounties] = useState(true);
  const [clusteringEnabled, setClusteringEnabled] = useState(false);

  const handleLayerChange = (layer: 'openstreetmap' | 'satellite' | 'terrain') => {
    setCurrentLayer(layer);
    onLayerChange?.(layer);
  };

  const handleCountyToggle = () => {
    const newValue = !showCounties;
    setShowCounties(newValue);
    onToggleCounties?.(newValue);
  };

  const handleClusterToggle = () => {
    const newValue = !clusteringEnabled;
    setClusteringEnabled(newValue);
    onToggleClustering?.(newValue);
  };

  const getPositionStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      position: 'absolute',
      zIndex: 1000,
      padding: '0.5rem',
    };

    switch (position) {
      case 'top-left':
        return { ...baseStyles, top: '10px', left: '10px' };
      case 'top-right':
        return { ...baseStyles, top: '10px', right: '10px' };
      case 'bottom-left':
        return { ...baseStyles, bottom: '10px', left: '10px' };
      case 'bottom-right':
        return { ...baseStyles, bottom: '10px', right: '10px' };
      default:
        return { ...baseStyles, top: '10px', right: '10px' };
    }
  };

  const getThemeColors = () => {
    switch (theme) {
      case 'air':
        return {
          background: 'rgba(254, 252, 191, 0.95)',
          border: '#fde68a',
          button: '#f59e0b',
          buttonHover: '#d97706',
          text: '#92400e'
        };
      case 'water':
        return {
          background: 'rgba(239, 246, 255, 0.95)',
          border: '#bfdbfe',
          button: '#3b82f6',
          buttonHover: '#2563eb',
          text: '#1e40af'
        };
      default:
        return {
          background: 'rgba(255, 255, 255, 0.95)',
          border: '#e5e7eb',
          button: '#6b7280',
          buttonHover: '#4b5563',
          text: '#374151'
        };
    }
  };

  const colors = getThemeColors();

  const controlPanelStyle: React.CSSProperties = {
    ...getPositionStyles(),
    background: colors.background,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    minWidth: '150px'
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.375rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: '500',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    color: 'white'
  };

  const activeButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: colors.button
  };

  const inactiveButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#9ca3af',
    opacity: 0.8
  };

  const selectStyle: React.CSSProperties = {
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
    border: `1px solid ${colors.border}`,
    borderRadius: '4px',
    backgroundColor: 'white',
    color: colors.text
  };

  return (
    <div style={controlPanelStyle} className={className}>
      {/* Layer Selector */}
      {showLayerSelector && (
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: '500', color: colors.text, marginBottom: '0.25rem', display: 'block' }}>
            Map Layer
          </label>
          <select
            value={currentLayer}
            onChange={(e) => handleLayerChange(e.target.value as any)}
            style={selectStyle}
          >
            <option value="openstreetmap">Street Map</option>
            <option value="satellite">Satellite</option>
            <option value="terrain">Terrain</option>
          </select>
        </div>
      )}

      {/* County Toggle */}
      {showCountyToggle && (
        <button
          onClick={handleCountyToggle}
          style={showCounties ? activeButtonStyle : inactiveButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.buttonHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = showCounties ? colors.button : '#9ca3af';
          }}
        >
          {showCounties ? 'Hide Counties' : 'Show Counties'}
        </button>
      )}

      {/* Clustering Toggle */}
      {showClusterToggle && (
        <button
          onClick={handleClusterToggle}
          style={clusteringEnabled ? activeButtonStyle : inactiveButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.buttonHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = clusteringEnabled ? colors.button : '#9ca3af';
          }}
        >
          {clusteringEnabled ? 'Disable Clustering' : 'Enable Clustering'}
        </button>
      )}

      {/* Zoom to Fit */}
      {showZoomToFit && (
        <button
          onClick={onZoomToFit}
          style={inactiveButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.buttonHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#9ca3af';
          }}
        >
          Zoom to Fit
        </button>
      )}
    </div>
  );
};

export default MapControls;