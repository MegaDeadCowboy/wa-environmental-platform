// src/components/waterquality/WaterQualityDashboard.tsx  
// PHASE 3 INTEGRATION DEMO - Shows how UI components would be used
import React, { useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Activity } from '../icons';
import PageLayout from '../layout/PageLayout';
import type { AppHeaderProps } from '../layout/AppHeader';

// Import existing hooks (already implemented)
import { 
  useWaterQualityData, 
  useWaterQualityFilters 
} from '../../hooks';

// Import existing utilities (already implemented)
import { getRiskColor, getHealthColor } from '../../utils/colorMappings';
import { formatNumber, formatDate, formatRiskScore, formatMeasurement } from '../../utils/formatters';

// DEMO: Inline UI Components (Phase 3A components would replace these)
const DemoLoadingSpinner: React.FC<{size: string, theme: string, message: string}> = ({ message }) => (
  <div style={{ 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: '3rem',
    minHeight: '300px'
  }}>
    <div style={{
      width: '60px',
      height: '60px',
      border: '3px solid #bfdbfe',
      borderTop: '3px solid #3b82f6',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }}></div>
    <p style={{ marginTop: '1rem', color: '#1e40af', fontSize: '0.875rem' }}>
      {message}
    </p>
    <style>{`
      @keyframes spin { 
        0% { transform: rotate(0deg); } 
        100% { transform: rotate(360deg); } 
      }
    `}</style>
  </div>
);

const DemoErrorMessage: React.FC<{error: any, theme: string, size: string, onRetry: () => void}> = ({ error, onRetry }) => (
  <div style={{ 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    padding: '3rem',
    background: '#eff6ff',
    border: '2px solid #bfdbfe',
    borderRadius: '8px',
    margin: '2rem'
  }}>
    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🌊</div>
    <h3 style={{ color: '#1e40af', margin: '0 0 1rem 0' }}>
      Water Quality Data Error
    </h3>
    <p style={{ color: '#1e3a8a', textAlign: 'center', marginBottom: '1.5rem' }}>
      {error?.message || error || 'Unable to load water quality data'}
    </p>
    <button
      onClick={onRetry}
      style={{
        padding: '0.5rem 1rem',
        background: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: '500'
      }}
    >
      🔄 Try Again
    </button>
  </div>
);

const DemoStatsGrid: React.FC<{stats: any[], theme: string}> = ({ stats }) => (
  <div style={{ 
    display: 'grid', 
    gridTemplateColumns: '1fr', 
    gap: '0.75rem' 
  }}>
    {stats.map(stat => (
      <div
        key={stat.id}
        style={{
          padding: '1rem',
          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}
      >
        <div style={{ fontSize: '1.5rem' }}>{stat.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e40af' }}>
            {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#1e3a8a' }}>{stat.label}</div>
          {stat.subtitle && (
            <div style={{ fontSize: '0.75rem', color: '#3730a3' }}>{stat.subtitle}</div>
          )}
        </div>
        {stat.trend && (
          <div style={{
            padding: '0.25rem 0.5rem',
            background: stat.trend === 'up' ? '#dcfce7' : stat.trend === 'down' ? '#fee2e2' : '#f3f4f6',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: '500',
            color: stat.trend === 'up' ? '#166534' : stat.trend === 'down' ? '#991b1b' : '#374151'
          }}>
            {stat.trend === 'up' ? '↗️' : stat.trend === 'down' ? '↘️' : '→'} {stat.trendValue || ''}
          </div>
        )}
      </div>
    ))}
  </div>
);

const DemoAlertBadge: React.FC<{status: string, label?: string, value?: any, size?: string, variant?: string, clickable?: boolean, onClick?: () => void}> = ({ 
  status, label, value, clickable, onClick 
}) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'excellent':
      case 'healthy': return { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' };
      case 'good': return { bg: '#d1fae5', color: '#047857', border: '#a7f3d0' };
      case 'fair':
      case 'moderate': return { bg: '#fef3c7', color: '#92400e', border: '#fde68a' };
      case 'poor': return { bg: '#fed7aa', color: '#9a3412', border: '#fdba74' };
      case 'very-poor':
      case 'unhealthy': return { bg: '#fecaca', color: '#991b1b', border: '#fca5a5' };
      case 'severe':
      case 'critical': return { bg: '#fce7f3', color: '#831843', border: '#f9a8d4' };
      default: return { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
    }
  };

  const colors = getStatusColor(status);
  const displayLabel = label || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.25rem 0.75rem',
        background: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: '500',
        cursor: clickable ? 'pointer' : 'default'
      }}
      onClick={clickable ? onClick : undefined}
    >
      {displayLabel}
      {value !== undefined && (
        <span style={{ fontWeight: '600', marginLeft: '0.25rem' }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
      )}
    </span>
  );
};

const WaterQualityDashboard: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const { 
    data, 
    loading, 
    error, 
    refresh, 
    lastUpdated 
  } = useWaterQualityData();

  const {
    filters,
    filteredData: filteredStations,
    updateFilter,
    resetFilters,
    clearSearch
  } = useWaterQualityFilters(data.stations);

  // Add search state manually since the hook doesn't expose it directly
  const searchQuery = filters.searchText;
  const setSearchQuery = (value: string) => updateFilter('searchText', value);

  // Get parameter health summary
  const parameterHealthCounts = data.parameters?.reduce((acc, param) => {
    const status = param.statistics.health_status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // Prepare stats for StatsGrid
  const stats = [
    {
      id: 'total-stations',
      label: 'Monitoring Sites',
      value: data.stations.length,
      icon: '🏞️',
      color: 'blue',
      trend: 'up',
      trendValue: '+3'
    },
    {
      id: 'active-alerts',
      label: 'Active Alerts',
      value: data.alerts?.length || 0,
      icon: '⚠️',
      color: (data.alerts?.length || 0) > 0 ? 'red' : 'green',
      trend: (data.alerts?.length || 0) > 0 ? 'up' : 'neutral',
      subtitle: (data.alerts?.length || 0) === 0 ? 'All clear' : 'Needs attention'
    },
    {
      id: 'water-bodies',
      label: 'Water Bodies',
      value: new Set(data.stations.map(s => s.properties.water_body_name || 'Unknown')).size,
      icon: '🌊',
      color: 'blue'
    },
    {
      id: 'parameters-monitored',
      label: 'Parameters',
      value: data.parameters?.length || 0,
      icon: '🔬',
      color: 'green',
      subtitle: `${(data.parameters?.filter(p => p.statistics.health_status === 'healthy') || []).length} healthy`
    }
  ];

  // Handle loading state with Phase 3A component
  if (loading) {
    return (
      <div style={{ height: '100vh' }}>
        <DemoLoadingSpinner 
          size="large" 
          theme="water" 
          message="Loading water quality data..." 
        />
      </div>
    );
  }

  // Handle error state with Phase 3A component
  if (error) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <DemoErrorMessage 
          error={error}
          theme="water"
          size="large"
          onRetry={refresh}
        />
      </div>
    );
  }

  // Sidebar content using Phase 3A components
  const sidebarContent = (
    <>
      {/* Search Section */}
      <div style={{ padding: '1rem' }}>
        <input
          type="text"
          placeholder="Search water bodies or sites..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '0.875rem'
          }}
        />
      </div>

      {/* Stats Grid using Phase 3A component */}
      <div style={{ padding: '0 1rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#374151' }}>
          Overview
        </h3>
        <DemoStatsGrid stats={stats} theme="water" />
      </div>

      {/* Parameter Health Status */}
      {Object.keys(parameterHealthCounts).length > 0 && (
        <div style={{ padding: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#374151' }}>
            Parameter Health
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {Object.entries(parameterHealthCounts).map(([status, count]) => (
              <DemoAlertBadge
                key={status}
                status={status}
                label={status.charAt(0).toUpperCase() + status.slice(1)}
                value={count}
                clickable={true}
                onClick={() => updateFilter('customFilter', status)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Active Alerts */}
      {(data.alerts?.length || 0) > 0 && (
        <div style={{ padding: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#374151' }}>
            Active Alerts ({data.alerts?.length || 0})
          </h4>
          <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {(data.alerts || []).slice(0, 5).map((alert, index) => (
              <div
                key={index}
                style={{
                  padding: '0.5rem',
                  borderBottom: '1px solid #f3f4f6',
                  fontSize: '0.8125rem'
                }}
              >
                <div style={{ fontWeight: '500', color: '#dc2626' }}>
                  {alert.parameter || 'Unknown Parameter'}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                  {alert.location ? `Lat: ${alert.location.latitude}, Lng: ${alert.location.longitude}` : 'Unknown Location'} - {alert.severity || 'Unknown Severity'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Water Body Types */}
      <div style={{ padding: '1rem' }}>
        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#374151' }}>
          Water Body Types
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {['River', 'Lake', 'Stream', 'Reservoir', 'Bay'].map(type => {
            const count = data.stations.filter(s => 
              s.properties.water_body_type?.toLowerCase().includes(type.toLowerCase())
            ).length;
            
            return (
              <button
                key={type}
                style={{
                  padding: '0.375rem 0.5rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  background: filters.customFilter === type ? '#dbeafe' : 'white',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}
                onClick={() => updateFilter('customFilter', type)}
              >
                <span>{type}</span>
                <span style={{ color: '#6b7280' }}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );

  // Header props using existing interface
  const headerProps: AppHeaderProps = {
    title: 'Water Quality Monitoring',
    subtitle: `${data.stations.length} monitoring sites • Updated ${lastUpdated ? formatDate(lastUpdated) : 'recently'}`,
    icon: <Activity />,
    onRefresh: refresh,
    refreshing: loading
  };

  return (
    <PageLayout
      headerProps={headerProps}
      sidebarContent={sidebarContent}
      sidebarTitle="Filters & Data"
      sidebarCollapsed={sidebarCollapsed}
      onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      theme="water-quality"
    >
      {/* Main Map Content */}
      <div style={{ height: '100%', width: '100%', position: 'relative' }}>
        <MapContainer
          center={[47.3, -121.5]}
          zoom={7}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {/* Station Markers */}
          {filteredStations.map(station => {
            const hasAlerts = (data.alerts || []).some(alert => 
              alert.station_id === station.properties.station_id
            );
            const overallHealth = station.properties.overall_health || 'unknown';
            const markerColor = getHealthColor(overallHealth);
            
            // Create custom icon
            const customIcon = L.divIcon({
              className: 'water-quality-marker',
              html: `
                <div style="
                  width: 20px; 
                  height: 20px; 
                  border-radius: 50%; 
                  background-color: ${markerColor}; 
                  border: 2px solid white;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-size: 12px;
                  font-weight: bold;
                  ${hasAlerts ? 'animation: pulse 2s infinite;' : ''}
                ">
                  ${hasAlerts ? '!' : '💧'}
                </div>
                ${hasAlerts ? `
                  <style>
                    @keyframes pulse {
                      0% { transform: scale(1); opacity: 1; }
                      50% { transform: scale(1.2); opacity: 0.7; }
                      100% { transform: scale(1); opacity: 1; }
                    }
                  </style>
                ` : ''}
              `,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });

            return (
              <Marker
                key={station.properties.station_id}
                position={[
                  station.geometry.coordinates[1],
                  station.geometry.coordinates[0]
                ]}
                icon={customIcon}
              >
                <Popup>
                  <div style={{ minWidth: '280px' }}>
                    <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>
                      {station.properties.station_name || 'Unnamed Station'}
                    </h3>
                    
                    <div style={{ marginBottom: '0.75rem' }}>
                      <DemoAlertBadge
                        status={overallHealth}
                        label={`Health: ${overallHealth}`}
                        variant="filled"
                      />
                    </div>

                    <div style={{ fontSize: '0.875rem', lineHeight: '1.4' }}>
                      <p><strong>Water Body:</strong> {station.properties.water_body_name || 'Unknown'}</p>
                      <p><strong>Type:</strong> {station.properties.water_body_type || 'Unknown'}</p>
                      <p><strong>County:</strong> {station.properties.county || 'Unknown'}</p>
                      <p><strong>Last Sampled:</strong> {
                        station.properties.last_sampled 
                          ? formatDate(new Date(station.properties.last_sampled))
                          : 'Unknown'
                      }</p>
                    </div>

                    {hasAlerts && (
                      <div style={{ 
                        marginTop: '0.75rem', 
                        padding: '0.5rem', 
                        background: '#fef2f2', 
                        border: '1px solid #fecaca', 
                        borderRadius: '4px' 
                      }}>
                        <div style={{ fontWeight: '500', color: '#dc2626', fontSize: '0.875rem' }}>
                          Active Alerts
                        </div>
                        {(data.alerts || [])
                          .filter(alert => alert.station_id === station.properties.station_id)
                          .slice(0, 2)
                          .map((alert, idx) => (
                            <div key={idx} style={{ fontSize: '0.75rem', color: '#991b1b' }}>
                              {alert.parameter || 'Unknown'}: {alert.severity || 'Unknown severity'}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </PageLayout>
  );
};

export default WaterQualityDashboard;