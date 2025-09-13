// src/components/airquality/AirQualityDashboard.tsx
// PHASE 3B COMPLETE - Fixed height issue for map rendering
import React, { useState } from 'react';
import { Activity } from '../icons';
import PageLayout from '../layout/PageLayout';
import type { AppHeaderProps } from '../layout/AppHeader';

// Import existing hooks
import { 
  useAirQualityData, 
  useAirQualityFilters 
} from '../../hooks';

// Import existing utilities
import { 
  getCountyRiskScore, 
  getRiskLevel, 
  EPA_AQI_LEVELS, 
  getAirQualityRiskScore, 
  getRiskColorFromEntity 
} from "../../utils/riskCalculations";
import { formatNumber, formatDate, formatRiskScore, formatMeasurement } from "../../utils/formatters";

// Import Phase 3A UI Components
import { 
  LoadingSpinner, 
  ErrorMessage, 
  StatsGrid, 
  AlertBadge, 
  RefreshButton 
} from '../ui';
import type { StatItem } from '../ui';

// Import Phase 3B Map Components
import { 
  BaseMap, 
  StationMarker, 
  CountyBoundaries, 
  StationPopup,
  MapControls
} from '../map';
import type { StationData, StationAlert } from '../map';

const AirQualityDashboard: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showCounties, setShowCounties] = useState(true);
  const [currentTileLayer, setCurrentTileLayer] = useState<'openstreetmap' | 'satellite' | 'terrain'>('openstreetmap');
  
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

  const searchQuery = filters.searchText || '';
  const setSearchQuery = (value: string) => updateFilter('searchText', value);
  const filteredCounties = showCounties ? (data.counties || []) : [];

  // Prepare stats for StatsGrid
  const stats: StatItem[] = [
    {
      id: 'total-stations',
      label: 'Active Stations',
      value: data.stations.length,
      icon: '📡',
      color: 'blue',
      trend: 'up',
      trendValue: '+2',
      subtitle: 'EPA monitoring sites'
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
      trend: 'neutral',
      subtitle: 'Areas to avoid'
    },
    {
      id: 'monitored-counties',
      label: 'Counties Monitored',
      value: data.counties.length,
      icon: '🗺️',
      color: 'green',
      subtitle: 'Statewide coverage'
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

  // Handle loading state
  if (loading) {
    return (
      <div style={{ height: '100vh' }}>
        <LoadingSpinner 
          size="large" 
          theme="air" 
          message="Loading air quality data from EPA monitoring stations..."
        />
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ErrorMessage 
          error={error}
          theme="air"
          size="large"
          onRetry={refresh}
          showDetails={true}
        />
      </div>
    );
  }

  // Map component handlers
  const handleCountyClick = (county: any) => {
    updateFilter('customFilter', county.properties.county_name);
  };

  const handleZoomToFit = () => {
    console.log('Zoom to fit all stations');
  };

  // Sidebar content
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
        {searchQuery && (
          <button
            onClick={() => clearSearch()}
            style={{
              marginTop: '0.5rem',
              fontSize: '0.75rem',
              color: '#6b7280',
              background: 'none',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Clear search
          </button>
        )}
      </div>

      {/* Refresh Control */}
      <div style={{ padding: '0 1rem' }}>
        <RefreshButton
          onRefresh={refresh}
          isLoading={loading}
          lastUpdated={lastUpdated}
          theme="air"
          size="small"
          showLastUpdated={true}
          cooldownSeconds={5}
        />
      </div>

      {/* Stats Grid */}
      <div style={{ padding: '0 1rem' }}>
        <h3 style={{ margin: '1rem 0', fontSize: '1rem', color: '#374151' }}>
          Overview
        </h3>
        <StatsGrid 
          stats={stats} 
          columns={1}
          theme="air" 
          size="small"
          showTrends={true}
        />
      </div>

      {/* Risk Level Filter */}
      <div style={{ padding: '1rem' }}>
        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#374151' }}>
          Risk Levels
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {(['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous'] as const).map(levelName => {
            const count = data.stations.filter(s => {
              const level = getRiskLevel(getAirQualityRiskScore(s), EPA_AQI_LEVELS);
              return level.name === levelName;
            }).length;
            
            const getAlertStatus = (level: string) => {
              switch (level) {
                case 'Good': return 'good';
                case 'Moderate': return 'moderate';
                case 'Unhealthy for Sensitive Groups': return 'unhealthy';
                case 'Unhealthy': return 'dangerous';
                case 'Very Unhealthy': return 'critical';
                case 'Hazardous': return 'critical';
                default: return 'unknown';
              }
            };
            
            return (
              <AlertBadge
                key={levelName}
                status={getAlertStatus(levelName)}
                label={levelName}
                value={count}
                size="small"
                variant="subtle"
                clickable={count > 0}
                onClick={() => {
                  console.log(`Filter by ${levelName}`);
                }}
              />
            );
          })}
        </div>
      </div>

      {/* County List */}
      <div style={{ padding: '1rem' }}>
        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#374151' }}>
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
                  fontSize: '0.8125rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
                onClick={() => updateFilter('customFilter', county.properties.county_name)}
              >
                <div>
                  <div style={{ fontWeight: '500' }}>
                    {county.properties.county_name}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                    {riskScore > 0 ? `Risk: ${Math.round(riskScore)}` : 'No data'}
                  </div>
                </div>
                {riskScore > 0 && (
                  <AlertBadge
                    status={riskLevel.name === 'Good' ? 'good' : 
                           riskLevel.name === 'Moderate' ? 'moderate' : 'unhealthy'}
                    label=""
                    size="small"
                    variant="outline"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );

  // Header props
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
      {/* Main Map Content - Using fixed viewport height */}
      <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
        <BaseMap
          center={[47.3, -121.5]}
          zoom={7}
          theme="air"
          tileLayer={currentTileLayer}
          height="100vh"
          width="100%"
        >
          {/* County Boundaries */}
          <CountyBoundaries
            counties={filteredCounties}
            getRiskColor={getRiskColorFromEntity}
            onCountyClick={handleCountyClick}
            onCountyHover={(county) => {
              console.log('Hovering over:', county.properties.county_name);
            }}
          />

          {/* Air Quality Station Markers */}
          {filteredStations.map(station => {
            const riskScore = getAirQualityRiskScore(station);
            const riskColor = getRiskColorFromEntity(station);
            const riskLevel = getRiskLevel(riskScore, EPA_AQI_LEVELS);
            
            const stationData: StationData = {
              station_id: station.properties.station_id,
              station_name: station.properties.station_name || station.properties.name,
              location: station.properties.location,
              county: station.properties.county,
              parameter_name: station.properties.parameter_name,
              agency: station.properties.agency,
              active: station.properties.active,
              last_updated: station.properties.last_updated,
              primary_pollutant: station.properties.primary_pollutant
            };

            return (
              <StationMarker
                key={station.properties.station_id}
                position={[
                  station.geometry.coordinates[1],
                  station.geometry.coordinates[0]
                ]}
                type="air-quality"
                value={Math.round(riskScore)}
                color={riskColor}
                isActive={station.properties.active}
                hasAlert={false}
                onClick={() => {
                  console.log('Clicked station:', station.properties.station_name);
                }}
              >
                <StationPopup
                  station={stationData}
                  type="air-quality"
                  riskScore={riskScore}
                  riskLevel={riskLevel.name}
                  alerts={[]}
                />
              </StationMarker>
            );
          })}
        </BaseMap>

        {/* Map Controls Overlay */}
        <MapControls
          theme="air"
          position="top-right"
          showLayerSelector={true}
          showCountyToggle={true}
          showClusterToggle={false}
          showZoomToFit={true}
          onLayerChange={setCurrentTileLayer}
          onToggleCounties={setShowCounties}
          onZoomToFit={handleZoomToFit}
        />
      </div>
    </PageLayout>
  );
};

export default AirQualityDashboard;