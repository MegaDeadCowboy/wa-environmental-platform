// src/utils/colorMappings.ts
// Color scheme utilities for consistent theming across environmental monitoring

export interface ColorScheme {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  light: string;
  dark: string;
}

// Air Quality Theme Colors
export const AIR_QUALITY_COLORS: ColorScheme = {
  primary: '#2563eb',    // Blue
  secondary: '#64748b',  // Slate
  success: '#10b981',    // Emerald
  warning: '#f59e0b',    // Amber
  danger: '#ef4444',     // Red
  info: '#06b6d4',       // Cyan
  light: '#f8fafc',      // Slate 50
  dark: '#0f172a'        // Slate 900
};

// Water Quality Theme Colors
export const WATER_QUALITY_COLORS: ColorScheme = {
  primary: '#0891b2',    // Cyan 600
  secondary: '#475569',  // Slate 600
  success: '#059669',    // Emerald 600
  warning: '#d97706',    // Amber 600
  danger: '#dc2626',     // Red 600
  info: '#0284c7',       // Sky 600
  light: '#f0f9ff',      // Sky 50
  dark: '#164e63'        // Cyan 900
};

// Risk Level Color Mappings
export const RISK_COLORS = {
  // EPA AQI Colors (0-500 scale)
  aqi: {
    good: '#00e400',              // 0-50: Green
    moderate: '#ffff00',          // 51-100: Yellow
    unhealthySensitive: '#ff7e00', // 101-150: Orange
    unhealthy: '#ff0000',         // 151-200: Red
    veryUnhealthy: '#8f3f97',     // 201-300: Purple
    hazardous: '#7e0023'          // 301-500: Maroon
  },
  // Water Quality Colors (0-100 scale)
  water: {
    excellent: '#00a651',    // 0-20: Dark Green
    good: '#7cb518',         // 21-40: Light Green
    fair: '#ffff00',         // 41-60: Yellow
    poor: '#ff7e00',         // 61-80: Orange
    veryPoor: '#ff0000',     // 81-95: Red
    severe: '#7e0023'        // 96-100: Dark Red
  }
};

// Status Colors
export const STATUS_COLORS = {
  active: '#10b981',      // Green
  inactive: '#6b7280',    // Gray
  maintenance: '#f59e0b', // Amber
  error: '#ef4444',       // Red
  unknown: '#9ca3af'      // Light Gray
};

// Alert Severity Colors
export const ALERT_COLORS = {
  info: '#06b6d4',        // Cyan
  low: '#10b981',         // Green
  medium: '#f59e0b',      // Amber
  high: '#f97316',        // Orange
  critical: '#ef4444',    // Red
  emergency: '#991b1b'    // Dark Red
};

// Parameter Health Status Colors
export const HEALTH_STATUS_COLORS = {
  excellent: '#059669',   // Emerald 600
  good: '#16a34a',       // Green 600
  moderate: '#ca8a04',   // Yellow 600
  poor: '#ea580c',       // Orange 600
  critical: '#dc2626',   // Red 600
  unknown: '#6b7280'     // Gray 500
};

/**
 * Get color for risk score (0-100 scale)
 * @param score - Risk score
 * @param type - Type of risk ('aqi' or 'water')
 * @returns Hex color code
 */
export const getRiskColor = (score: number, type: 'aqi' | 'water' = 'aqi'): string => {
  if (type === 'aqi') {
    // EPA AQI scale (can go up to 500)
    if (score <= 50) return RISK_COLORS.aqi.good;
    if (score <= 100) return RISK_COLORS.aqi.moderate;
    if (score <= 150) return RISK_COLORS.aqi.unhealthySensitive;
    if (score <= 200) return RISK_COLORS.aqi.unhealthy;
    if (score <= 300) return RISK_COLORS.aqi.veryUnhealthy;
    return RISK_COLORS.aqi.hazardous;
  } else {
    // Water quality scale (0-100)
    if (score <= 20) return RISK_COLORS.water.excellent;
    if (score <= 40) return RISK_COLORS.water.good;
    if (score <= 60) return RISK_COLORS.water.fair;
    if (score <= 80) return RISK_COLORS.water.poor;
    if (score <= 95) return RISK_COLORS.water.veryPoor;
    return RISK_COLORS.water.severe;
  }
};

/**
 * Get color for station status
 * @param status - Station status
 * @returns Hex color code
 */
export const getStatusColor = (status: string): string => {
  const normalizedStatus = status.toLowerCase();
  return STATUS_COLORS[normalizedStatus as keyof typeof STATUS_COLORS] || STATUS_COLORS.unknown;
};

/**
 * Get color for alert severity
 * @param severity - Alert severity level
 * @returns Hex color code
 */
export const getAlertColor = (severity: string): string => {
  const normalizedSeverity = severity.toLowerCase();
  return ALERT_COLORS[normalizedSeverity as keyof typeof ALERT_COLORS] || ALERT_COLORS.info;
};

/**
 * Get color for health status
 * @param status - Health status
 * @returns Hex color code
 */
export const getHealthColor = (status: string): string => {
  const normalizedStatus = status.toLowerCase();
  return HEALTH_STATUS_COLORS[normalizedStatus as keyof typeof HEALTH_STATUS_COLORS] || HEALTH_STATUS_COLORS.unknown;
};

/**
 * Generate gradient colors for data visualization
 * @param values - Array of numeric values
 * @param colorScale - Color scale to use
 * @returns Array of colors corresponding to values
 */
export const generateGradientColors = (
  values: number[], 
  colorScale: 'aqi' | 'water' = 'aqi'
): string[] => {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;

  return values.map(value => {
    if (range === 0) return getRiskColor(50, colorScale); // Default middle color
    const normalizedValue = ((value - min) / range) * 100;
    return getRiskColor(normalizedValue, colorScale);
  });
};

/**
 * Get contrasting text color for background
 * @param backgroundColor - Background color hex code
 * @returns 'white' or 'black' for optimal contrast
 */
export const getContrastColor = (backgroundColor: string): string => {
  // Remove # if present
  const hex = backgroundColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#ffffff';
};

/**
 * Lighten or darken a color by percentage
 * @param color - Hex color code
 * @param percent - Percentage to lighten (positive) or darken (negative)
 * @returns Modified hex color
 */
export const adjustColorBrightness = (color: string, percent: number): string => {
  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);
  
  let r = (num >> 16) + percent;
  let g = (num >> 8 & 0x00FF) + percent;
  let b = (num & 0x0000FF) + percent;
  
  r = r > 255 ? 255 : r < 0 ? 0 : r;
  g = g > 255 ? 255 : g < 0 ? 0 : g;
  b = b > 255 ? 255 : b < 0 ? 0 : b;
  
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
};

/**
 * Create color palette for data visualization
 * @param count - Number of colors needed
 * @param baseColor - Base color to generate palette from
 * @returns Array of hex colors
 */
export const createColorPalette = (count: number, baseColor: string = '#2563eb'): string[] => {
  const colors: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const brightness = -50 + (i * 100) / (count - 1); // Range from -50 to +50
    colors.push(adjustColorBrightness(baseColor, brightness));
  }
  
  return colors;
};

/**
 * Get theme colors based on environmental domain
 * @param domain - Environmental domain
 * @returns Color scheme object
 */
export const getThemeColors = (domain: 'air' | 'water'): ColorScheme => {
  return domain === 'air' ? AIR_QUALITY_COLORS : WATER_QUALITY_COLORS;
};

export default {
  AIR_QUALITY_COLORS,
  WATER_QUALITY_COLORS,
  RISK_COLORS,
  STATUS_COLORS,
  ALERT_COLORS,
  HEALTH_STATUS_COLORS,
  getRiskColor,
  getStatusColor,
  getAlertColor,
  getHealthColor,
  generateGradientColors,
  getContrastColor,
  adjustColorBrightness,
  createColorPalette,
  getThemeColors
};