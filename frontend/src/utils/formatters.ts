// src/utils/formatters.ts
// Data formatting utilities for environmental monitoring platform

/**
 * Format numbers with appropriate precision and units
 * @param value - Numeric value
 * @param precision - Decimal places (default: 2)
 * @param unit - Unit to append
 * @returns Formatted string
 */
export const formatNumber = (value: number, precision: number = 2, unit?: string): string => {
  if (isNaN(value)) return 'N/A';
  
  const formatted = value.toFixed(precision);
  return unit ? `${formatted} ${unit}` : formatted;
};

/**
 * Format large numbers with K/M/B suffixes
 * @param value - Numeric value
 * @param precision - Decimal places
 * @returns Formatted string with suffix
 */
export const formatLargeNumber = (value: number, precision: number = 1): string => {
  if (isNaN(value)) return 'N/A';
  
  if (value >= 1e9) return `${(value / 1e9).toFixed(precision)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(precision)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(precision)}K`;
  
  return value.toString();
};

/**
 * Format dates for display
 * @param date - Date object or ISO string
 * @param format - Format type
 * @returns Formatted date string
 */
export const formatDate = (
  date: Date | string, 
  format: 'short' | 'long' | 'time' | 'datetime' | 'relative' = 'short'
): string => {
  if (!date) return 'N/A';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Date';
  
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  switch (format) {
    case 'relative':
      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString();
    
    case 'time':
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    case 'datetime':
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    case 'long':
      return d.toLocaleDateString([], { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    
    case 'short':
    default:
      return d.toLocaleDateString();
  }
};

/**
 * Format coordinates for display
 * @param lat - Latitude
 * @param lon - Longitude
 * @param precision - Decimal places
 * @returns Formatted coordinate string
 */
export const formatCoordinates = (lat: number, lon: number, precision: number = 4): string => {
  if (isNaN(lat) || isNaN(lon)) return 'N/A';
  
  return `${lat.toFixed(precision)}, ${lon.toFixed(precision)}`;
};

/**
 * Format percentage values
 * @param value - Value as decimal (0.1 = 10%)
 * @param precision - Decimal places
 * @returns Formatted percentage
 */
export const formatPercentage = (value: number, precision: number = 1): string => {
  if (isNaN(value)) return 'N/A';
  
  return `${(value * 100).toFixed(precision)}%`;
};

/**
 * Format file sizes
 * @param bytes - Size in bytes
 * @param precision - Decimal places
 * @returns Formatted file size
 */
export const formatFileSize = (bytes: number, precision: number = 1): string => {
  if (isNaN(bytes) || bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, index);
  
  return `${size.toFixed(precision)} ${units[index]}`;
};

/**
 * Format risk scores with descriptive text
 * @param score - Risk score (0-100)
 * @param type - Type of risk assessment
 * @returns Formatted risk description
 */
export const formatRiskScore = (score: number, type: 'aqi' | 'water' = 'aqi'): string => {
  if (isNaN(score)) return 'Unknown Risk';
  
  const roundedScore = Math.round(score);
  
  if (type === 'aqi') {
    if (score <= 50) return `Good (${roundedScore})`;
    if (score <= 100) return `Moderate (${roundedScore})`;
    if (score <= 150) return `Unhealthy for Sensitive (${roundedScore})`;
    if (score <= 200) return `Unhealthy (${roundedScore})`;
    if (score <= 300) return `Very Unhealthy (${roundedScore})`;
    return `Hazardous (${roundedScore})`;
  } else {
    if (score <= 20) return `Excellent (${roundedScore})`;
    if (score <= 40) return `Good (${roundedScore})`;
    if (score <= 60) return `Fair (${roundedScore})`;
    if (score <= 80) return `Poor (${roundedScore})`;
    if (score <= 95) return `Very Poor (${roundedScore})`;
    return `Severe (${roundedScore})`;
  }
};

/**
 * Format measurement values with appropriate units
 * @param value - Measurement value
 * @param parameter - Parameter name
 * @param unit - Original unit
 * @returns Formatted measurement
 */
export const formatMeasurement = (value: number, parameter: string, unit: string): string => {
  if (isNaN(value)) return 'N/A';
  
  // Special formatting for common parameters
  switch (parameter.toLowerCase()) {
    case 'temperature':
      return `${formatNumber(value, 1)}°${unit.replace('deg_', '').toUpperCase()}`;
    
    case 'ph':
      return formatNumber(value, 2);
    
    case 'dissolved oxygen':
    case 'do':
      return `${formatNumber(value, 2)} ${unit}`;
    
    case 'turbidity':
      return `${formatNumber(value, 1)} ${unit}`;
    
    case 'conductivity':
      return `${formatLargeNumber(value)} ${unit}`;
    
    default:
      return `${formatNumber(value, 2)} ${unit}`;
  }
};

/**
 * Format station status with icon
 * @param active - Whether station is active
 * @param lastUpdate - Last update timestamp
 * @returns Formatted status
 */
export const formatStationStatus = (active: boolean, lastUpdate?: Date | string): string => {
  const status = active ? 'Active' : 'Inactive';
  
  if (!lastUpdate) return status;
  
  const updateTime = formatDate(lastUpdate, 'relative');
  return `${status} (${updateTime})`;
};

/**
 * Format data range for display
 * @param min - Minimum value
 * @param max - Maximum value
 * @param unit - Unit of measurement
 * @param precision - Decimal places
 * @returns Formatted range
 */
export const formatDataRange = (
  min: number, 
  max: number, 
  unit?: string, 
  precision: number = 2
): string => {
  if (isNaN(min) || isNaN(max)) return 'N/A';
  
  const minStr = formatNumber(min, precision);
  const maxStr = formatNumber(max, precision);
  const unitStr = unit ? ` ${unit}` : '';
  
  return `${minStr} - ${maxStr}${unitStr}`;
};

/**
 * Format alert messages for display
 * @param severity - Alert severity
 * @param parameter - Parameter that triggered alert
 * @param value - Parameter value
 * @param threshold - Threshold that was exceeded
 * @param unit - Unit of measurement
 * @returns Formatted alert message
 */
export const formatAlertMessage = (
  severity: string,
  parameter: string,
  value: number,
  threshold: number,
  unit: string
): string => {
  const formattedValue = formatMeasurement(value, parameter, unit);
  const formattedThreshold = formatMeasurement(threshold, parameter, unit);
  
  return `${severity.toUpperCase()}: ${parameter} ${formattedValue} exceeds threshold of ${formattedThreshold}`;
};

/**
 * Truncate long text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export const truncateText = (text: string, maxLength: number = 50): string => {
  if (!text || text.length <= maxLength) return text;
  
  return `${text.substring(0, maxLength - 3)}...`;
};

/**
 * Format address for display
 * @param address - Address object or string
 * @returns Formatted address
 */
export const formatAddress = (address: any): string => {
  if (typeof address === 'string') return address;
  
  if (typeof address === 'object') {
    const parts = [
      address.street,
      address.city,
      address.state,
      address.zip
    ].filter(Boolean);
    
    return parts.join(', ');
  }
  
  return 'Address not available';
};

export default {
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
};