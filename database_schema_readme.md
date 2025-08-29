# Washington State Environmental Risk Assessment Platform
## Database Schema Documentation

### Overview
This database stores spatial environmental data for Washington State, including administrative boundaries, monitoring stations, and time-series environmental measurements. Built on PostgreSQL with PostGIS extensions for spatial functionality.

### Database Configuration
- **Database Name**: `wa_environmental_platform`
- **PostgreSQL Version**: 16.9
- **PostGIS Version**: 3.4
- **Spatial Reference System**: WGS84 (EPSG:4326)

## Core Tables

### 1. administrative_boundaries
Stores geographic boundaries for Washington State administrative regions (counties, cities, state).

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

**Indexes:**
- `idx_boundaries_geom` (GIST index on geometry column)

**Usage:**
- Spatial joins with point data (monitoring stations)
- Risk assessment aggregation by administrative area
- Mapping and visualization boundaries

### 2. monitoring_stations
Environmental monitoring station locations and metadata.

```sql
CREATE TABLE monitoring_stations (
    id SERIAL PRIMARY KEY,
    station_id VARCHAR(50) UNIQUE,       -- External agency station identifier
    name VARCHAR(255),                   -- Human-readable station name
    type VARCHAR(50),                    -- 'air_quality', 'water_quality'
    agency VARCHAR(100),                 -- Operating agency (EPA, USGS, etc.)
    location GEOMETRY(POINT, 4326),      -- Station coordinates
    active BOOLEAN DEFAULT TRUE,         -- Current operational status
    metadata JSONB,                      -- Flexible station-specific data
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `idx_stations_location` (GIST index on location column)

**Common metadata fields (stored in JSONB):**
```json
{
  "elevation_m": 245,
  "installation_date": "2015-06-15",
  "parameters": ["PM2.5", "PM10", "Ozone"],
  "contact_info": "...",
  "equipment_type": "..."
}
```

### 3. environmental_measurements
Time-series environmental measurement data from monitoring stations.

```sql
CREATE TABLE environmental_measurements (
    id SERIAL PRIMARY KEY,
    station_id VARCHAR(50) REFERENCES monitoring_stations(station_id),
    parameter VARCHAR(100),              -- 'PM2.5', 'dissolved_oxygen', etc.
    value NUMERIC,                       -- Measurement value
    unit VARCHAR(20),                    -- Measurement unit
    measurement_date TIMESTAMP,          -- When measurement was taken
    data_source VARCHAR(100),            -- Source system/API
    quality_flag VARCHAR(10),            -- Data quality indicator
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `idx_measurements_date` (B-tree index on measurement_date)
- `idx_measurements_station` (Compound index on station_id, parameter)
- `idx_measurements_station_date` (Compound index on station_id, measurement_date)

**Common parameters:**
- **Air Quality**: PM2.5, PM10, Ozone, CO, NO2, SO2
- **Water Quality**: dissolved_oxygen, pH, temperature, turbidity, nitrates
- **Climate**: temperature, precipitation, wind_speed, humidity

**Quality flags:**
- `VALID`: Measurement passes all quality checks
- `SUSPECT`: Measurement outside normal range
- `INVALID`: Failed quality checks
- `MISSING`: No data available

## Spatial Operations

### Common Spatial Queries

**Find monitoring stations within a county:**
```sql
SELECT s.station_id, s.name, s.type
FROM monitoring_stations s
JOIN administrative_boundaries b ON ST_Within(s.location, b.geometry)
WHERE b.name = 'King County' AND b.type = 'county';
```

**Get latest measurements for stations near a point:**
```sql
SELECT s.name, m.parameter, m.value, m.unit, m.measurement_date
FROM monitoring_stations s
JOIN environmental_measurements m ON s.station_id = m.station_id
WHERE ST_DWithin(s.location, ST_GeomFromText('POINT(-122.3321 47.6062)', 4326), 0.1)
AND m.measurement_date >= NOW() - INTERVAL '24 hours'
ORDER BY m.measurement_date DESC;
```

**Aggregate measurements by administrative boundary:**
```sql
SELECT b.name, AVG(m.value) as avg_pm25
FROM administrative_boundaries b
JOIN monitoring_stations s ON ST_Within(s.location, b.geometry)
JOIN environmental_measurements m ON s.station_id = m.station_id
WHERE b.type = 'county' 
AND m.parameter = 'PM2.5'
AND m.measurement_date >= '2024-01-01'
GROUP BY b.name;
```

## Data Loading Strategy

### Phase 1: Administrative Boundaries
1. **Washington State outline** from Census Bureau
2. **County boundaries** with FIPS codes
3. **City/municipality boundaries** for major urban areas

### Phase 2: Monitoring Stations
1. **EPA Air Quality System (AQS)** stations
2. **USGS Water Quality Portal** monitoring sites
3. **NOAA weather stations** for climate data

### Phase 3: Time Series Data
1. **Historical measurements** (past 5 years)
2. **Daily updates** via automated ETL
3. **Real-time feeds** where available

## Performance Considerations

### Spatial Indexes
All geometry columns use GIST indexes for efficient spatial queries. These support:
- Point-in-polygon operations (ST_Within)
- Distance calculations (ST_DWithin)
- Spatial joins between tables

### Time Series Optimization
Compound indexes on (station_id, measurement_date) optimize common query patterns:
- Latest measurements for specific stations
- Time range queries by station
- Parameter-specific historical analysis

### Partitioning Strategy (Future)
For large datasets, consider partitioning environmental_measurements by:
- **Time-based**: Monthly or yearly partitions
- **Station-based**: Geographic region partitions
- **Parameter-based**: Air quality vs water quality partitions

## Data Sources Integration

### Planned API Integrations
- **EPA AQS API**: `https://aqs.epa.gov/aqsweb/airdata/`
- **USGS Water Services**: `https://waterservices.usgs.gov/`
- **NOAA Climate Data**: `https://www.ncdc.noaa.gov/cdo-web/api/v2/`
- **Census Bureau TIGER**: `https://www2.census.gov/geo/tiger/`

### Data Update Schedule
- **Boundaries**: Annual updates (new municipalities, boundary changes)
- **Stations**: Monthly updates (new installations, decommissions)
- **Measurements**: Daily batch updates + real-time streaming

## Backup and Maintenance

### Regular Maintenance Tasks
```sql
-- Update table statistics for query optimization
ANALYZE administrative_boundaries;
ANALYZE monitoring_stations;
ANALYZE environmental_measurements;

-- Rebuild spatial indexes if needed
REINDEX INDEX idx_boundaries_geom;
REINDEX INDEX idx_stations_location;
```

### Data Retention Policy
- **Raw measurements**: 10 years full resolution
- **Aggregated data**: Permanent retention
- **Quality flags**: Maintain for audit trail

## Security and Access

### User Roles
- **admin**: Full database access (ETL processes)
- **analyst**: Read access to all tables
- **public**: Read access to aggregated/public data only

### Connection Details
```
Host: localhost
Port: 5432
Database: wa_environmental_platform
SSL: Required for production
```

---

**Created**: August 25, 2025  
**Last Updated**: August 25, 2025  
**Version**: 1.0

For technical support or schema changes, contact the development team.
