// src/utils/index.ts
// Export all utility functions

// Risk Calculations
export {
  EPA_AQI_LEVELS,
  WATER_QUALITY_LEVELS,
  calculateRiskScore,
  getRiskLevel,
  aqiToRiskLevel,
  waterQualityToRiskLevel,
  calculateTrend,
  generateRiskSummary,
  calculateSensitivePopulationRisk,
  type RiskLevel
} from './riskCalculations';

// Color Mappings
export {
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
  getThemeColors,
  type ColorScheme
} from './colorMappings';

// Formatters
export {
  formatNumber,
  formatLargeNumber,
  formatDate,
  formatCoordinates,
  formatPercentage,
  formatFileSize,
  formatRiskScore,
  formatMeasurement,
  formatStationStatus,
  formatDataRange,
  formatAlertMessage,
  truncateText,
  formatAddress
} from './formatters';

// Map Helpers
export {
  MAP_CONFIG,
  TILE_LAYERS,
  createRiskScoreIcon,
  createCircleMarker,
  createPulsingMarker,
  calculateDistance,
  findStationsNear,
  calculateBounds,
  validateCoordinates,
  createPopupContent,
  createPolygonStyle,
  clusterStations
} from './mapHelpers';