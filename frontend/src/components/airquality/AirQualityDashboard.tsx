// src/components/airquality/AirQualityDashboard.tsx
// PHASE 3 INTEGRATION DEMO - Shows how UI components would be used
import React, { useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Activity } from '../icons';
import PageLayout from '../layout/PageLayout';
import type { AppHeaderProps } from '../layout/AppHeader';

// Import existing hooks (already implemented)
import { 
  useAirQualityData, 
  useAirQualityFilters 
} from '../../hooks';

// Import existing utilities (already implemented)
import { 
  getCountyRiskScore, 
  getRiskLevel, 
  EPA_AQI_LEVELS, 
  getAirQualityRiskScore, 
  getRiskColorFromEntity 
} from "../../utils/riskCalculations";
import { getRiskColor } from "../../utils/colorMappings";
import { formatNumber, formatDate, formatRiskScore, formatMeasurement } from "../../utils/formatters";

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
      border: '3px solid #fde68a',
      borderTop: '3px solid #f59e0b',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }}></div>
    <p style={{ marginTop: '1rem', color: '#92400e', fontSize: '0.875rem' }}>
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
    background: '#fffbeb',
    border: '2px solid #fde68a',
    borderRadius: '8px',
    margin: '2rem'
  }}>
    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🌫️</div>
    <h3 style={{ color: '#92400e', margin: '0 0 1rem 0' }}>
      Air Quality Data Error
    </h3>
    <p style={{ color: '#7c2d12', textAlign: 'center', marginBottom: '1.5rem' }}>
      {error?.message || error || 'Unable to load air quality data'}
    </p>
    <button
      onClick={onRetry}
      style={{
        padding: '0.5rem 1rem',
        background: '#f59e0b',
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
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}
      >
        <div style={{ fontSize: '1.5rem' }}>{stat.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#92400e' }}>
            {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#78350f' }}>{stat.label}</div>
          {stat.subtitle && (
            <div style={{ fontSize: '0.75rem', color: '#a16207' }}>{stat.subtitle}</div>
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

const DemoAlertBadge: React.FC<{
  status: string, 
  label?: string, 
  value?: any, 
  size?: string, 
  variant?: string, 
  clickable?: boolean, 
  onClick?: () => void
}> = ({ status, label, value, clickable, onClick }) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'good': return { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' };
      case 'moderate': return { bg: '#fef3c7', color: '#92400e', border: '#fde68a' };
      case 'unhealthy-for-sensitive-groups': return { bg: '#fed7aa', color: '#9a3412', border: '#fdba74' };
      case 'unhealthy': return { bg: '#fecaca', color: '#991b1b', border: '#fca5a5' };
      case 'very-unhealthy': return { bg: '#fce7f3', color: '#831843', border: '#f9a8d4' };
      case 'hazardous': return { bg: '#f3e8ff', color: '#581c87', border: '#d8b4fe' };
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

const AirQualityDashboard: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const { 
    data, 
    loading, 
    error, 
    refresh, 
    lastUpdated 
  } = useAirQualityData();

  const {
    filters,
    filteredData: filteredStations,
    updateFilter,
    resetFilters,
    clearSearch
} = useAirQualityFilters(data.stations, 'county');

  // Add search state manually since the hook doesn't expose it directly
  const searchQuery = filters.searchText;
  const setSearchQuery = (value: string) => updateFilter('searchText', value);

  // Add filteredCounties manually (simple filter for now)
  const filteredCounties = data.counties || [];

  // Prepare stats for StatsGrid
  const stats = [
    {
      id: 'total-stations',
      label: 'Active Stations',
      value: data.stations.length,
      icon: '📡',
      color: 'blue',
      trend: 'up',
      trendValue: '+2'
    },
    {
      id: 'unhealthy-stations',
      label: 'Unhealthy Air',
      value: data.stations.filter(s => {
        const level = getRiskLevel(getAirQualityRiskScore(s), EPA_AQI_LEVELS);
        return level.name === 'Unhealthy';
      }).length,
      icon: '⚠️',
      color: 'red',
      trend: 'neutral'
    },
    {
      id: 'monitored-counties',
      label: 'Counties Monitored',
      value: data.counties.length,
      icon: '🗺️',
      color: 'green'
    },
    {
      id: 'avg-aqi',
      label: 'Average AQI',
      value: Math.round(data.averageAQI || 0),
      icon: '📊',
      color: 'yellow',
      subtitle: getRiskLevel(data.averageAQI || 0, EPA_AQI_LEVELS).name
    }
  ];

  // Handle loading state with Phase 3A component
  if (loading) {
    return (
      <div style={{ height: '100vh' }}>
        <DemoLoadingSpinner 
          size="large" 
          theme="air" 
          message="Loading air quality data..." 
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
          theme="air"
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
          placeholder="Search stations or counties..."
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
        <DemoStatsGrid stats={stats} theme="air" />
      </div>

      {/* Risk Level Filter using Phase 3A components */}
      <div style={{ padding: '1rem' }}>
        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#374151' }}>
          Risk Levels
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {(['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous'] as const).map(levelName => {
            const count = data.stations.filter(s => {
              const level = getRiskLevel(getAirQualityRiskScore(s), EPA_AQI_LEVELS);
              return level.name === levelName;
            }).length;
            
            return (
              <DemoAlertBadge
                key={levelName}
                status={levelName.toLowerCase().replace(/\s+/g, '-')}
                label={levelName}
                value={count}
                clickable={true}
                onClick={() => {
                  // You'll need to implement risk level filtering in your hook
                  console.log(`Filter by ${levelName}`);
                }}
              />
            );
          })}
        </div>
      </div>

      {/* County List */}
      <div style={{ padding: '1rem' }}>
        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#374151' }}>
          Counties ({filteredCounties.length})
        </h4>
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {filteredCounties.slice(0, 10).map(county => {
            const riskScore = getCountyRiskScore(county);
            const riskLevel = getRiskLevel(riskScore, EPA_AQI_LEVELS);
            
            return (
              <div
                key={county.properties.county_name || county.properties.fips_code}
                style={{
                  padding: '0.5rem',
                  borderBottom: '1px solid #f3f4f6',
                  cursor: 'pointer',
                  fontSize: '0.8125rem'
                }}
                onClick={() => updateFilter('customFilter', county.properties.county_name)}
              >
                <div style={{ fontWeight: '500' }}>
                  {county.properties.county_name}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                  Risk: {riskScore > 0 ? `${Math.round(riskScore)} (${riskLevel.name})` : 'N/A'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );

  // Header props using existing interface
  const headerProps: AppHeaderProps = {
    title: 'Air Quality Monitoring',
    subtitle: `${data.stations.length} stations monitored • Updated ${lastUpdated ? formatDate(lastUpdated) : 'recently'}`,
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
      theme="air-quality"
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

          {/* County Boundaries */}
          {filteredCounties.map((county, index) => (
            <GeoJSON
              key={`county-${county.properties.county_name || county.properties.fips_code || index}`}
              data={county}
              style={{
                fillColor: getRiskColorFromEntity(county),
                fillOpacity: 0.1,
                color: getRiskColorFromEntity(county),
                weight: 2,
                opacity: 0.8
              }}
            />
          ))}

          {/* Station Markers */}
          {filteredStations.map(station => {
            const riskScore = getAirQualityRiskScore(station);
            const riskColor = getRiskColorFromEntity(station);
            const riskLevel = getRiskLevel(riskScore, EPA_AQI_LEVELS);
            
            // Create custom icon
            const customIcon = L.divIcon({
              className: 'risk-score-marker',
              html: `
                <div style="
                  width: 24px; 
                  height: 24px; 
                  border-radius: 50%; 
                  background-color: ${riskColor}; 
                  border: 2px solid white;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-weight: bold;
                  font-size: 10px;
                  color: white;
                  text-shadow: 0 1px 1px rgba(0,0,0,0.5);
                ">
                  ${Math.round(riskScore)}
                </div>
              `,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
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
                  <div style={{ minWidth: '250px' }}>
                    <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>
                      {station.properties.station_name || 'Unnamed Station'}
                    </h3>
                    
                    <div style={{ marginBottom: '0.75rem' }}>
                      <DemoAlertBadge
                        status={riskLevel.name.toLowerCase().replace(/\s+/g, '-')}
                        label={`Risk Score: ${Math.round(riskScore)}`}
                        variant="filled"
                      />
                    </div>

                    <div style={{ fontSize: '0.875rem', lineHeight: '1.4' }}>
                      <p><strong>Location:</strong> {station.properties.location || 'Unknown'}</p>
                      <p><strong>County:</strong> {station.properties.county || 'Unknown'}</p>
                      <p><strong>Last Updated:</strong> {
                        station.properties.last_updated 
                          ? formatDate(new Date(station.properties.last_updated))
                          : 'Unknown'
                      }</p>
                      {station.properties.primary_pollutant && (
                        <p><strong>Primary Pollutant:</strong> {station.properties.primary_pollutant}</p>
                      )}
                    </div>
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

export default AirQualityDashboard;