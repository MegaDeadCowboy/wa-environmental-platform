// src/components/map/CountyBoundaries.tsx
import React from 'react';
import { GeoJSON } from 'react-leaflet';
import type { GeoJsonObject } from 'geojson';
import type { PathOptions } from 'leaflet';

interface CountyBoundariesProps {
  counties: any[]; // Array of GeoJSON county features
  getRiskColor?: (county: any) => string;
  onCountyClick?: (county: any) => void;
  onCountyHover?: (county: any) => void;
  style?: PathOptions;
  className?: string;
}

/**
 * Create GeoJSON style function for county polygons
 */
const createCountyStyle = (
  county: any,
  getRiskColor?: (county: any) => string,
  baseStyle?: PathOptions
): PathOptions => {
  const riskColor = getRiskColor ? getRiskColor(county) : '#6b7280';
  
  return {
    fillColor: riskColor,
    fillOpacity: 0.1,
    color: riskColor,
    weight: 2,
    opacity: 0.8,
    ...baseStyle
  };
};

/**
 * Hover style for counties
 */
const hoverStyle: PathOptions = {
  weight: 3,
  opacity: 1,
  fillOpacity: 0.2
};

const CountyBoundaries: React.FC<CountyBoundariesProps> = ({
  counties,
  getRiskColor,
  onCountyClick,
  onCountyHover,
  style
}) => {
  if (!counties || counties.length === 0) {
    return null;
  }

  return (
    <>
      {counties.map((county, index) => {
        const key = county.properties?.fips_code || 
                   county.properties?.county_name || 
                   county.properties?.name || 
                   index;

        const countyStyle = createCountyStyle(county, getRiskColor, style);

        return (
          <GeoJSON
            key={`county-${key}`}
            data={county as GeoJsonObject}
            style={countyStyle}
            eventHandlers={{
              click: (e) => {
                if (onCountyClick) {
                  onCountyClick(county);
                }
              },
              mouseover: (e) => {
                const layer = e.target;
                layer.setStyle(hoverStyle);
                
                if (onCountyHover) {
                  onCountyHover(county);
                }
              },
              mouseout: (e) => {
                const layer = e.target;
                layer.setStyle(countyStyle);
              }
            }}
          />
        );
      })}
    </>
  );
};

export default CountyBoundaries;