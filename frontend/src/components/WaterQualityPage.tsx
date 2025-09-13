// src/components/WaterQualityPage.tsx
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Simple inline SVG icons
const Droplets = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.19 3 12.25c0 2.22 1.8 4.05 4 4.05z"></path>
    <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2.04 4.6 4.14 5.93a3.83 3.83 0 0 1 1.81 3.45c0 2.22-1.8 4.05-4 4.05-1.33 0-2.57-.64-3.39-1.8"></path>
  </svg>
);

const Activity = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"></polyline>
  </svg>
);

const AlertTriangle = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

const TrendingUp = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"></polyline>
    <polyline points="17,6 23,6 23,12"></polyline>
  </svg>
);

const RefreshCw = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <polyline points="23,4 23,10 17,10"></polyline>
    <polyline points="1,20 1,14 7,14"></polyline>
    <path d="m20.49,9a9,9,0,0,0-17.49,3a9,9,0,0,0,17.49,3"></path>
  </svg>
);

const Filter = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3"></polygon>
  </svg>
);

// Types for water quality data
interface WaterQualityStation {
  type: 'Feature';
  properties: {
    station_id: string;
    name: string;
    agency: string;
    active: boolean;
    county: string;
    water_body_name: string;
    water_body_type: string;
    huc_code: string;
    usgs_site_no: string;
    last_measurement_date?: string;
    measurement_count: number;
    data_provider: string;
    site_type: string;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

interface WaterQualityParameter {
  parameter: string;
  unit: string;
  measurement_count: number;
  station_count: number;
  statistics: {
    average?: number;
    minimum?: number;
    maximum?: number;
    health_status: string;
  };
  date_range: {
    earliest?: string;
    latest?: string;
  };
}

interface WaterQualityAlert {
  alert_id: string;
  station_id: string;
  station_name: string;
  parameter: string;
  value: number;
  unit: string;
  measurement_date: string;
  location: {
    longitude: number;
    latitude: number;
  };
  county: string;
  severity: string;
  message: string;
  alert_generated: string;
}

const WaterQualityPage: React.FC = () => {
  const [stations, setStations] = useState<WaterQualityStation[]>([]);
  const [parameters, setParameters] = useState<WaterQualityParameter[]>([]);
  const [alerts, setAlerts] = useState<WaterQualityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedWaterBodyType, setSelectedWaterBodyType] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Fetch all water quality data
  const fetchWaterQualityData = async () => {
    try {
      setRefreshing(true);
      console.log('Fetching water quality data...');
      
      // Fetch stations
      const stationsResponse = await fetch('http://localhost:5000/api/water-quality/stations');
      if (!stationsResponse.ok) throw new Error(`Stations API error: ${stationsResponse.status}`);
      const stationsData = await stationsResponse.json();
      
      // Fetch parameters
      const parametersResponse = await fetch('http://localhost:5000/api/water-quality/parameters');
      if (!parametersResponse.ok) throw new Error(`Parameters API error: ${parametersResponse.status}`);
      const parametersData = await parametersResponse.json();
      
      // Fetch alerts
      const alertsResponse = await fetch('http://localhost:5000/api/water-quality/alerts?days=30');
      if (!alertsResponse.ok) throw new Error(`Alerts API error: ${alertsResponse.status}`);
      const alertsData = await alertsResponse.json();

      setStations(stationsData.features || []);
      setParameters(parametersData.parameters || []);
      setAlerts(alertsData.alerts || []);
      setLastUpdated(new Date());
      
      console.log('Water quality data loaded successfully!');
      console.log(`Stations: ${stationsData.features?.length || 0}`);
      console.log(`Parameters: ${parametersData.parameters?.length || 0}`);
      console.log(`Alerts: ${alertsData.alerts?.length || 0}`);
      
    } catch (err) {
      console.error('Error fetching water quality data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load water quality data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWaterQualityData();
  }, []);

  // Filter stations based on selected filters
  const filteredStations = stations.filter(station => {
    if (selectedFilter === 'active' && !station.properties.active) return false;
    if (selectedFilter === 'alerts' && !alerts.some(alert => alert.station_id === station.properties.station_id)) return false;
    if (selectedWaterBodyType !== 'all' && station.properties.water_body_type !== selectedWaterBodyType) return false;
    return true;
  });

  // Get unique water body types
  const waterBodyTypes = [...new Set(stations.map(s => s.properties.water_body_type))].filter(Boolean);

  // Create custom marker for water quality stations
  const createWaterStationIcon = (station: WaterQualityStation): L.DivIcon => {
    const hasAlert = alerts.some(alert => alert.station_id === station.properties.station_id);
    const alertSeverity = hasAlert ? alerts.find(alert => alert.station_id === station.properties.station_id)?.severity : null;
    
    let color = '#3b82f6'; // Default blue for water
    let borderColor = 'white';
    
    if (alertSeverity === 'CRITICAL') {
      color = '#dc2626';
      borderColor = '#fecaca';
    } else if (alertSeverity === 'WARNING') {
      color = '#f59e0b';
      borderColor = '#fcd34d';
    }
    
    const measurementCount = station.properties.measurement_count || 0;
    const displayText = measurementCount > 999 ? '999+' : measurementCount.toString();
    
    return L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div style="
          width: 28px; 
          height: 28px; 
          border-radius: 50%; 
          background-color: ${color}; 
          border: 3px solid ${borderColor};
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 10px;
          color: white;
          position: relative;
        ">
          ${displayText}
          ${hasAlert ? `<div style="
            position: absolute;
            top: -2px;
            right: -2px;
            width: 8px;
            height: 8px;
            background-color: ${alertSeverity === 'CRITICAL' ? '#dc2626' : '#f59e0b'};
            border-radius: 50%;
            border: 1px solid white;
          "></div>` : ''}
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
  };

  // Get parameter health status color
  const getParameterStatusColor = (status: string): string => {
    switch (status) {
      case 'GOOD': return '#22c55e';
      case 'CONCERNING': return '#f59e0b';
      case 'LOW': return '#ef4444';
      case 'ELEVATED': return '#f97316';
      default: return '#6b7280';
    }
  };

  // Get alert severity color
  const getAlertSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'CRITICAL': return '#dc2626';
      case 'WARNING': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  // Calculate statistics
  const totalMeasurements = parameters.reduce((sum, p) => sum + p.measurement_count, 0);
  const activeStations = stations.filter(s => s.properties.active).length;
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL').length;

  // Loading state
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh', 
        backgroundColor: '#f0f8ff' 
      }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{
            border: '4px solid #bfdbfe',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            width: '64px',
            height: '64px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1e40af', marginBottom: '0.5rem' }}>
            Loading Water Quality Data
          </h2>
          <p style={{ color: '#1e40af' }}>
            Connecting to USGS and water monitoring networks...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh', 
        backgroundColor: '#f0f8ff' 
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '0.5rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          maxWidth: '28rem',
          width: '100%',
          margin: '0 1rem'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              backgroundColor: '#fef2f2',
              borderRadius: '50%',
              padding: '0.75rem',
              width: '4rem',
              height: '4rem',
              margin: '0 auto 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AlertTriangle className="text-red-600" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
              Connection Error
            </h2>
            <p style={{ color: '#4b5563', marginBottom: '1rem' }}>{error}</p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
              Make sure the water quality API endpoints are available
            </p>
            <button 
              onClick={fetchWaterQualityData}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '0.5rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main water quality dashboard
  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      backgroundColor: '#f0f8ff',
      overflow: 'hidden',
      width: '100vw'
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #bfdbfe',
        boxShadow: '0 1px 2px 0 rgba(59, 130, 246, 0.05)',
        flexShrink: 0,
        zIndex: 10,
        width: '100%'
      }}>
        <div style={{
          width: '100%',
          margin: '0',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#1e40af',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              margin: 0,
              marginBottom: '0.25rem'
            }}>
              <Droplets />
              Washington State Water Quality Monitoring
            </h1>
            <p style={{ color: '#3b82f6', margin: 0, fontSize: '0.875rem' }}>
              Real-time water quality data from USGS and state monitoring networks
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <button
              onClick={fetchWaterQualityData}
              disabled={refreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'white',
                backgroundColor: refreshing ? '#9ca3af' : '#3b82f6',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: refreshing ? 'not-allowed' : 'pointer'
              }}
            >
              <RefreshCw className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Updating...' : 'Refresh Data'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{ 
        display: 'flex', 
        flex: 1, 
        minHeight: 0, 
        overflow: 'hidden',
        width: '100%'
      }}>
        {/* Sidebar */}
        <div style={{
          width: sidebarCollapsed ? '60px' : '280px',
          backgroundColor: 'white',
          borderRight: '1px solid #bfdbfe',
          boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.3s ease',
          flexShrink: 0,
          zIndex: 5,
          overflowY: 'auto',
          maxWidth: '280px'
        }}>
          {/* Collapse Toggle */}
          <div style={{
            padding: '1rem',
            borderBottom: '1px solid #bfdbfe',
            display: 'flex',
            justifyContent: sidebarCollapsed ? 'center' : 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}>
            {!sidebarCollapsed && (
              <h2 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e40af', margin: 0 }}>
                Water Quality Dashboard
              </h2>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{
                padding: '0.5rem',
                backgroundColor: '#eff6ff',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d={sidebarCollapsed ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"} />
              </svg>
            </button>
          </div>

          {!sidebarCollapsed && (
            <>
              {/* Stats Overview */}
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #bfdbfe', flexShrink: 0 }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.75rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{
                    backgroundColor: '#eff6ff',
                    padding: '0.75rem',
                    borderRadius: '0.5rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.25rem'
                    }}>
                      <Droplets />
                      <span style={{
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        color: '#3b82f6'
                      }}>
                        {stations.length}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '0.75rem',
                      color: '#1e40af',
                      margin: 0
                    }}>
                      Water Stations
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: '#f0fdf4',
                    padding: '0.75rem',
                    borderRadius: '0.5rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.25rem'
                    }}>
                      <Activity />
                      <span style={{
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        color: '#059669'
                      }}>
                        {activeStations}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '0.75rem',
                      color: '#065f46',
                      margin: 0
                    }}>
                      Active
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: '#fefce8',
                    padding: '0.75rem',
                    borderRadius: '0.5rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.25rem'
                    }}>
                      <TrendingUp />
                      <span style={{
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        color: '#d97706'
                      }}>
                        {totalMeasurements.toLocaleString()}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '0.75rem',
                      color: '#92400e',
                      margin: 0
                    }}>
                      Measurements
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: criticalAlerts > 0 ? '#fef2f2' : '#f3f4f6',
                    padding: '0.75rem',
                    borderRadius: '0.5rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.25rem'
                    }}>
                      <AlertTriangle />
                      <span style={{
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        color: criticalAlerts > 0 ? '#dc2626' : '#6b7280'
                      }}>
                        {alerts.length}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '0.75rem',
                      color: criticalAlerts > 0 ? '#991b1b' : '#4b5563',
                      margin: 0
                    }}>
                      Alerts
                    </p>
                  </div>
                </div>

                {/* Data Freshness */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#22c55e',
                    animation: 'pulse 2s ease-in-out infinite'
                  }} />
                  <span style={{
                    fontSize: '0.75rem',
                    color: '#6b7280'
                  }}>
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {/* Filters */}
              <div style={{
                padding: '1rem',
                borderBottom: '1px solid #bfdbfe',
                flexShrink: 0
              }}>
                <h3 style={{
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#1e40af',
                  margin: '0 0 0.5rem 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Filter />
                  Station Filters
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="filter"
                      value="all"
                      checked={selectedFilter === 'all'}
                      onChange={(e) => setSelectedFilter(e.target.value)}
                      style={{ marginRight: '0.5rem' }}
                    />
                    <span style={{ fontSize: '0.75rem' }}>All Stations ({stations.length})</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="filter"
                      value="active"
                      checked={selectedFilter === 'active'}
                      onChange={(e) => setSelectedFilter(e.target.value)}
                      style={{ marginRight: '0.5rem' }}
                    />
                    <span style={{ fontSize: '0.75rem' }}>Active Only ({activeStations})</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="filter"
                      value="alerts"
                      checked={selectedFilter === 'alerts'}
                      onChange={(e) => setSelectedFilter(e.target.value)}
                      style={{ marginRight: '0.5rem' }}
                    />
                    <span style={{ fontSize: '0.75rem' }}>With Alerts ({alerts.length})</span>
                  </label>
                </div>

                <h4 style={{
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: '#1e40af',
                  margin: '0 0 0.5rem 0'
                }}>
                  Water Body Type
                </h4>
                <select
                  value={selectedWaterBodyType}
                  onChange={(e) => setSelectedWaterBodyType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #bfdbfe',
                    backgroundColor: 'white',
                    fontSize: '0.75rem'
                  }}
                >
                  <option value="all">All Water Bodies</option>
                  {waterBodyTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Parameters Status */}
              <div style={{
                padding: '1rem',
                borderBottom: '1px solid #bfdbfe',
                flexShrink: 0
              }}>
                <h3 style={{
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#1e40af',
                  margin: '0 0 0.5rem 0'
                }}>
                  Parameter Status
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {parameters.slice(0, 6).map((param) => (
                    <div key={param.parameter} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.375rem',
                      backgroundColor: '#f8fafc',
                      borderRadius: '0.25rem'
                    }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: getParameterStatusColor(param.statistics.health_status),
                        flexShrink: 0
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: '0.625rem',
                          fontWeight: '500',
                          color: '#1e40af',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {param.parameter}
                        </p>
                        <p style={{
                          fontSize: '0.5rem',
                          color: '#6b7280',
                          margin: 0
                        }}>
                          {param.station_count} stations
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Alerts */}
              <div style={{
                padding: '1rem',
                flex: 1,
                overflowY: 'auto'
              }}>
                <h3 style={{
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#1e40af',
                  margin: '0 0 0.5rem 0'
                }}>
                  Recent Alerts
                </h3>
                {alerts.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {alerts.slice(0, 5).map((alert) => (
                      <div key={alert.alert_id} style={{
                        backgroundColor: alert.severity === 'CRITICAL' ? '#fef2f2' : '#fffbeb',
                        padding: '0.5rem',
                        borderRadius: '0.375rem',
                        border: `1px solid ${alert.severity === 'CRITICAL' ? '#fecaca' : '#fed7aa'}`
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '0.25rem'
                        }}>
                          <span style={{
                            fontSize: '0.625rem',
                            padding: '0.125rem 0.375rem',
                            borderRadius: '0.25rem',
                            color: 'white',
                            fontWeight: '500',
                            backgroundColor: getAlertSeverityColor(alert.severity)
                          }}>
                            {alert.severity}
                          </span>
                          <span style={{
                            fontSize: '0.5rem',
                            color: '#6b7280'
                          }}>
                            {new Date(alert.measurement_date).toLocaleDateString()}
                          </span>
                        </div>
                        <p style={{
                          fontSize: '0.625rem',
                          fontWeight: '500',
                          color: '#111827',
                          margin: '0 0 0.125rem 0',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {alert.station_name}
                        </p>
                        <p style={{
                          fontSize: '0.5rem',
                          color: '#4b5563',
                          margin: 0
                        }}>
                          {alert.parameter}: {alert.value} {alert.unit}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    margin: 0,
                    fontStyle: 'italic'
                  }}>
                    No recent alerts
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Map Container */}
        <div style={{ 
          flex: 1, 
          position: 'relative', 
          minWidth: 0,
          height: '100%',
          overflow: 'hidden'
        }}>
          <MapContainer
            center={[47.3, -121.5]}
            zoom={7}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Water Quality Monitoring Stations */}
            {filteredStations.map((station) => {
              const stationAlerts = alerts.filter(alert => alert.station_id === station.properties.station_id);
              
              return (
                <Marker
                  key={station.properties.station_id}
                  position={[station.geometry.coordinates[1], station.geometry.coordinates[0]]}
                  icon={createWaterStationIcon(station)}
                >
                  <Popup>
                    <div style={{ padding: '1rem', minWidth: '300px' }}>
                      <div style={{
                        borderBottom: '1px solid #bfdbfe',
                        paddingBottom: '0.75rem',
                        marginBottom: '0.75rem'
                      }}>
                        <h3 style={{
                          fontWeight: 'bold',
                          fontSize: '1.125rem',
                          color: '#1e40af',
                          margin: '0 0 0.25rem 0'
                        }}>
                          {station.properties.name}
                        </h3>
                        <p style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          fontFamily: 'monospace',
                          margin: 0
                        }}>
                          ID: {station.properties.station_id}
                        </p>
                        {station.properties.usgs_site_no && (
                          <p style={{
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            fontFamily: 'monospace',
                            margin: 0
                          }}>
                            USGS: {station.properties.usgs_site_no}
                          </p>
                        )}
                      </div>
                      
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        fontSize: '0.875rem',
                        marginBottom: '1rem'
                      }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '0.75rem'
                        }}>
                          <span style={{ color: '#4b5563' }}>Location:</span>
                          <span style={{ fontWeight: '500' }}>{station.properties.county}</span>
                        </div>
                        
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '0.75rem'
                        }}>
                          <span style={{ color: '#4b5563' }}>Water Body:</span>
                          <span style={{ fontWeight: '500' }}>{station.properties.water_body_name}</span>
                        </div>
                        
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '0.75rem'
                        }}>
                          <span style={{ color: '#4b5563' }}>Type:</span>
                          <span style={{ fontWeight: '500' }}>{station.properties.water_body_type}</span>
                        </div>
                        
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '0.75rem'
                        }}>
                          <span style={{ color: '#4b5563' }}>Agency:</span>
                          <span style={{ fontWeight: '500' }}>{station.properties.agency}</span>
                        </div>
                        
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '0.75rem'
                        }}>
                          <span style={{ color: '#4b5563' }}>Status:</span>
                          <span style={{
                            fontWeight: '500',
                            color: station.properties.active ? '#059669' : '#dc2626'
                          }}>
                            {station.properties.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '0.75rem'
                        }}>
                          <span style={{ color: '#4b5563' }}>Measurements:</span>
                          <span style={{ fontWeight: '500' }}>{station.properties.measurement_count.toLocaleString()}</span>
                        </div>
                        
                        {station.properties.last_measurement_date && (
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '0.75rem'
                          }}>
                            <span style={{ color: '#4b5563' }}>Last Data:</span>
                            <span style={{ fontWeight: '500' }}>
                              {new Date(station.properties.last_measurement_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {stationAlerts.length > 0 && (
                        <div style={{
                          backgroundColor: '#fef2f2',
                          borderRadius: '0.5rem',
                          padding: '1rem',
                          border: '1px solid #fecaca'
                        }}>
                          <h4 style={{
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: '#dc2626',
                            margin: '0 0 0.5rem 0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            <AlertTriangle />
                            Active Alerts ({stationAlerts.length})
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            {stationAlerts.slice(0, 3).map((alert, index) => (
                              <div key={index} style={{
                                fontSize: '0.75rem',
                                padding: '0.375rem',
                                backgroundColor: 'white',
                                borderRadius: '0.25rem',
                                border: '1px solid #fecaca'
                              }}>
                                <div style={{ fontWeight: '500', color: '#dc2626' }}>
                                  {alert.severity}: {alert.parameter}
                                </div>
                                <div style={{ color: '#6b7280', fontSize: '0.625rem' }}>
                                  {alert.value} {alert.unit} - {new Date(alert.measurement_date).toLocaleDateString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default WaterQualityPage;