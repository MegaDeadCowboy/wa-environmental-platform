// src/components/waterquality/WaterQualityDashboard.tsx  
// PHASE 3B COMPLETE - Using actual UI and Map components
import React, { useState } from 'react';
import { Activity } from '../icons';
import PageLayout from '../layout/PageLayout';
import type { AppHeaderProps } from '../layout/AppHeader';

// Import existing hooks
import { 
  useWaterQualityData, 
  useWaterQualityFilters 
} from '../../hooks';

// Import existing utilities
import { getRiskColor, getHealthColor } from '../../utils/colorMappings';
import { formatNumber, formatDate, formatRiskScore, formatMeasurement } from '../../utils/formatters';

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
  StationPopup,
  MapControls
} from '../map';
import type { StationData, StationAlert } from '../map';

const WaterQualityDashboard: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentTileLayer, setCurrentTileLayer] = useState<'openstreetmap' | 'satellite' | 'terrain'>('openstreetmap');
  
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

  const searchQuery = filters.searchText || '';
  const setSearchQuery = (value: string) => updateFilter('searchText', value);

  // Get parameter health summary
  const parameterHealthCounts = data.parameters?.reduce((acc, param) => {
    const status = param.statistics.health_status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // Prepare stats for StatsGrid
  const stats: StatItem[] = [
    {
      id: 'total-stations',
      label: 'Monitoring Sites',
      value: data.stations.length,
      icon: '🏞️',
      color: 'blue',
      trend: 'up',
      trendValue: '+3',
      subtitle: 'Active monitoring sites'
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
      color: 'blue',
      subtitle: 'Unique water bodies'
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

  // Handle loading state
  if (loading) {
    return (
      <div style={{ height: '100vh' }}>
        <LoadingSpinner 
          size="large" 
          theme="water" 
          message="Loading water quality data from monitoring stations..."
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
          theme="water"
          size="large"
          onRetry={refresh}
          showDetails={true}
        />
      </div>
    );
  }

  // Map water health status to AlertBadge status
  const getAlertStatus = (healthStatus: string) => {
    switch (healthStatus.toLowerCase()) {
      case 'excellent':
      case 'healthy': return 'good';
      case 'good': return 'good';
      case 'fair':
      case 'moderate': return 'moderate';
      case 'poor': return 'unhealthy';
      case 'very-poor':
      case 'unhealthy': return 'dangerous';
      case 'severe':
      case 'critical': return 'critical';
      default: return 'unknown';
    }
  };

  // Map component handlers
  const handleZoomToFit = () => {
    console.log('Zoom to fit all water stations');
  };

  // Sidebar content
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
          theme="water"
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
          theme="water" 
          size="small"
          showTrends={true}
        />
      </div>

      {/* Parameter Health Status */}
      {Object.keys(parameterHealthCounts).length > 0 && (
        <div style={{ padding: '1rem' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#374151' }}>
            Parameter Health
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {Object.entries(parameterHealthCounts).map(([status, count]) => (
              <AlertBadge
                key={status}
                status={getAlertStatus(status)}
                label={status.charAt(0).toUpperCase() + status.slice(1)}
                value={count}
                size="small"
                variant="subtle"
                clickable={count > 0}
                onClick={() => updateFilter('customFilter', status)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Active Alerts */}
      {(data.alerts?.length || 0) > 0 && (
        <div style={{ padding: '1rem' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#374151' }}>
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
                <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                  <AlertBadge
                    status="dangerous"
                    label={alert.parameter || 'Unknown Parameter'}
                    size="small"
                    variant="filled"
                  />
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                  {alert.location ? `Lat: ${alert.location.latitude}, Lng: ${alert.location.longitude}` : 'Unknown Location'}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                  Severity: {alert.severity || 'Unknown'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Water Body Types */}
      <div style={{ padding: '1rem' }}>
        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#374151' }}>
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
                  cursor: count > 0 ? 'pointer' : 'default',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  opacity: count > 0 ? 1 : 0.5
                }}
                onClick={() => count > 0 && updateFilter('customFilter', type)}
                disabled={count === 0}
              >
                <span>{type}</span>
                <span style={{ color: '#6b7280' }}>{count}</span>
              </button>
            );
          })}
        </div>
        
        {filters.customFilter && (
          <button
            onClick={() => resetFilters()}
            style={{
              marginTop: '0.5rem',
              fontSize: '0.75rem',
              color: '#3b82f6',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Clear filter
          </button>
        )}
      </div>
    </>
  );

  // Header props
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
      {/* Main Map Content - Using fixed viewport height */}
      <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
        <BaseMap
          center={[47.3, -121.5]}
          zoom={7}
          theme="water"
          tileLayer={currentTileLayer}
          height="100vh"
          width="100%"
        >
          {/* Water Quality Station Markers */}
          {filteredStations.map(station => {
            const hasAlerts = (data.alerts || []).some(alert => 
              alert.station_id === station.properties.station_id
            );
            const overallHealth = station.properties.overall_health || 'unknown';
            const markerColor = getHealthColor(overallHealth);
            
            // Convert to StationData format
            const stationData: StationData = {
              station_id: station.properties.station_id,
              station_name: station.properties.station_name || 'Unnamed Station',
              water_body_name: station.properties.water_body_name,
              water_body_type: station.properties.water_body_type,
              county: station.properties.county,
              last_sampled: station.properties.last_sampled,
              overall_health: overallHealth
            };

            // Get alerts for this station
            const stationAlerts: StationAlert[] = (data.alerts || [])
              .filter(alert => alert.station_id === station.properties.station_id)
              .map(alert => ({
                parameter: alert.parameter,
                severity: alert.severity,
                station_id: alert.station_id,
                location: alert.location
              }));

            return (
              <StationMarker
                key={station.properties.station_id}
                position={[
                  station.geometry.coordinates[1],
                  station.geometry.coordinates[0]
                ]}
                type="water-quality"
                value={hasAlerts ? '!' : '💧'}
                color={markerColor}
                isActive={true}
                hasAlert={hasAlerts}
                onClick={() => {
                  console.log('Clicked water station:', station.properties.station_name);
                }}
              >
                <StationPopup
                  station={stationData}
                  type="water-quality"
                  riskLevel={overallHealth}
                  alerts={stationAlerts}
                />
              </StationMarker>
            );
          })}
        </BaseMap>

        {/* Map Controls Overlay */}
        <MapControls
          theme="water"
          position="top-right"
          showLayerSelector={true}
          showCountyToggle={false}
          showClusterToggle={false}
          showZoomToFit={true}
          onLayerChange={setCurrentTileLayer}
          onZoomToFit={handleZoomToFit}
        />
      </div>
    </PageLayout>
  );
};

export default WaterQualityDashboard;