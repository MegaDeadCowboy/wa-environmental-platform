# Washington State Environmental Risk Assessment Platform
## Database Schema Documentation - Multi-Domain Version

### Overview
This database stores multi-domain environmental data for Washington State, including administrative boundaries, air quality monitoring stations, water quality monitoring sites, and time-series environmental measurements. Built on PostgreSQL 16.9 with PostGIS 3.4 extensions for spatial functionality.

### Database Configuration
- **Database Name**: `wa_environmental_platform`
- **PostgreSQL Version**: 16.9
- **PostGIS Version**: 3.4
- **Spatial Reference System**: WGS84 (EPSG:4326)
- **Current Data Volume**: 97 monitoring stations, 1,620 measurements

## Core Tables

### 1. administrative_boundaries
Stores geographic boundaries for Washington State administrative regions.

```sql
CREATE TABLE administrative_boundaries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),                    -- Geographic area name
    type VARCHAR(50),                     -- 'county', 'city', 'state'
    fips_code VARCHAR(10),               -- Federal Information Processing Standard code
    geometry GEOMETRY(MULTIPOLYGON, 4326), -- Spatial boundary data
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Current Data:**
- 39 Washington counties with complete boundary data
- 606 cities and municipalities
- All boundaries validated and spatially indexed

### 2. monitoring_stations (Enhanced Schema)
Environmental monitoring station locations with multi-domain support.

```sql
CREATE TABLE monitoring_stations (
    id SERIAL PRIMARY KEY,
    station_id VARCHAR(50) UNIQUE,       -- Unique identifier (EPA-AQS or NWIS format)
    name VARCHAR(255),                   -- Human-readable station name
    type VARCHAR(50),                    -- 'air_quality', 'water_quality'
    agency VARCHAR(100),                 -- Operating agency
    location GEOMETRY(POINT, 4326),      -- Station coordinates
    active BOOLEAN DEFAULT TRUE,         -- Current operational status
    metadata JSONB,                      -- Flexible station-specific data
    
    -- Enhanced multi-domain columns
    water_body_name VARCHAR(255),        -- Name of associated water body
    water_body_type VARCHAR(100),        -- 'Stream', 'Lake', 'River', 'Groundwater'
    huc_code VARCHAR(20),               -- Hydrologic Unit Code
    usgs_site_no VARCHAR(20),           -- USGS site number for NWIS stations
    data_provider VARCHAR(100),          -- 'EPA-AQS', 'USGS-NWIS', 'WA-Ecology'
    last_measurement_date DATE,          -- Date of most recent measurement
    measurement_count INTEGER DEFAULT 0, -- Total measurements for this station
    
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Current Data:**
- Air Quality: 20 EPA AQS stations across 7 counties
- Water Quality: 77 USGS NWIS stations with active data streams
- Geographic coverage: King, Pierce, Snohomish, Thurston, Clark, Kitsap, Whatcom counties

### 3. parameter_definitions (New Table)
Standardized parameter metadata for environmental measurements.

```sql
CREATE TABLE parameter_definitions (
    id SERIAL PRIMARY KEY,
    parameter_code VARCHAR(20) UNIQUE,   -- EPA/USGS parameter code
    parameter_name VARCHAR(255) NOT NULL, -- Standard parameter name
    short_name VARCHAR(100),             -- Display name
    category VARCHAR(50),                -- 'physical', 'chemical', 'biological'
    domain VARCHAR(50),                  -- 'air_quality', 'water_quality'
    unit VARCHAR(50),                    -- Standard measurement unit
    epa_standard NUMERIC,                -- EPA regulatory standard
    description TEXT,                    -- Parameter description
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Parameter Standards:**
```sql
-- Air Quality Parameters
('88101', 'PM2.5 Mass', 'PM2.5', 'physical', 'air_quality', 'ug/m3', 12.0)
('44201', 'Ozone', 'Ozone', 'chemical', 'air_quality', 'ppb', 70.0)
('42401', 'SO2', 'Sulfur Dioxide', 'chemical', 'air_quality', 'ppb', 75.0)

-- Water Quality Parameters  
('00010', 'Temperature, water', 'Water Temperature', 'physical', 'water_quality', 'deg C', NULL)
('00300', 'Dissolved oxygen', 'Dissolved Oxygen', 'chemical', 'water_quality', 'mg/L', 5.0)
('00400', 'pH', 'pH', 'chemical', 'water_quality', 'pH units', 7.0)
```

### 4. environmental_measurements (Enhanced Schema)
Time-series environmental measurement data with standardized parameter codes.

```sql
CREATE TABLE environmental_measurements (
    id SERIAL PRIMARY KEY,
    station_id VARCHAR(50) REFERENCES monitoring_stations(station_id),
    parameter VARCHAR(100),              -- Parameter name
    parameter_code VARCHAR(20),          -- Standardized EPA/USGS code
    value NUMERIC,                       -- Measurement value
    unit VARCHAR(20),                    -- Measurement unit
    measurement_date TIMESTAMP,          -- When measurement was taken
    data_source VARCHAR(100),            -- Source system/API
    quality_flag VARCHAR(10),            -- Data quality indicator
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Current Data Volume:**
- Total measurements: 1,620
- Air quality measurements: 620 (PM2.5: 403, Ozone: 217)
- Water quality measurements: 1,000 (Water Temperature from active USGS stations)
- Date range: 2023-2025 with ongoing updates
- All measurements have standardized parameter codes (100% coverage)

**Quality Flags:**
- `VALID`: Measurement passes all quality checks
- `APPROVED`: USGS approved data (highest quality)
- `PROVISIONAL`: Preliminary data subject to revision
- `ESTIMATED`: Estimated values where direct measurement unavailable

## Database Views

### station_summary
Comprehensive station overview with measurement statistics.

```sql
CREATE OR REPLACE VIEW station_summary AS
SELECT 
    s.station_id,
    s.name,
    s.type,
    s.agency,
    s.data_provider,
    ST_X(s.location) as longitude,
    ST_Y(s.location) as latitude,
    s.measurement_count,
    s.last_measurement_date,
    (SELECT COUNT(DISTINCT parameter) FROM environmental_measurements m 
     WHERE m.station_id = s.station_id) as parameter_count,
    (SELECT b.name FROM administrative_boundaries b 
     WHERE ST_Within(s.location, b.geometry) AND b.type = 'county') as county
FROM monitoring_stations s;
```

### parameter_statistics  
Parameter-level statistics and EPA standard compliance.

```sql
CREATE OR REPLACE VIEW parameter_statistics AS
SELECT 
    pd.domain,
    pd.parameter_name,
    pd.unit,
    pd.epa_standard,
    COUNT(m.id) as measurement_count,
    COUNT(DISTINCT m.station_id) as station_count,
    AVG(m.value) as mean_value,
    MIN(m.value) as min_value,
    MAX(m.value) as max_value,
    MIN(m.measurement_date) as earliest_date,
    MAX(m.measurement_date) as latest_date
FROM parameter_definitions pd
LEFT JOIN environmental_measurements m ON pd.parameter_name = m.parameter
GROUP BY pd.domain, pd.parameter_name, pd.unit, pd.epa_standard;
```

## Spatial Operations

### Multi-Domain Station Queries

**Find all monitoring stations within a county:**
```sql
SELECT s.station_id, s.name, s.type, s.data_provider
FROM monitoring_stations s
JOIN administrative_boundaries b ON ST_Within(s.location, b.geometry)
WHERE b.name = 'King County' AND b.type = 'county';
```

**Get integrated environmental data for an area:**
```sql
SELECT 
    s.type,
    COUNT(s.station_id) as station_count,
    SUM(s.measurement_count) as total_measurements,
    MAX(s.last_measurement_date) as latest_data
FROM monitoring_stations s
JOIN administrative_boundaries b ON ST_Within(s.location, b.geometry)
WHERE b.name = 'Pierce County' AND b.type = 'county'
GROUP BY s.type;
```

### Cross-Domain Analysis

**Stations monitoring both air and water quality nearby:**
```sql
WITH nearby_stations AS (
    SELECT DISTINCT 
        a1.station_id as air_station,
        a2.station_id as water_station,
        ST_Distance(a1.location, a2.location) * 111320 as distance_meters
    FROM monitoring_stations a1, monitoring_stations a2
    WHERE a1.type = 'air_quality' 
    AND a2.type = 'water_quality'
    AND ST_DWithin(a1.location, a2.location, 0.1) -- ~11km
)
SELECT air_station, water_station, distance_meters
FROM nearby_stations 
ORDER BY distance_meters;
```

## Performance Optimization

### Spatial Indexes
```sql
-- Core spatial indexes
CREATE INDEX idx_stations_location_type ON monitoring_stations USING GIST(location, type);
CREATE INDEX idx_boundaries_geom_type ON administrative_boundaries USING GIST(geometry, type);

-- Multi-domain query optimization
CREATE INDEX idx_measurements_station_parameter_date 
ON environmental_measurements(station_id, parameter_code, measurement_date DESC);

CREATE INDEX idx_stations_provider_active 
ON monitoring_stations(data_provider, active, type);
```

### Query Performance
- Spatial queries: <100ms for point-in-polygon operations
- Time series queries: <200ms for 1000+ measurements
- Cross-domain analysis: <500ms for county-level aggregations

## Data Sources Integration

### Current Active Integrations
- **EPA AQS API**: Air quality data with daily updates
  - Endpoint: `https://aqs.epa.gov/data/api`
  - Parameters: PM2.5, Ozone, SO2, CO, NO2
  - Coverage: 20 stations across WA state

- **USGS NWIS**: Water quality data via dataretrieval package
  - Service: Daily values web service
  - Parameters: Water temperature, dissolved oxygen, pH
  - Coverage: 77 active monitoring sites

- **Census TIGER**: Administrative boundaries (annual updates)
  - Counties: Complete WA state coverage
  - Cities: 600+ incorporated places

### Data Update Procedures

**Automated Daily Updates:**
```bash
# Air quality data refresh
python src/etl/load_aqs_data.py --update-recent

# Water quality data refresh  
python src/etl/load_water_with_dataretrieval.py --daily-update

# Update station statistics
python src/database/update_station_stats.py
```

## Backup and Maintenance

### Database Maintenance
```sql
-- Weekly maintenance tasks
ANALYZE monitoring_stations;
ANALYZE environmental_measurements;
ANALYZE parameter_definitions;

-- Update materialized views (if implemented)
REFRESH MATERIALIZED VIEW station_monthly_summaries;

-- Cleanup old temporary data
DELETE FROM environmental_measurements 
WHERE quality_flag = 'INVALID' AND created_at < NOW() - INTERVAL '30 days';
```

### Backup Strategy
- **Full backup**: Weekly automated backup of complete database
- **Incremental**: Daily backup of measurement data
- **Spatial data**: Monthly backup of boundaries and station locations
- **Schema**: Version-controlled schema changes in Git repository

## Security and Access Control

### Database Users
- **admin**: Full database access (ETL processes, schema changes)
- **api_user**: Read/write access for application API  
- **analyst**: Read-only access to all environmental data
- **public**: Limited read access to approved datasets

### Connection Security
```
Host: localhost (production: encrypted connection required)
Port: 5432
Database: wa_environmental_platform
SSL: Required for external connections
Authentication: Password + certificate for production
```

## Data Quality Assurance

### Validation Procedures
1. **Spatial validation**: All coordinates within Washington State bounds
2. **Parameter validation**: Values within expected ranges for each parameter
3. **Temporal validation**: Measurement dates within reasonable bounds
4. **Cross-reference validation**: Station IDs match external agency records

### Quality Metrics
- **Completeness**: 100% of measurements have parameter codes
- **Accuracy**: All spatial coordinates validated against known locations  
- **Timeliness**: Data updates within 24 hours of source availability
- **Consistency**: Standardized units and formats across all domains

---

**Schema Version**: 2.0 (Multi-Domain Enhanced)
**Last Updated**: August 29, 2025  
**Data Currency**: Active integration with real-time government sources

For technical support or schema modifications, reference the GitHub repository:
https://github.com/MegaDeadCowboy/wa-environmental-platform