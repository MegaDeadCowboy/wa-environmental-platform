// src/utils/riskCalculations.ts
// Risk calculation utilities for environmental monitoring

export interface RiskLevel {
  name: string;
  range: [number, number];
  color: string;
  description: string;
}

// Station property interfaces for type safety
export interface StationProperties {
  station_id: string;
  name: string;
  type: string;
  agency: string;
  active: boolean;
  county: string;
  parameter_name: string;
  elevation_m?: number;
  // Optional risk-related properties
  risk_score?: number;
  aqi?: number;
  pm25?: number;
  pm10?: number;
  ozone?: number;
  no2?: number;
  so2?: number;
  co?: number;
  last_updated?: string;
  measurements?: EnvironmentalMeasurement[];
}

export interface WaterStationProperties {
  station_id: string;
  name: string;
  county: string;
  active: boolean;
  // Water-specific properties
  ph?: number;
  dissolved_oxygen?: number;
  temperature?: number;
  turbidity?: number;
  total_coliform?: number;
  nitrates?: number;
  phosphorus?: number;
  lead?: number;
  mercury?: number;
  risk_score?: number;
  measurements?: EnvironmentalMeasurement[];
}

export interface EnvironmentalMeasurement {
  parameter: string;
  value: number;
  unit: string;
  timestamp?: string;
}

export interface CountyProperties {
  county_name?: string;
  fips_code?: string;
  risk_score?: number;
  average_aqi?: number;
  station_count?: number;
}

// EPA Air Quality Index levels
export const EPA_AQI_LEVELS: RiskLevel[] = [
  {
    name: 'Good',
    range: [0, 50],
    color: '#00e400',
    description: 'Air quality is satisfactory, and air pollution poses little or no risk.'
  },
  {
    name: 'Moderate',
    range: [51, 100], 
    color: '#ffff00',
    description: 'Air quality is acceptable for most people. However, sensitive individuals may experience minor issues.'
  },
  {
    name: 'Unhealthy for Sensitive Groups',
    range: [101, 150],
    color: '#ff7e00',
    description: 'Members of sensitive groups may experience health effects. The general public is less likely to be affected.'
  },
  {
    name: 'Unhealthy',
    range: [151, 200],
    color: '#ff0000',
    description: 'Some members of the general public may experience health effects; sensitive individuals may experience more serious health effects.'
  },
  {
    name: 'Very Unhealthy',
    range: [201, 300],
    color: '#8f3f97',
    description: 'Health alert: The risk of health effects is increased for everyone.'
  },
  {
    name: 'Hazardous',
    range: [301, 500],
    color: '#7e0023',
    description: 'Health warning of emergency conditions: everyone is more likely to be affected.'
  }
];

// Water Quality Risk levels (custom scale)
export const WATER_QUALITY_LEVELS: RiskLevel[] = [
  {
    name: 'Excellent',
    range: [0, 20],
    color: '#00a651',
    description: 'Water quality exceeds standards with minimal contamination risk.'
  },
  {
    name: 'Good',
    range: [21, 40],
    color: '#7cb518',
    description: 'Water quality meets all safety standards for intended use.'
  },
  {
    name: 'Fair',
    range: [41, 60],
    color: '#ffff00',
    description: 'Water quality is acceptable but may require treatment for some uses.'
  },
  {
    name: 'Poor',
    range: [61, 80],
    color: '#ff7e00',
    description: 'Water quality shows contamination that may affect ecosystem or human health.'
  },
  {
    name: 'Very Poor',
    range: [81, 95],
    color: '#ff0000',
    description: 'Significant contamination present. Treatment required for most uses.'
  },
  {
    name: 'Severe',
    range: [96, 100],
    color: '#7e0023',
    description: 'Severe contamination. Water unsuitable for most uses without extensive treatment.'
  }
];

// EPA air quality standards for individual pollutants
const AIR_QUALITY_STANDARDS = {
  'pm25': 12, // μg/m³ annual mean
  'pm10': 50, // μg/m³ annual mean
  'ozone': 70, // ppb 8-hour average
  'no2': 100, // ppb annual mean
  'so2': 75, // ppb 1-hour average
  'co': 9000 // ppb 8-hour average
};

// EPA drinking water standards
const WATER_QUALITY_STANDARDS = {
  'ph': { min: 6.5, max: 8.5 },
  'dissolved_oxygen': 5.0, // Min mg/L for aquatic life
  'temperature': 25, // Max Celsius for cold water fish
  'turbidity': 4, // Max NTU
  'total_coliform': 0, // Max count per 100ml
  'nitrates': 10, // Max mg/L
  'phosphorus': 0.1, // Max mg/L
  'lead': 0.015, // Max mg/L
  'mercury': 0.002 // Max mg/L
};

/**
 * Get or calculate risk score for air quality stations
 * @param station - Station with properties
 * @returns Risk score (0-500 for AQI scale)
 */
export const getAirQualityRiskScore = (station: { properties: StationProperties }): number => {
  const props = station.properties;

  // Return existing risk score if available
  if (props.risk_score !== undefined && props.risk_score !== null) {
    return props.risk_score;
  }

  // Return AQI if available
  if (props.aqi !== undefined && props.aqi !== null) {
    return props.aqi;
  }

  // Calculate from individual pollutant measurements
  if (props.measurements && props.measurements.length > 0) {
    return calculateAirQualityFromMeasurements(props.measurements);
  }

  // Calculate from individual pollutant properties
  const pollutants = [
    { name: 'pm25', value: props.pm25 },
    { name: 'pm10', value: props.pm10 },
    { name: 'ozone', value: props.ozone },
    { name: 'no2', value: props.no2 },
    { name: 'so2', value: props.so2 },
    { name: 'co', value: props.co }
  ].filter(p => p.value !== undefined && p.value !== null);

  if (pollutants.length > 0) {
    const measurements = pollutants.map(p => ({
      parameter: p.name,
      value: p.value!,
      unit: getDefaultAirUnit(p.name)
    }));
    return calculateAirQualityFromMeasurements(measurements);
  }

  // Default to 0 if no data available
  return 0;
};

/**
 * Get or calculate risk score for water quality stations
 * @param station - Station with properties
 * @returns Risk score (0-100 scale)
 */
export const getWaterQualityRiskScore = (station: { properties: WaterStationProperties }): number => {
  const props = station.properties;

  // Return existing risk score if available
  if (props.risk_score !== undefined && props.risk_score !== null) {
    return props.risk_score;
  }

  // Calculate from measurements
  if (props.measurements && props.measurements.length > 0) {
    return calculateWaterQualityFromMeasurements(props.measurements);
  }

  // Calculate from individual parameter properties
  const parameters = [
    { parameter: 'ph', value: props.ph },
    { parameter: 'dissolved_oxygen', value: props.dissolved_oxygen },
    { parameter: 'temperature', value: props.temperature },
    { parameter: 'turbidity', value: props.turbidity },
    { parameter: 'total_coliform', value: props.total_coliform },
    { parameter: 'nitrates', value: props.nitrates },
    { parameter: 'phosphorus', value: props.phosphorus },
    { parameter: 'lead', value: props.lead },
    { parameter: 'mercury', value: props.mercury }
  ].filter(p => p.value !== undefined && p.value !== null);

  if (parameters.length > 0) {
    return calculateWaterQualityFromMeasurements(
      parameters.map(p => ({
        parameter: p.parameter,
        value: p.value!,
        unit: getDefaultWaterUnit(p.parameter)
      }))
    );
  }

  // Default to 0 if no data available
  return 0;
};

/**
 * Get or calculate risk score for counties
 * @param county - County with properties
 * @returns Risk score
 */
export const getCountyRiskScore = (county: { properties: CountyProperties }): number => {
  const props = county.properties;

  // Return existing risk score if available
  if (props.risk_score !== undefined && props.risk_score !== null) {
    return props.risk_score;
  }

  // Return average AQI if available
  if (props.average_aqi !== undefined && props.average_aqi !== null) {
    return props.average_aqi;
  }

  // Default to 0 if no data available
  return 0;
};

/**
 * Calculate Air Quality Index from pollutant measurements
 */
const calculateAirQualityFromMeasurements = (measurements: EnvironmentalMeasurement[]): number => {
  let maxAQI = 0;

  measurements.forEach(measurement => {
    const aqi = convertPollutantToAQI(measurement.parameter, measurement.value);
    maxAQI = Math.max(maxAQI, aqi);
  });

  return maxAQI;
};

/**
 * Calculate water quality risk score from measurements
 */
const calculateWaterQualityFromMeasurements = (measurements: EnvironmentalMeasurement[]): number => {
  const parametersWithUnits = measurements.map(param => ({
    ...param,
    unit: param.unit || getDefaultWaterUnit(param.parameter)
  }));

  return calculateRiskScore(parametersWithUnits, WATER_QUALITY_STANDARDS);
};

/**
 * Convert individual pollutant concentration to AQI
 */
const convertPollutantToAQI = (pollutant: string, concentration: number): number => {
  const standard = AIR_QUALITY_STANDARDS[pollutant as keyof typeof AIR_QUALITY_STANDARDS];
  if (!standard) return 0;

  // Simplified AQI calculation - in reality this is more complex with breakpoints
  const ratio = concentration / standard;
  
  if (ratio <= 1) return ratio * 50; // Good to Moderate
  if (ratio <= 2) return 50 + (ratio - 1) * 50; // Moderate to Unhealthy for Sensitive
  if (ratio <= 3) return 100 + (ratio - 2) * 50; // Unhealthy for Sensitive to Unhealthy
  if (ratio <= 4) return 150 + (ratio - 3) * 50; // Unhealthy to Very Unhealthy
  return Math.min(200 + (ratio - 4) * 100, 500); // Very Unhealthy to Hazardous
};

/**
 * Get default unit for air quality parameters
 */
const getDefaultAirUnit = (parameter: string): string => {
  const airUnits: Record<string, string> = {
    'pm25': 'μg/m³',
    'pm10': 'μg/m³',
    'ozone': 'ppb',
    'no2': 'ppb',
    'so2': 'ppb',
    'co': 'ppb'
  };
  return airUnits[parameter] || '';
};

/**
 * Get default unit for water quality parameters
 */
const getDefaultWaterUnit = (parameter: string): string => {
  const waterUnits: Record<string, string> = {
    'ph': '',
    'dissolved_oxygen': 'mg/L',
    'temperature': '°C',
    'turbidity': 'NTU',
    'total_coliform': 'CFU/100ml',
    'nitrates': 'mg/L',
    'phosphorus': 'mg/L',
    'lead': 'mg/L',
    'mercury': 'mg/L'
  };
  return waterUnits[parameter] || '';
};

/**
 * Calculate risk score based on multiple parameters
 * @param measurements - Array of parameter measurements
 * @param standards - Object mapping parameter names to safe limits
 * @returns Risk score from 0-100
 */
export const calculateRiskScore = (
  measurements: { parameter: string; value: number; unit: string }[],
  standards: Record<string, number | { min: number; max: number }>
): number => {
  if (measurements.length === 0) return 0;

  let totalRisk = 0;
  let validMeasurements = 0;

  measurements.forEach(measurement => {
    const standard = standards[measurement.parameter];
    if (!standard) return;

    let parameterRisk = 0;

    if (typeof standard === 'number') {
      // Simple threshold
      const ratio = measurement.value / standard;
      parameterRisk = Math.min(ratio * 50, 100);
    } else {
      // Range with min/max (like pH)
      if (measurement.value < standard.min) {
        parameterRisk = (standard.min - measurement.value) / standard.min * 100;
      } else if (measurement.value > standard.max) {
        parameterRisk = (measurement.value - standard.max) / standard.max * 100;
      } else {
        parameterRisk = 0; // Within acceptable range
      }
    }

    totalRisk += Math.min(parameterRisk, 100);
    validMeasurements++;
  });

  return validMeasurements > 0 ? Math.min(totalRisk / validMeasurements, 100) : 0;
};

/**
 * Get risk level information based on score
 * @param score - Risk score (0-100 or 0-500 for AQI)
 * @param levels - Risk levels array (EPA_AQI_LEVELS or WATER_QUALITY_LEVELS)
 * @returns Risk level object
 */
export const getRiskLevel = (score: number, levels: RiskLevel[]): RiskLevel => {
  for (const level of levels) {
    if (score >= level.range[0] && score <= level.range[1]) {
      return level;
    }
  }
  // Default to highest risk level if score exceeds all ranges
  return levels[levels.length - 1];
};

/**
 * Convert Air Quality Index to EPA standard categories
 * @param aqi - Air Quality Index value
 * @returns EPA risk level
 */
export const aqiToRiskLevel = (aqi: number): RiskLevel => {
  return getRiskLevel(aqi, EPA_AQI_LEVELS);
};

/**
 * Convert water quality measurements to risk score
 * @param parameters - Water quality parameters with values
 * @returns Water quality risk level
 */
export const waterQualityToRiskLevel = (parameters: { parameter: string; value: number }[]): RiskLevel => {
  // Add default units to parameters for calculateRiskScore compatibility
  const parametersWithUnits = parameters.map(param => ({
    ...param,
    unit: getDefaultWaterUnit(param.parameter)
  }));

  const riskScore = calculateRiskScore(parametersWithUnits, WATER_QUALITY_STANDARDS);
  return getRiskLevel(riskScore, WATER_QUALITY_LEVELS);
};

/**
 * Calculate trend direction based on historical risk scores
 * @param scores - Array of historical risk scores (oldest to newest)
 * @returns Trend direction: 'improving', 'stable', 'deteriorating'
 */
export const calculateTrend = (scores: number[]): 'improving' | 'stable' | 'deteriorating' => {
  if (scores.length < 2) return 'stable';

  const recent = scores.slice(-3); // Last 3 measurements
  const older = scores.slice(-6, -3); // Previous 3 measurements

  if (recent.length === 0 || older.length === 0) return 'stable';

  const recentAvg = recent.reduce((sum, score) => sum + score, 0) / recent.length;
  const olderAvg = older.reduce((sum, score) => sum + score, 0) / older.length;

  const difference = recentAvg - olderAvg;
  const threshold = 5; // 5-point threshold for significance

  if (difference > threshold) return 'deteriorating';
  if (difference < -threshold) return 'improving';
  return 'stable';
};

/**
 * Generate risk assessment summary
 * @param score - Current risk score
 * @param trend - Trend direction
 * @param levels - Risk levels to use
 * @returns Human-readable risk summary
 */
export const generateRiskSummary = (
  score: number, 
  trend: 'improving' | 'stable' | 'deteriorating',
  levels: RiskLevel[] = EPA_AQI_LEVELS
): string => {
  const level = getRiskLevel(score, levels);
  const trendText = trend === 'stable' ? 'remains stable' : `is ${trend}`;
  
  return `Current ${level.name.toLowerCase()} conditions (${Math.round(score)}/100). Quality ${trendText}. ${level.description}`;
};

/**
 * Calculate health impact score for sensitive populations
 * @param riskScore - Base risk score
 * @param sensitivePopulation - Percentage of sensitive population in area (0-1)
 * @returns Adjusted risk score accounting for vulnerable populations
 */
export const calculateSensitivePopulationRisk = (riskScore: number, sensitivePopulation: number = 0.2): number => {
  // Increase risk score for areas with higher sensitive populations
  const multiplier = 1 + (sensitivePopulation * 0.5); // Up to 50% increase
  return Math.min(riskScore * multiplier, 100);
};

/**
 * Get color for risk score from entity data
 * @param entity - Station or county data with properties
 * @param type - Type of risk calculation ('aqi' or 'water')
 * @returns Hex color code
 */
export const getRiskColorFromEntity = (
  entity: { properties: StationProperties | WaterStationProperties | CountyProperties },
  type: 'aqi' | 'water' = 'aqi'
): string => {
  let riskScore: number;

  if (type === 'aqi') {
    if ('station_id' in entity.properties) {
      // Station entity
      riskScore = getAirQualityRiskScore(entity as { properties: StationProperties });
    } else {
      // County entity
      riskScore = getCountyRiskScore(entity as { properties: CountyProperties });
    }
  } else {
    // Water quality station
    riskScore = getWaterQualityRiskScore(entity as { properties: WaterStationProperties });
  }

  // Use the color mapping logic from colorMappings.ts
  if (type === 'aqi') {
    // EPA AQI scale (can go up to 500)
    if (riskScore <= 50) return '#00e400';   // Good
    if (riskScore <= 100) return '#ffff00';  // Moderate
    if (riskScore <= 150) return '#ff7e00';  // Unhealthy for Sensitive
    if (riskScore <= 200) return '#ff0000';  // Unhealthy
    if (riskScore <= 300) return '#8f3f97';  // Very Unhealthy
    return '#7e0023';                        // Hazardous
  } else {
    // Water quality scale (0-100)
    if (riskScore <= 20) return '#00a651';   // Excellent
    if (riskScore <= 40) return '#7cb518';   // Good
    if (riskScore <= 60) return '#ffff00';   // Fair
    if (riskScore <= 80) return '#ff7e00';   // Poor
    if (riskScore <= 95) return '#ff0000';   // Very Poor
    return '#7e0023';                        // Severe
  }
};

export default {
  EPA_AQI_LEVELS,
  WATER_QUALITY_LEVELS,
  getAirQualityRiskScore,
  getWaterQualityRiskScore,
  getCountyRiskScore,
  getRiskColorFromEntity,
  calculateRiskScore,
  getRiskLevel,
  aqiToRiskLevel,
  waterQualityToRiskLevel,
  calculateTrend,
  generateRiskSummary,
  calculateSensitivePopulationRisk
};