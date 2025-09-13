// src/components/map/StationPopup.tsx
import React from 'react';
import { Popup } from 'react-leaflet';
import { AlertBadge } from '../ui';
import { formatDate } from '../../utils/formatters';

interface StationData {
  station_id?: string;
  station_name?: string;
  name?: string;
  location?: string;
  county?: string;
  water_body_name?: string;
  water_body_type?: string;
  parameter_name?: string;
  agency?: string;
  active?: boolean;
  last_updated?: string | Date;
  last_sampled?: string | Date;
  primary_pollutant?: string;
  overall_health?: string;
  [key: string]: any;
}

interface StationAlert {
  parameter?: string;
  severity?: string;
  station_id?: string;
}

interface StationPopupProps {
  station: StationData;
  type: 'air-quality' | 'water-quality';
  riskScore?: number;
  riskLevel?: string;
  alerts?: StationAlert[];
  onClose?: () => void;
  className?: string;
  maxWidth?: number;
}

/**
 * Get alert badge status based on risk level or health status
 */
const getAlertStatus = (
  level: string,
  type: 'air-quality' | 'water-quality'
): 'good' | 'moderate' | 'unhealthy' | 'dangerous' | 'critical' | 'unknown' => {
  const levelLower = level.toLowerCase();
  
  if (type === 'air-quality') {
    switch (levelLower) {
      case 'good': return 'good';
      case 'moderate': return 'moderate';
      case 'unhealthy for sensitive groups': return 'unhealthy';
      case 'unhealthy': return 'dangerous';
      case 'very unhealthy':
      case 'hazardous': return 'critical';
      default: return 'unknown';
    }
  } else {
    switch (levelLower) {
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
  }
};

const StationPopup: React.FC<StationPopupProps> = ({
  station,
  type,
  riskScore,
  riskLevel,
  alerts = [],
  onClose,
  className,
  maxWidth = 320
}) => {
  const stationName = station.station_name || station.name || 'Unnamed Station';
  const hasAlerts = alerts.length > 0;
  
  return (
    <Popup
      maxWidth={maxWidth}
      className={`station-popup ${type}-popup ${className || ''}`}
    >
      <div style={{ padding: '1rem', minWidth: '280px' }}>
        {/* Station Header */}
        <h3 style={{ 
          margin: '0 0 0.75rem 0', 
          fontSize: '1.1rem', 
          color: '#111827',
          lineHeight: '1.3'
        }}>
          {stationName}
        </h3>
        
        {/* Risk Score or Health Status Badge */}
        {(riskScore !== undefined || riskLevel) && (
          <div style={{ marginBottom: '0.75rem' }}>
            <AlertBadge
              status={getAlertStatus(riskLevel || 'unknown', type)}
              label={type === 'air-quality' ? 'Risk Score' : 'Health Status'}
              value={type === 'air-quality' && riskScore !== undefined 
                ? Math.round(riskScore) 
                : riskLevel?.charAt(0).toUpperCase() + (riskLevel?.slice(1) || '')}
              variant="filled"
              size="medium"
            />
          </div>
        )}

        {/* Station Details */}
        <div style={{ fontSize: '0.875rem', lineHeight: '1.5', marginBottom: '0.75rem' }}>
          {/* Location Information */}
          {station.location && (
            <p style={{ margin: '0 0 0.5rem 0' }}>
              <strong>Location:</strong> {station.location}
            </p>
          )}
          
          {station.county && (
            <p style={{ margin: '0 0 0.5rem 0' }}>
              <strong>County:</strong> {station.county}
            </p>
          )}

          {/* Type-specific information */}
          {type === 'air-quality' ? (
            <>
              {station.parameter_name && (
                <p style={{ margin: '0 0 0.5rem 0' }}>
                  <strong>Parameter:</strong> {station.parameter_name}
                </p>
              )}
              {station.agency && (
                <p style={{ margin: '0 0 0.5rem 0' }}>
                  <strong>Agency:</strong> {station.agency}
                </p>
              )}
              {station.active !== undefined && (
                <p style={{ margin: '0 0 0.5rem 0' }}>
                  <strong>Status:</strong> {station.active ? 'Active' : 'Inactive'}
                </p>
              )}
              {station.primary_pollutant && (
                <p style={{ margin: '0 0 0.5rem 0' }}>
                  <strong>Primary Pollutant:</strong> {station.primary_pollutant}
                </p>
              )}
            </>
          ) : (
            <>
              {station.water_body_name && (
                <p style={{ margin: '0 0 0.5rem 0' }}>
                  <strong>Water Body:</strong> {station.water_body_name}
                </p>
              )}
              {station.water_body_type && (
                <p style={{ margin: '0 0 0.5rem 0' }}>
                  <strong>Type:</strong> {station.water_body_type}
                </p>
              )}
            </>
          )}

          {/* Last Updated Information */}
          {(station.last_updated || station.last_sampled) && (
            <p style={{ margin: '0 0 0.5rem 0' }}>
              <strong>{type === 'air-quality' ? 'Last Updated:' : 'Last Sampled:'}</strong> {
                formatDate(new Date(station.last_updated || station.last_sampled || ''))
              }
            </p>
          )}
        </div>

        {/* Active Alerts */}
        {hasAlerts && (
          <div style={{ 
            marginTop: '0.75rem', 
            padding: '0.75rem', 
            background: '#fef2f2', 
            border: '1px solid #fecaca', 
            borderRadius: '6px' 
          }}>
            <div style={{ 
              fontWeight: '600', 
              color: '#dc2626', 
              fontSize: '0.875rem', 
              marginBottom: '0.5rem' 
            }}>
              Active Alerts ({alerts.length})
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {alerts.slice(0, 3).map((alert, idx) => (
                <AlertBadge
                  key={idx}
                  status="dangerous"
                  label={alert.parameter || 'Unknown Parameter'}
                  value={alert.severity || 'Unknown severity'}
                  size="small"
                  variant="filled"
                />
              ))}
              
              {alerts.length > 3 && (
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  +{alerts.length - 3} more alerts
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Popup>
  );
};

export default StationPopup;