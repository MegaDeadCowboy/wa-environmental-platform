// src/components/EnvironmentalMap.tsx - Fixed Layout Version
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix for default markers in React Leaflet with Vite
import markerIconPng from "leaflet/dist/images/marker-icon.png"
import markerShadowPng from "leaflet/dist/images/marker-shadow.png"
import markerIconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png"

// Simple inline SVG icons to avoid import issues
const Activity = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"></polyline>
  </svg>
);

const MapPin = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
);

const Layers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="12,2 2,7 12,12 22,7 12,2"></polygon>
    <polyline points="2,17 12,22 22,17"></polyline>
    <polyline points="2,12 12,17 22,12"></polyline>
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

const Info = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="16" x2="12" y2="12"></line>
    <line x1="12" y1="8" x2="12.01" y2="8"></line>
  </svg>
);

const Filter = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3"></polygon>
  </svg>
);

const DefaultIcon = L.icon({
  iconUrl: markerIconPng,
  shadowUrl: markerShadowPng,
  iconRetinaUrl: markerIconRetinaUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Types for our environmental data
interface County {
  type: 'Feature';
  properties: {
    name: string;
    fips_code: string;
  };
  geometry: any;
}

interface Station {
  type: 'Feature';
  properties: {
    station_id: string;
    name: string;
    type: string;
    agency: string;
    active: boolean;
    county: string;
    parameter_name: string;
    elevation_m?: number;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
}

interface RiskScore {
  location_id: string;
  risk_score: number;
  risk_category: string;
}

interface EnvironmentalData {
  counties: County[];
  stations: Station[];
  riskScores: RiskScore[];
}

// Risk level configuration
const RISK_LEVELS = {
  LOW: { threshold: 25, color: '#22c55e', label: 'Low Risk', description: 'Air quality is good' },
  MODERATE: { threshold: 50, color: '#eab308', label: 'Moderate Risk', description: 'Sensitive individuals may experience symptoms' },
  HIGH: { threshold: 75, color: '#f97316', label: 'High Risk', description: 'May cause health effects for sensitive groups' },
  VERY_HIGH: { threshold: 90, color: '#ef4444', label: 'Very High Risk', description: 'Health alert - everyone may experience effects' },
  HAZARDOUS: { threshold: 100, color: '#991b1b', label: 'Hazardous', description: 'Emergency conditions - avoid outdoor activities' }
};

const getRiskLevel = (score: number) => {
  if (score < 25) return RISK_LEVELS.LOW;
  if (score < 50) return RISK_LEVELS.MODERATE;
  if (score < 75) return RISK_LEVELS.HIGH;
  if (score < 90) return RISK_LEVELS.VERY_HIGH;
  return RISK_LEVELS.HAZARDOUS;
};

const EnvironmentalMap: React.FC = () => {
  const [data, setData] = useState<EnvironmentalData>({
    counties: [],
    stations: [],
    riskScores: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showCounties, setShowCounties] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Fetch data from Flask API
  const fetchData = async () => {
    try {
      setRefreshing(true);
      console.log('Fetching environmental data...');
      
      // Fetch counties
      const countiesResponse = await fetch('http://localhost:5000/api/counties');
      if (!countiesResponse.ok) throw new Error(`Counties API error: ${countiesResponse.status}`);
      const countiesData = await countiesResponse.json();
      console.log('Counties loaded:', countiesData.features?.length || 0);
      
      // Fetch monitoring stations
      const stationsResponse = await fetch('http://localhost:5000/api/stations');
      if (!stationsResponse.ok) throw new Error(`Stations API error: ${stationsResponse.status}`);
      const stationsData = await stationsResponse.json();
      console.log('Stations loaded:', stationsData.features?.length || 0);
      
      // Fetch risk scores
      const riskResponse = await fetch('http://localhost:5000/api/risk-scores?type=station');
      if (!riskResponse.ok) throw new Error(`Risk scores API error: ${riskResponse.status}`);
      const riskData = await riskResponse.json();
      console.log('Risk scores loaded:', riskData.risk_scores?.length || 0);

      setData({
        counties: countiesData.features || [],
        stations: stationsData.features || [],
        riskScores: riskData.risk_scores || []
      });
      
      setLastUpdated(new Date());
      console.log('All environmental data loaded successfully!');
      
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load environmental data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Get risk score for a station
  const getRiskScore = (stationId: string): RiskScore | undefined => {
    return data.riskScores.find(score => score.location_id === stationId);
  };

  // Color coding for risk levels
  const getRiskColor = (riskScore: number): string => {
    return getRiskLevel(riskScore).color;
  };

  // Get risk level text
  const getRiskLevelText = (riskScore: number): string => {
    if (riskScore >= 75) return 'Very High';
    if (riskScore >= 50) return 'High';
    if (riskScore >= 25) return 'Moderate';
    return 'Low';
  };

  // Filter stations based on selected filter
  const filteredStations = data.stations.filter(station => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'high-risk') {
      const riskScore = getRiskScore(station.properties.station_id);
      return riskScore && riskScore.risk_score >= 50;
    }
    if (selectedFilter === 'active') return station.properties.active;
    return true;
  });

  // Calculate county statistics
  const getCountyStats = () => {
    const countyCounts: { [key: string]: { stations: number; totalRisk: number; riskCount: number } } = {};
    
    data.stations.forEach(station => {
      const county = station.properties.county;
      const riskScore = getRiskScore(station.properties.station_id);
      
      if (!countyCounts[county]) {
        countyCounts[county] = { stations: 0, totalRisk: 0, riskCount: 0 };
      }
      
      countyCounts[county].stations++;
      if (riskScore) {
        countyCounts[county].totalRisk += riskScore.risk_score;
        countyCounts[county].riskCount++;
      }
    });

    return Object.entries(countyCounts)
      .map(([county, stats]) => ({
        name: county,
        stations: stats.stations,
        avgRisk: stats.riskCount > 0 ? stats.totalRisk / stats.riskCount : 0,
        population: county.includes('King') ? '2.3M' : 
                   county.includes('Pierce') ? '921K' : 
                   county.includes('Snohomish') ? '827K' : 'N/A'
      }))
      .sort((a, b) => b.avgRisk - a.avgRisk)
      .slice(0, 5);
  };

  // Style for county boundaries
  const countyStyle = {
    fillColor: '#e5e7eb',
    weight: 2,
    opacity: 0.8,
    color: '#6b7280',
    fillOpacity: showCounties ? 0.1 : 0
  };

  // Create custom marker for stations with risk scores
  const createStationIcon = (station: Station): L.DivIcon => {
    const riskScore = getRiskScore(station.properties.station_id);
    const color = riskScore ? getRiskColor(riskScore.risk_score) : '#6b7280';
    const score = riskScore ? Math.round(riskScore.risk_score) : '?';
    
    return L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div style="
          width: 26px; 
          height: 26px; 
          border-radius: 50%; 
          background-color: ${color}; 
          border: 3px solid white;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 11px;
          color: white;
        ">
          ${score}
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  };

  const avgRisk = data.riskScores.length > 0 
    ? data.riskScores.reduce((sum, score) => sum + score.risk_score, 0) / data.riskScores.length 
    : 0;

  const countyStats = getCountyStats();

  // Loading state
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh', 
        backgroundColor: '#f9fafb' 
      }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{
            border: '4px solid #f3f4f6',
            borderTop: '4px solid #2563eb',
            borderRadius: '50%',
            width: '64px',
            height: '64px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.5rem' }}>
            Loading Environmental Data
          </h2>
          <p style={{ color: '#4b5563' }}>
            Connecting to Washington State monitoring network...
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
        backgroundColor: '#f9fafb' 
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
              <svg style={{ width: '2.5rem', height: '2.5rem', color: '#dc2626' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
              Connection Error
            </h2>
            <p style={{ color: '#4b5563', marginBottom: '1rem' }}>{error}</p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
              Make sure your Flask API is running on localhost:5000
            </p>
            <button 
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#2563eb',
                color: 'white',
                padding: '0.5rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main application layout - FIXED LAYOUT ISSUES
  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      backgroundColor: '#f9fafb',
      overflow: 'hidden',
      width: '100vw'  // FIXED: Ensure full viewport width
    }}>
      {/* Header - FIXED: Removed maxWidth restriction */}
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        flexShrink: 0,
        zIndex: 10,
        width: '100%'  // FIXED: Explicit full width
      }}>
        <div style={{
          width: '100%',  // FIXED: Changed from maxWidth to full width
          margin: '0',    // FIXED: Removed auto margins
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
              color: '#111827',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              margin: 0,
              marginBottom: '0.25rem'
            }} className="header-title">
              <Activity />
              Washington State Environmental Risk Platform
            </h1>
            <p style={{ color: '#4b5563', margin: 0, fontSize: '0.875rem' }}>
              Real-time air quality monitoring and spatial risk analysis
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <button
              onClick={() => setShowInfo(!showInfo)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                backgroundColor: '#f3f4f6',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Info />
              About
            </button>
            <button
              onClick={fetchData}
              disabled={refreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'white',
                backgroundColor: refreshing ? '#9ca3af' : '#2563eb',
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

      {/* Main Content Area - FIXED: Added explicit width */}
      <div style={{ 
        display: 'flex', 
        flex: 1, 
        minHeight: 0, 
        overflow: 'hidden',
        width: '100%'  // FIXED: Ensure full width
      }}>
        {/* Sidebar - FIXED: Reduced width from 320px to 260px */}
        <div className="sidebar-container" style={{
          width: sidebarCollapsed ? '60px' : '260px',  // FIXED: Reduced from 320px
          backgroundColor: 'white',
          borderRight: '1px solid #e5e7eb',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.3s ease',
          flexShrink: 0,
          zIndex: 5,
          overflowY: 'auto',
          maxWidth: '260px'  // FIXED: Ensure it doesn't exceed this width
        }}>
          {/* Collapse Toggle */}
          <div style={{
            padding: '1rem',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: sidebarCollapsed ? 'center' : 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}>
            {!sidebarCollapsed && (
              <h2 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', margin: 0 }}>
                Dashboard
              </h2>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{
                padding: '0.5rem',
                backgroundColor: '#f3f4f6',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
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
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                <div className="stats-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.75rem',  // FIXED: Reduced gap to fit smaller sidebar
                  marginBottom: '1rem'
                }}>
                  <div style={{
                    backgroundColor: '#eff6ff',
                    padding: '0.5rem',  // FIXED: Reduced padding
                    borderRadius: '0.5rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.25rem'
                    }}>
                      <MapPin />
                      <span style={{
                        fontSize: '1.25rem',  // FIXED: Slightly smaller
                        fontWeight: 'bold',
                        color: '#2563eb'
                      }}>
                        {data.stations.length}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '0.75rem',  // FIXED: Smaller text
                      color: '#4b5563',
                      margin: 0
                    }}>
                      Stations
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: '#f0fdf4',
                    padding: '0.5rem',
                    borderRadius: '0.5rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.25rem'
                    }}>
                      <Layers />
                      <span style={{
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: '#059669'
                      }}>
                        {data.counties.length}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '0.75rem',
                      color: '#4b5563',
                      margin: 0
                    }}>
                      Counties
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: '#fefce8',
                    padding: '0.5rem',
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
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: '#d97706'
                      }}>
                        {avgRisk.toFixed(1)}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '0.75rem',
                      color: '#4b5563',
                      margin: 0
                    }}>
                      Avg Risk
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: '#faf5ff',
                    padding: '0.5rem',
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
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: '#9333ea'
                      }}>
                        {data.riskScores.length}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '0.75rem',
                      color: '#4b5563',
                      margin: 0
                    }}>
                      Assessments
                    </p>
                  </div>
                </div>

                {/* Data Freshness Indicator */}
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
                padding: '1rem',  // FIXED: Reduced padding
                borderBottom: '1px solid #e5e7eb',
                flexShrink: 0
              }}>
                <h3 style={{
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#111827',
                  margin: '0 0 0.5rem 0',  // FIXED: Reduced margin
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Filter />
                  Filters
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="filter"
                      value="all"
                      checked={selectedFilter === 'all'}
                      onChange={(e) => setSelectedFilter(e.target.value)}
                      style={{ marginRight: '0.5rem' }}
                    />
                    <span style={{ fontSize: '0.75rem' }}>All Stations ({data.stations.length})</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="filter"
                      value="high-risk"
                      checked={selectedFilter === 'high-risk'}
                      onChange={(e) => setSelectedFilter(e.target.value)}
                      style={{ marginRight: '0.5rem' }}
                    />
                    <span style={{ fontSize: '0.75rem' }}>
                      High Risk ({data.stations.filter(s => {
                        const risk = getRiskScore(s.properties.station_id);
                        return risk && risk.risk_score >= 50;
                      }).length})
                    </span>
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
                    <span style={{ fontSize: '0.75rem' }}>
                      Active ({data.stations.filter(s => s.properties.active).length})
                    </span>
                  </label>
                </div>
              </div>

              {/* Map Controls */}
              <div style={{
                padding: '1rem',
                borderBottom: '1px solid #e5e7eb',
                flexShrink: 0
              }}>
                <h3 style={{
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#111827',
                  margin: '0 0 0.5rem 0'
                }}>
                  Map Layers
                </h3>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showCounties}
                    onChange={(e) => setShowCounties(e.target.checked)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  <span style={{ fontSize: '0.75rem' }}>Show Counties</span>
                </label>
              </div>

              {/* Risk Legend */}
              <div style={{
                padding: '1rem',
                borderBottom: '1px solid #e5e7eb',
                flexShrink: 0
              }}>
                <h3 style={{
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#111827',
                  margin: '0 0 0.5rem 0'
                }}>
                  Risk Levels
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {Object.values(RISK_LEVELS).map((level) => (
                    <div key={level.label} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <div style={{
                        width: '0.75rem',
                        height: '0.75rem',
                        borderRadius: '50%',
                        backgroundColor: level.color,
                        border: '2px solid white',
                        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.1)',
                        flexShrink: 0
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          color: '#111827',
                          margin: 0
                        }}>
                          {level.label}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* County Summary */}
              <div style={{
                padding: '1rem',
                flex: 1,
                overflowY: 'auto'
              }}>
                <h3 style={{
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#111827',
                  margin: '0 0 0.5rem 0'
                }}>
                  Top Counties
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {countyStats.slice(0, 4).map((county) => {
                    const risk = getRiskLevel(county.avgRisk);
                    return (
                      <div key={county.name} style={{
                        backgroundColor: '#f9fafb',
                        padding: '0.5rem',
                        borderRadius: '0.375rem'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '0.125rem'
                        }}>
                          <h4 style={{
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            color: '#111827',
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                            marginRight: '0.25rem'
                          }}>
                            {county.name.replace(' County', '')}
                          </h4>
                          <span style={{
                            fontSize: '0.625rem',
                            padding: '0.125rem 0.375rem',
                            borderRadius: '0.25rem',
                            color: 'white',
                            fontWeight: '500',
                            backgroundColor: risk.color,
                            flexShrink: 0
                          }}>
                            {county.avgRisk.toFixed(0)}
                          </span>
                        </div>
                        <p style={{
                          fontSize: '0.625rem',
                          color: '#4b5563',
                          margin: 0
                        }}>
                          {county.stations} stations
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Map Container - FIXED: Now takes remaining space */}
        <div className="map-container" style={{ 
          flex: 1, 
          position: 'relative', 
          minWidth: 0,
          height: '100%',
          overflow: 'hidden',
          width: 'auto'  // FIXED: Let it take remaining space
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
            
            {/* County Boundaries */}
            {showCounties && data.counties.map((county) => (
              <GeoJSON
                key={county.properties.fips_code}
                data={county}
                style={countyStyle}
              >
                <Popup>
                  <div style={{ padding: '0.75rem' }}>
                    <h3 style={{
                      fontWeight: 'bold',
                      fontSize: '1.125rem',
                      color: '#111827',
                      margin: '0 0 0.5rem 0'
                    }}>
                      {county.properties.name}
                    </h3>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      fontSize: '0.875rem'
                    }}>
                      <p style={{ margin: 0 }}>
                        <span style={{ color: '#4b5563' }}>FIPS Code:</span>{' '}
                        <span style={{ fontWeight: '500' }}>{county.properties.fips_code}</span>
                      </p>
                      <p style={{ margin: 0 }}>
                        <span style={{ color: '#4b5563' }}>Stations:</span>{' '}
                        <span style={{ fontWeight: '500' }}>
                          {data.stations.filter(s => s.properties.county === county.properties.name).length}
                        </span>
                      </p>
                    </div>
                  </div>
                </Popup>
              </GeoJSON>
            ))}
            
            {/* Monitoring Stations */}
            {filteredStations.map((station) => {
              const riskScore = getRiskScore(station.properties.station_id);
              
              return (
                <Marker
                  key={station.properties.station_id}
                  position={[station.geometry.coordinates[1], station.geometry.coordinates[0]]}
                  icon={createStationIcon(station)}
                >
                  <Popup>
                    <div style={{ padding: '1rem', minWidth: '280px' }}>
                      <div style={{
                        borderBottom: '1px solid #e5e7eb',
                        paddingBottom: '0.75rem',
                        marginBottom: '0.75rem'
                      }}>
                        <h3 style={{
                          fontWeight: 'bold',
                          fontSize: '1.125rem',
                          color: '#111827',
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
                          <span style={{ color: '#4b5563' }}>Parameter:</span>
                          <span style={{ fontWeight: '500' }}>{station.properties.parameter_name}</span>
                        </div>
                        
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '0.75rem'
                        }}>
                          <span style={{ color: '#4b5563' }}>Agency:</span>
                          <span style={{ fontWeight: '500' }}>{station.properties.agency}</span>
                        </div>
                        
                        {station.properties.elevation_m && (
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '0.75rem'
                          }}>
                            <span style={{ color: '#4b5563' }}>Elevation:</span>
                            <span style={{ fontWeight: '500' }}>{station.properties.elevation_m}m</span>
                          </div>
                        )}
                        
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
                      </div>
                      
                      {riskScore && (
                        <div style={{
                          backgroundColor: '#f9fafb',
                          borderRadius: '0.5rem',
                          padding: '1rem',
                          textAlign: 'center'
                        }}>
                          <div style={{
                            fontSize: '1.875rem',
                            fontWeight: 'bold',
                            marginBottom: '0.25rem',
                            color: getRiskColor(riskScore.risk_score)
                          }}>
                            {Math.round(riskScore.risk_score)}/100
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            fontWeight: '600',
                            letterSpacing: '0.025em',
                            color: '#4b5563',
                            marginBottom: '0.25rem'
                          }}>
                            Environmental Risk Score
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            color: getRiskColor(riskScore.risk_score)
                          }}>
                            {getRiskLevelText(riskScore.risk_score)} Risk Level
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            marginTop: '0.25rem'
                          }}>
                            Category: {riskScore.risk_category.replace('_', ' ')}
                          </div>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Info Panel Overlay */}
          {showInfo && (
            <div style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              backgroundColor: 'white',
              padding: '1.5rem',
              borderRadius: '0.5rem',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              maxWidth: '28rem',
              zIndex: 1000
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
              }}>
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  margin: 0
                }}>
                  About This Platform
                </h3>
                <button
                  onClick={() => setShowInfo(false)}
                  style={{
                    color: '#6b7280',
                    background: 'none',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    padding: '0.25rem'
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                fontSize: '0.875rem',
                color: '#374151'
              }}>
                <p style={{ margin: 0 }}>
                  This platform integrates real-time environmental data from EPA monitoring stations
                  across Washington State to provide comprehensive risk assessments.
                </p>
                <div>
                  <h4 style={{
                    fontWeight: '500',
                    marginBottom: '0.25rem',
                    margin: 0
                  }}>
                    Data Sources:
                  </h4>
                  <ul style={{
                    listStyle: 'disc',
                    listStylePosition: 'inside',
                    margin: 0,
                    padding: 0,
                    fontSize: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem'
                  }}>
                    <li>EPA Air Quality System (AQS) API</li>
                    <li>US Census Bureau TIGER/Line Shapefiles</li>
                    <li>Real-time monitoring station feeds</li>
                  </ul>
                </div>
                <div>
                  <h4 style={{
                    fontWeight: '500',
                    marginBottom: '0.25rem',
                    margin: 0
                  }}>
                    Risk Calculation:
                  </h4>
                  <p style={{
                    fontSize: '0.75rem',
                    margin: 0
                  }}>
                    Risk scores are calculated using EPA health-based standards with spatial
                    statistical analysis including hotspot detection and trend analysis.
                  </p>
                </div>
                <div>
                  <h4 style={{
                    fontWeight: '500',
                    marginBottom: '0.25rem',
                    margin: 0
                  }}>
                    Update Frequency:
                  </h4>
                  <p style={{
                    fontSize: '0.75rem',
                    margin: 0
                  }}>
                    Data is updated hourly from EPA monitoring networks.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnvironmentalMap;