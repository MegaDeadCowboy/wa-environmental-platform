-- Environmental Risk Assessment Platform - Spatial Analysis Queries
-- Demonstrates PostGIS spatial capabilities with environmental data

-- ============================================================================
-- BASIC SPATIAL OPERATIONS
-- ============================================================================

-- 1. Find all air quality stations within King County
SELECT 
    s.station_id,
    s.name,
    s.agency,
    ST_X(s.location) as longitude,
    ST_Y(s.location) as latitude,
    s.metadata->>'parameter_name' as monitored_parameters
FROM monitoring_stations s
JOIN administrative_boundaries b ON ST_Within(s.location, b.geometry)
WHERE b.name = 'King County' 
  AND b.type = 'county'
  AND s.type = 'air_quality';

-- 2. Count monitoring stations by county (spatial aggregation)
SELECT 
    b.name as county_name,
    COUNT(s.station_id) as station_count,
    STRING_AGG(DISTINCT s.agency, ', ') as agencies
FROM administrative_boundaries b
LEFT JOIN monitoring_stations s ON ST_Within(s.location, b.geometry)
WHERE b.type = 'county'
  AND (s.type = 'air_quality' OR s.type IS NULL)
GROUP BY b.name, b.fips_code
ORDER BY station_count DESC;

-- 3. Find stations within 10 miles of Seattle city center  
SELECT 
    s.station_id,
    s.name,
    ROUND(
        ST_Distance(
            s.location, 
            ST_GeomFromText('POINT(-122.3321 47.6062)', 4326)::geography
        ) / 1609.34, 2
    ) as distance_miles
FROM monitoring_stations s
WHERE ST_DWithin(
    s.location::geography,
    ST_GeomFromText('POINT(-122.3321 47.6062)', 4326)::geography,
    16093.4  -- 10 miles in meters
)
ORDER BY distance_miles;

-- ============================================================================
-- TIME-SERIES ENVIRONMENTAL ANALYSIS
-- ============================================================================

-- 4. Latest PM2.5 readings by station with spatial context
SELECT 
    b.name as county,
    s.station_id,
    s.name as station_name,
    m.value as pm25_value,
    m.unit,
    m.measurement_date,
    m.quality_flag,
    CASE 
        WHEN m.value <= 12 THEN 'Good'
        WHEN m.value <= 35.4 THEN 'Moderate'  
        WHEN m.value <= 55.4 THEN 'Unhealthy for Sensitive Groups'
        WHEN m.value <= 150.4 THEN 'Unhealthy'
        WHEN m.value <= 250.4 THEN 'Very Unhealthy'
        ELSE 'Hazardous'
    END as aqi_category
FROM environmental_measurements m
JOIN monitoring_stations s ON m.station_id = s.station_id
JOIN administrative_boundaries b ON ST_Within(s.location, b.geometry)
WHERE m.parameter = 'PM2.5 Mass'
  AND b.type = 'county'
  AND m.measurement_date >= CURRENT_DATE - INTERVAL '7 days'
  AND m.quality_flag = 'VALID'
ORDER BY m.measurement_date DESC, b.name;

-- 5. 7-day average PM2.5 by county (spatial aggregation of time series)
SELECT 
    b.name as county,
    COUNT(DISTINCT s.station_id) as station_count,
    ROUND(AVG(m.value), 2) as avg_pm25,
    ROUND(MIN(m.value), 2) as min_pm25,
    ROUND(MAX(m.value), 2) as max_pm25,
    COUNT(m.value) as measurement_count
FROM administrative_boundaries b
JOIN monitoring_stations s ON ST_Within(s.location, b.geometry)
JOIN environmental_measurements m ON s.station_id = m.station_id
WHERE b.type = 'county'
  AND m.parameter = 'PM2.5 Mass'
  AND m.measurement_date >= CURRENT_DATE - INTERVAL '7 days'
  AND m.quality_flag = 'VALID'
GROUP BY b.name, b.fips_code
HAVING COUNT(m.value) >= 3  -- Only counties with sufficient data
ORDER BY avg_pm25 DESC;

-- 6. Trend analysis: Compare current week vs previous week
WITH current_week AS (
    SELECT 
        s.station_id,
        AVG(m.value) as current_avg
    FROM monitoring_stations s
    JOIN environmental_measurements m ON s.station_id = m.station_id
    WHERE m.parameter = 'PM2.5 Mass'
      AND m.measurement_date >= CURRENT_DATE - INTERVAL '7 days'
      AND m.quality_flag = 'VALID'
    GROUP BY s.station_id
),
previous_week AS (
    SELECT 
        s.station_id,
        AVG(m.value) as previous_avg
    FROM monitoring_stations s
    JOIN environmental_measurements m ON s.station_id = m.station_id
    WHERE m.parameter = 'PM2.5 Mass'
      AND m.measurement_date >= CURRENT_DATE - INTERVAL '14 days'
      AND m.measurement_date < CURRENT_DATE - INTERVAL '7 days'
      AND m.quality_flag = 'VALID'
    GROUP BY s.station_id
)
SELECT 
    b.name as county,
    s.station_id,
    s.name as station_name,
    ROUND(cw.current_avg, 2) as current_week_avg,
    ROUND(pw.previous_avg, 2) as previous_week_avg,
    ROUND(cw.current_avg - pw.previous_avg, 2) as change,
    CASE 
        WHEN cw.current_avg > pw.previous_avg THEN 'Worsening'
        WHEN cw.current_avg < pw.previous_avg THEN 'Improving'
        ELSE 'Stable'
    END as trend
FROM current_week cw
JOIN previous_week pw ON cw.station_id = pw.station_id
JOIN monitoring_stations s ON cw.station_id = s.station_id
JOIN administrative_boundaries b ON ST_Within(s.location, b.geometry)
WHERE b.type = 'county'
ORDER BY change DESC;

-- ============================================================================
-- ADVANCED SPATIAL RISK ANALYSIS
-- ============================================================================

-- 7. Hotspot detection: Areas with consistently high pollution
SELECT 
    b.name as county,
    COUNT(DISTINCT s.station_id) as stations_in_county,
    AVG(m.value) as avg_pollution,
    COUNT(CASE WHEN m.value > 35.4 THEN 1 END) as unhealthy_days,
    COUNT(m.value) as total_measurements,
    ROUND(
        100.0 * COUNT(CASE WHEN m.value > 35.4 THEN 1 END) / COUNT(m.value), 
        1
    ) as pct_unhealthy_days
FROM administrative_boundaries b
JOIN monitoring_stations s ON ST_Within(s.location, b.geometry)
JOIN environmental_measurements m ON s.station_id = m.station_id
WHERE b.type = 'county'
  AND m.parameter = 'PM2.5 Mass'
  AND m.measurement_date >= CURRENT_DATE - INTERVAL '30 days'
  AND m.quality_flag = 'VALID'
GROUP BY b.name
HAVING COUNT(m.value) >= 10  -- Sufficient data
ORDER BY pct_unhealthy_days DESC;

-- 8. Buffer analysis: Population exposure risk zones
-- Find populated areas within 5 miles of high-pollution stations
WITH high_pollution_stations AS (
    SELECT DISTINCT
        s.station_id,
        s.name,
        s.location,
        AVG(m.value) as avg_pm25
    FROM monitoring_stations s
    JOIN environmental_measurements m ON s.station_id = m.station_id
    WHERE m.parameter = 'PM2.5 Mass'
      AND m.measurement_date >= CURRENT_DATE - INTERVAL '30 days'
      AND m.quality_flag = 'VALID'
    GROUP BY s.station_id, s.name, s.location
    HAVING AVG(m.value) > 25  -- Above WHO guideline
)
SELECT 
    hps.station_id,
    hps.name as station_name,
    ROUND(hps.avg_pm25, 2) as avg_pm25,
    COUNT(DISTINCT cities.name) as nearby_cities,
    STRING_AGG(DISTINCT cities.name, ', ') as city_names
FROM high_pollution_stations hps
LEFT JOIN administrative_boundaries cities ON 
    cities.type = 'city' 
    AND ST_DWithin(
        hps.location::geography,
        ST_Centroid(cities.geometry)::geography,
        8046.72  -- 5 miles in meters
    )
GROUP BY hps.station_id, hps.name, hps.avg_pm25
ORDER BY nearby_cities DESC, hps.avg_pm25 DESC;

-- 9. Spatial correlation: Compare urban vs rural air quality
WITH station_classifications AS (
    SELECT 
        s.station_id,
        s.name,
        CASE 
            WHEN cities.name IS NOT NULL THEN 'Urban'
            ELSE 'Rural'
        END as area_type,
        AVG(m.value) as avg_pm25
    FROM monitoring_stations s
    JOIN environmental_measurements m ON s.station_id = m.station_id
    LEFT JOIN administrative_boundaries cities ON 
        cities.type = 'city' 
        AND ST_Within(s.location, cities.geometry)
    WHERE m.parameter = 'PM2.5 Mass'
      AND m.measurement_date >= CURRENT_DATE - INTERVAL '30 days'
      AND m.quality_flag = 'VALID'
    GROUP BY s.station_id, s.name, cities.name
)
SELECT 
    area_type,
    COUNT(*) as station_count,
    ROUND(AVG(avg_pm25), 2) as mean_pm25,
    ROUND(STDDEV(avg_pm25), 2) as stddev_pm25,
    ROUND(MIN(avg_pm25), 2) as min_pm25,
    ROUND(MAX(avg_pm25), 2) as max_pm25
FROM station_classifications
GROUP BY area_type
ORDER BY mean_pm25 DESC;

-- ============================================================================
-- DATA QUALITY AND COVERAGE ASSESSMENT
-- ============================================================================

-- 10. Data coverage assessment by region
SELECT 
    b.name as county,
    COUNT(DISTINCT s.station_id) as stations,
    COUNT(DISTINCT DATE(m.measurement_date)) as days_with_data,
    MIN(m.measurement_date) as earliest_reading,
    MAX(m.measurement_date) as latest_reading,
    COUNT(m.value) as total_measurements,
    COUNT(CASE WHEN m.quality_flag = 'VALID' THEN 1 END) as valid_measurements,
    ROUND(
        100.0 * COUNT(CASE WHEN m.quality_flag = 'VALID' THEN 1 END) / COUNT(m.value), 
        1
    ) as data_quality_pct
FROM administrative_boundaries b
LEFT JOIN monitoring_stations s ON ST_Within(s.location, b.geometry)
LEFT JOIN environmental_measurements m ON s.station_id = m.station_id
WHERE b.type = 'county'
  AND (m.parameter = 'PM2.5 Mass' OR m.parameter IS NULL)
GROUP BY b.name
ORDER BY stations DESC, total_measurements DESC;

-- 11. Monitor uptime analysis
SELECT 
    s.station_id,
    s.name,
    s.agency,
    COUNT(DISTINCT DATE(m.measurement_date)) as operational_days,
    30 as expected_days,
    ROUND(100.0 * COUNT(DISTINCT DATE(m.measurement_date)) / 30.0, 1) as uptime_pct,
    MIN(m.measurement_date) as first_reading,
    MAX(m.measurement_date) as last_reading
FROM monitoring_stations s
LEFT JOIN environmental_measurements m ON s.station_id = m.station_id
WHERE s.type = 'air_quality'
  AND (m.measurement_date >= CURRENT_DATE - INTERVAL '30 days' OR m.measurement_date IS NULL)
  AND (m.parameter = 'PM2.5 Mass' OR m.parameter IS NULL)
GROUP BY s.station_id, s.name, s.agency
ORDER BY uptime_pct DESC;

-- ============================================================================
-- ENVIRONMENTAL JUSTICE ANALYSIS
-- ============================================================================

-- 12. Environmental burden distribution
-- Identify areas with multiple environmental stressors
WITH pollution_summary AS (
    SELECT 
        b.name as county,
        COUNT(DISTINCT s.station_id) as station_count,
        AVG(m.value) as avg_pollution,
        COUNT(CASE WHEN m.value > 35.4 THEN 1 END) as exceedance_count,
        ST_Area(b.geometry::geography) / 1000000 as area_km2  -- Area in km²
    FROM administrative_boundaries b
    LEFT JOIN monitoring_stations s ON ST_Within(s.location, b.geometry)
    LEFT JOIN environmental_measurements m ON s.station_id = m.station_id
    WHERE b.type = 'county'
      AND (m.parameter = 'PM2.5 Mass' OR m.parameter IS NULL)
      AND (m.measurement_date >= CURRENT_DATE - INTERVAL '30 days' OR m.measurement_date IS NULL)
      AND (m.quality_flag = 'VALID' OR m.quality_flag IS NULL)
    GROUP BY b.name, b.geometry
)
SELECT 
    county,
    station_count,
    ROUND(avg_pollution, 2) as avg_pm25,
    exceedance_count as unhealthy_days,
    ROUND(area_km2, 0) as area_km2,
    CASE 
        WHEN station_count = 0 THEN 'No Monitoring'
        WHEN station_count < 2 THEN 'Under-monitored'
        WHEN avg_pollution > 25 THEN 'High Risk'
        WHEN exceedance_count > 5 THEN 'Frequent Exceedances'
        ELSE 'Normal'
    END as risk_category
FROM pollution_summary
ORDER BY 
    CASE risk_category
        WHEN 'High Risk' THEN 1
        WHEN 'Frequent Exceedances' THEN 2
        WHEN 'Under-monitored' THEN 3
        WHEN 'No Monitoring' THEN 4
        ELSE 5
    END,
    avg_pollution DESC NULLS LAST;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION QUERIES
-- ============================================================================

-- 13. Test spatial index performance
EXPLAIN ANALYZE
SELECT 
    COUNT(*)
FROM monitoring_stations s
JOIN administrative_boundaries b ON ST_Within(s.location, b.geometry)
WHERE b.name = 'King County' AND b.type = 'county';

-- 14. Test compound index performance on time series
EXPLAIN ANALYZE
SELECT 
    station_id,
    parameter,
    AVG(value) as avg_value
FROM environmental_measurements
WHERE station_id = '53-033-0080'
  AND measurement_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY station_id, parameter;

-- ============================================================================
-- DATA EXPORT QUERIES FOR VISUALIZATION
-- ============================================================================

-- 15. GeoJSON export for web mapping (stations with recent data)
SELECT 
    jsonb_build_object(
        'type', 'FeatureCollection',
        'features', jsonb_agg(
            jsonb_build_object(
                'type', 'Feature',
                'geometry', ST_AsGeoJSON(s.location)::jsonb,
                'properties', jsonb_build_object(
                    'station_id', s.station_id,
                    'name', s.name,
                    'agency', s.agency,
                    'latest_pm25', latest_data.avg_value,
                    'measurement_count', latest_data.measurement_count,
                    'last_updated', latest_data.last_reading,
                    'aqi_category', 
                    CASE 
                        WHEN latest_data.avg_value <= 12 THEN 'Good'
                        WHEN latest_data.avg_value <= 35.4 THEN 'Moderate'  
                        WHEN latest_data.avg_value <= 55.4 THEN 'Unhealthy for Sensitive Groups'
                        WHEN latest_data.avg_value <= 150.4 THEN 'Unhealthy'
                        WHEN latest_data.avg_value <= 250.4 THEN 'Very Unhealthy'
                        ELSE 'Hazardous'
                    END
                )
            )
        )
    ) as geojson
FROM monitoring_stations s
JOIN (
    SELECT 
        station_id,
        ROUND(AVG(value), 2) as avg_value,
        COUNT(*) as measurement_count,
        MAX(measurement_date) as last_reading
    FROM environmental_measurements
    WHERE parameter = 'PM2.5 Mass'
      AND measurement_date >= CURRENT_DATE - INTERVAL '7 days'
      AND quality_flag = 'VALID'
    GROUP BY station_id
) latest_data ON s.station_id = latest_data.station_id
WHERE s.type = 'air_quality';

-- 16. County-level risk summary for dashboard
SELECT 
    b.name as county,
    b.fips_code,
    ST_AsGeoJSON(ST_Centroid(b.geometry))::jsonb as centroid,
    COALESCE(risk_data.station_count, 0) as stations,
    COALESCE(ROUND(risk_data.avg_pm25, 1), 0) as avg_pm25,
    COALESCE(risk_data.max_pm25, 0) as max_pm25,
    COALESCE(risk_data.unhealthy_days, 0) as unhealthy_days,
    CASE 
        WHEN risk_data.avg_pm25 IS NULL THEN 'No Data'
        WHEN risk_data.avg_pm25 <= 12 THEN 'Good'
        WHEN risk_data.avg_pm25 <= 25 THEN 'Moderate'
        WHEN risk_data.avg_pm25 <= 35.4 THEN 'Unhealthy for Sensitive'
        ELSE 'Unhealthy'
    END as risk_level,
    ROUND(ST_Area(b.geometry::geography) / 1000000, 0) as area_km2
FROM administrative_boundaries b
LEFT JOIN (
    SELECT 
        b2.fips_code,
        COUNT(DISTINCT s.station_id) as station_count,
        AVG(m.value) as avg_pm25,
        MAX(m.value) as max_pm25,
        COUNT(CASE WHEN m.value > 35.4 THEN 1 END) as unhealthy_days
    FROM administrative_boundaries b2
    JOIN monitoring_stations s ON ST_Within(s.location, b2.geometry)
    JOIN environmental_measurements m ON s.station_id = m.station_id
    WHERE b2.type = 'county'
      AND m.parameter = 'PM2.5 Mass'
      AND m.measurement_date >= CURRENT_DATE - INTERVAL '7 days'
      AND m.quality_flag = 'VALID'
    GROUP BY b2.fips_code
) risk_data ON b.fips_code = risk_data.fips_code
WHERE b.type = 'county'
ORDER BY b.name;

-- ============================================================================
-- MONITORING AND ALERTING QUERIES
-- ============================================================================

-- 17. High pollution alerts (for automated monitoring)
SELECT 
    'HIGH_PM25_ALERT' as alert_type,
    s.station_id,
    s.name as station_name,
    b.name as county,
    m.value as pm25_value,
    m.measurement_date,
    CASE 
        WHEN m.value > 150.4 THEN 'CRITICAL'
        WHEN m.value > 55.4 THEN 'HIGH'
        ELSE 'MODERATE'
    END as severity
FROM environmental_measurements m
JOIN monitoring_stations s ON m.station_id = s.station_id
JOIN administrative_boundaries b ON ST_Within(s.location, b.geometry)
WHERE m.parameter = 'PM2.5 Mass'
  AND m.value > 35.4  -- Unhealthy for sensitive groups threshold
  AND m.measurement_date >= CURRENT_DATE - INTERVAL '24 hours'
  AND m.quality_flag = 'VALID'
  AND b.type = 'county'
ORDER BY m.value DESC, m.measurement_date DESC;

-- 18. Data freshness check
SELECT 
    'DATA_FRESHNESS' as check_type,
    COUNT(DISTINCT s.station_id) as total_stations,
    COUNT(DISTINCT recent.station_id) as stations_with_recent_data,
    COUNT(DISTINCT s.station_id) - COUNT(DISTINCT recent.station_id) as stale_stations,
    ROUND(
        100.0 * COUNT(DISTINCT recent.station_id) / COUNT(DISTINCT s.station_id), 
        1
    ) as data_freshness_pct
FROM monitoring_stations s
LEFT JOIN (
    SELECT DISTINCT station_id
    FROM environmental_measurements
    WHERE measurement_date >= CURRENT_DATE - INTERVAL '48 hours'
) recent ON s.station_id = recent.station_id
WHERE s.type = 'air_quality';

-- ============================================================================
-- SUMMARY STATISTICS FOR REPORTING
-- ============================================================================

-- 19. Washington State environmental summary
SELECT 
    'WA_STATE_SUMMARY' as report_type,
    COUNT(DISTINCT b.fips_code) as counties_total,
    COUNT(DISTINCT CASE WHEN stations.station_count > 0 THEN b.fips_code END) as counties_monitored,
    SUM(COALESCE(stations.station_count, 0)) as total_stations,
    ROUND(AVG(measurements.avg_pm25), 2) as state_avg_pm25,
    COUNT(CASE WHEN measurements.avg_pm25 > 35.4 THEN 1 END) as counties_exceeding_standard
FROM administrative_boundaries b
LEFT JOIN (
    SELECT 
        b2.fips_code,
        COUNT(DISTINCT s.station_id) as station_count
    FROM administrative_boundaries b2
    JOIN monitoring_stations s ON ST_Within(s.location, b2.geometry)
    WHERE b2.type = 'county' AND s.type = 'air_quality'
    GROUP BY b2.fips_code
) stations ON b.fips_code = stations.fips_code
LEFT JOIN (
    SELECT 
        b3.fips_code,
        AVG(m.value) as avg_pm25
    FROM administrative_boundaries b3
    JOIN monitoring_stations s ON ST_Within(s.location, b3.geometry)
    JOIN environmental_measurements m ON s.station_id = m.station_id
    WHERE b3.type = 'county' 
      AND m.parameter = 'PM2.5 Mass'
      AND m.measurement_date >= CURRENT_DATE - INTERVAL '7 days'
      AND m.quality_flag = 'VALID'
    GROUP BY b3.fips_code
) measurements ON b.fips_code = measurements.fips_code
WHERE b.type = 'county';

-- ============================================================================
-- MAINTENANCE AND OPTIMIZATION
-- ============================================================================

-- 20. Table maintenance and statistics
-- Run these periodically to maintain performance

-- Update table statistics
-- ANALYZE administrative_boundaries;
-- ANALYZE monitoring_stations; 
-- ANALYZE environmental_measurements;

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check table sizes
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(tablename::regclass)) as total_size,
    pg_size_pretty(pg_relation_size(tablename::regclass)) as table_size,
    pg_size_pretty(pg_total_relation_size(tablename::regclass) - pg_relation_size(tablename::regclass)) as index_size
FROM (
    VALUES ('administrative_boundaries'), ('monitoring_stations'), ('environmental_measurements')
) AS t(tablename);

/*
USAGE NOTES:

1. Performance Optimization:
   - All spatial queries use GIST indexes on geometry columns
   - Time-series queries use compound indexes on (station_id, measurement_date)
   - Use EXPLAIN ANALYZE to verify index usage

2. Data Quality:
   - Always filter by quality_flag = 'VALID' for analysis
   - Check data coverage before drawing conclusions
   - Monitor data freshness with query #18

3. Environmental Thresholds:
   - PM2.5 WHO guideline: 15 μg/m³ annual, 45 μg/m³ daily
   - EPA NAAQS: 12 μg/m³ annual, 35.4 μg/m³ daily
   - AQI breakpoints used in queries for health categorization

4. Spatial Analysis:
   - All coordinates in WGS84 (EPSG:4326)
   - Distance calculations use geography type for accuracy
   - Buffer analysis accounts for Earth's curvature

5. Scalability:
   - Queries designed for millions of measurement records
   - Use date range filters to limit large result sets
   - Consider partitioning environmental_measurements by date for very large datasets
*/