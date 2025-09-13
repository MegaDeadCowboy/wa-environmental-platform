# Washington State Environmental Risk Assessment Platform
## Multi-Domain Environmental Monitoring and Spatial Analysis System

**Status: Production-Ready | Version: 2.0-stable | Test Coverage: 97.1%**

A comprehensive GIS-enabled web platform that integrates multiple environmental datasets to assess and visualize environmental risks across Washington State. This project demonstrates advanced spatial data engineering, environmental domain knowledge, and full-stack development capabilities with real government data integration.

---

## Live Data Integration Status

**Current Platform Metrics (August 2025):**
- **97 Active Monitoring Stations** across Washington State
- **1,620+ Environmental Measurements** with standardized quality flags
- **Multi-Domain Coverage**: Air quality + Water quality integrated
- **12 REST API Endpoints** with comprehensive testing
- **7 Counties**: King, Pierce, Snohomish, Thurston, Clark, Kitsap, Whatcom
- **Real-Time APIs**: EPA AQS and USGS NWIS data connectors

**Data Sources:**
- Air Quality: 20 EPA AQS stations (PM2.5, Ozone measurements)
- Water Quality: 77 USGS NWIS stations (Temperature, dissolved oxygen, pH)
- Administrative: 39 counties, 606+ cities with spatial boundaries
- Updates: Automated daily refresh from government APIs

---

## Technical Architecture

### Backend Infrastructure
```
Government Data APIs          ETL Pipeline              Database Layer
┌─────────────────────────      ┌─────────────────────────   ┌─────────────────────────
│ EPA AQS API         │────► │ Python ETL          │──►│ PostgreSQL 16.9 +   │
│ USGS NWIS API      │      │ - Authentication    │   │ PostGIS 3.4         │
│ Census TIGER       │      │ - Rate Limiting     │   │ - Spatial Indexes   │
│ Real-time feeds    │      │ - Data Validation   │   │ - Parameter Codes   │
└─────────────────────────      │ - Quality Control   │   │ - JSONB Metadata    │
                             └─────────────────────────   └─────────────────────────
                                                                    │
                                                                    ▼
┌─────────────────────────      ┌─────────────────────────   ┌─────────────────────────
│ React Frontend      │◄──── │ Flask REST API      │◄───│ Spatial Analysis    │
│ - Interactive Maps │      │ - 12 Endpoints      │   │ - Risk Scoring      │
│ - Multi-domain UI  │      │ - GeoJSON Output    │   │ - Hotspot Detection │
│ - Risk Dashboard   │      │ - CORS Enabled      │   │ - Trend Analysis    │
│ - Real-time Data   │      │ - Parameter Stats   │   │ - Quality Assessment│
└─────────────────────────      └─────────────────────────   └─────────────────────────
```

### Technology Stack
- **Database**: PostgreSQL 16.9 with PostGIS 3.4 spatial extensions
- **Backend API**: Flask + SQLAlchemy + GeoAlchemy2 with RESTful endpoints
- **ETL Pipeline**: Python with pandas, geopandas, dataretrieval, spatial analysis
- **Frontend**: React 18 + TypeScript, built with Vite for optimal performance
- **Mapping**: Leaflet with react-leaflet integration and custom risk-coded markers
- **Styling**: Custom responsive CSS optimized for environmental data visualization
- **Data Integration**: EPA AQS API, USGS dataretrieval package, Census TIGER

---

## API Endpoints (Production Ready)

**Base URL**: `http://localhost:5000/api`

### Core Environmental Endpoints
| Endpoint | Method | Description | Response Format |
|----------|--------|-------------|-----------------|
| `/health` | GET | System status and database connectivity | JSON |
| `/counties` | GET | Washington State county boundaries | GeoJSON |
| `/stations` | GET | Air quality monitoring stations | GeoJSON |
| `/risk-scores` | GET | Environmental risk assessments | JSON |
| `/hotspots` | GET | Pollution hotspot analysis results | GeoJSON |
| `/measurements` | GET | Time-series environmental data | JSON |
| `/statewide-risk` | GET | Comprehensive state analysis | JSON |

### Water Quality Endpoints
| Endpoint | Method | Description | Response Format |
|----------|--------|-------------|-----------------|
| `/water-quality/stations` | GET | Water quality monitoring stations | GeoJSON |
| `/water-quality/parameters` | GET | Available parameters and statistics | JSON |
| `/water-quality/trends` | GET | Time series analysis | JSON |
| `/water-quality/water-body-types` | GET | Coverage by water body type | JSON |
| `/water-quality/alerts` | GET | Threshold violations and alerts | JSON |

**Query Parameters:**
- `county`: Filter by county name
- `station_id`: Specific monitoring station
- `parameter`: Environmental parameter (PM2.5, Ozone, Temperature, pH)
- `active`: Filter active stations only
- `days`: Time range for measurements
- `significance`: Statistical significance level
- `water_body_type`: Water body type filter
- `severity`: Alert severity filter

---

## Key Features

### Multi-Domain Environmental Monitoring
- **Air Quality Integration**: EPA AQS stations with PM2.5, Ozone, SO2, CO, NO2
- **Water Quality Integration**: USGS NWIS stations with temperature, pH, dissolved oxygen
- **Unified Risk Assessment**: Cross-domain environmental risk scoring
- **Spatial Analysis**: Hotspot detection, clustering, and interpolation
- **Real-Time Updates**: Automated daily data refresh from government sources

### Interactive Web Interface
- **Navigation System**: Switch between Air Quality, Water Quality, and Dashboard views
- **Full-Screen Responsive Layout**: Optimized for desktop, tablet, and mobile
- **Multi-Layer Visualization**: Administrative boundaries, monitoring stations, risk zones  
- **Risk-Coded Markers**: EPA-standard color coding (Green=Low Risk, Red=High Risk)
- **Interactive Popups**: Detailed station information with measurement history
- **Advanced Filtering**: Filter by risk level, station type, water body type, alert status
- **Real-Time Alerts**: Visual indicators for environmental threshold violations

### Professional Dashboard
- **Collapsible Sidebar**: Space-efficient design with toggle functionality
- **Live Statistics**: Real-time platform metrics and data counts
- **County Rankings**: Environmental risk scores by geographic area
- **Parameter Health Status**: Color-coded indicators for all monitored parameters
- **Data Freshness**: Visual indicators of last update timestamps
- **Alert Management**: Real-time threshold violation monitoring

### Advanced Spatial Analysis
- **Environmental Risk Scoring**: EPA health-based multi-parameter assessment
- **Hotspot Detection**: Getis-Ord Gi* statistical analysis for pollution clusters
- **Spatial Clustering**: DBSCAN analysis for monitoring station relationships
- **Outlier Detection**: Automated quality assurance and anomaly identification
- **Temporal Analysis**: Trend detection and seasonal pattern analysis

---

## Performance Metrics (Verified)

### API Performance
- **Response Times**: Average 25ms across all endpoints
- **Stress Testing**: 100% success rate with 10 concurrent requests
- **Error Handling**: Proper validation and graceful failure modes
- **Data Volume**: 19MB+ spatial data with sub-second query times

### System Reliability
- **Test Coverage**: 97.1% success rate across 34 comprehensive tests
- **Database Performance**: <100ms for point-in-polygon operations
- **Frontend Load Time**: <2 seconds initial load with full-screen interface
- **Data Integration**: 100% uptime with government API connections

### Data Quality Metrics
- **Completeness**: 100% parameter code coverage across all measurements
- **Accuracy**: All spatial coordinates validated against known monitoring sites
- **Timeliness**: Daily automated updates from government data sources
- **Coverage**: 7 major Washington counties with active monitoring networks

---

## Installation and Setup

### Prerequisites
- **Database**: PostgreSQL 16+ with PostGIS 3.4+
- **Python**: 3.9+ with virtual environment capability
- **Node.js**: 18+ with npm for frontend development
- **API Access**: EPA AQS API credentials (free registration required)

### Quick Start

1. **Clone Repository**
```bash
git clone https://github.com/MegaDeadCowboy/wa-environmental-platform.git
cd wa-environmental-platform
```

2. **Database Setup**
```bash
# Create database with spatial extensions
createdb wa_environmental_platform
psql -d wa_environmental_platform -c "CREATE EXTENSION postgis;"
```

3. **Backend Setup**
```bash
# Create and activate Python virtual environment
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt

# Configure EPA AQS API credentials
export EPA_AQS_EMAIL='your-email@example.com'
export EPA_AQS_API_KEY='your-api-key'
```

4. **Data Integration**
```bash
# Load Washington State administrative boundaries
python3 src/etl/load_boundaries.py

# Load EPA air quality data
python3 src/etl/load_aqs_data.py

# Load USGS water quality data  
python3 src/etl/load_water_with_dataretrieval.py
```

5. **Start Services**
```bash
# Start Flask API server (Terminal 1)
python3 src/api/app.py  # Runs on localhost:5000

# Start React development server (Terminal 2)
cd frontend
npm install
npm run dev           # Runs on localhost:5173
```

6. **Access Application**
- **Web Interface**: http://localhost:5173
- **API Documentation**: http://localhost:5000
- **Health Check**: http://localhost:5000/api/health

### Testing
```bash
# Run comprehensive API test suite
python3 tests/test_all_endpoints.py

# Test individual components
python3 src/analysis/spatial_stats.py  # Spatial analysis verification
python3 src/analysis/risk_scoring.py   # Risk scoring validation
```

---

## Database Schema

### Core Tables
- **monitoring_stations**: 97 stations with enhanced metadata and spatial indexing
- **environmental_measurements**: 1,620+ measurements with standardized parameter codes  
- **parameter_definitions**: EPA/USGS parameter standards and regulatory limits
- **administrative_boundaries**: 39 counties, 606 cities with spatial boundaries
- **environmental_risk_scores**: Multi-domain risk assessments with confidence levels

### Performance Features
- **Spatial Indexes**: GIST indexes on all geometry columns for <100ms spatial queries
- **Compound Indexes**: Optimized for time-series and parameter-based queries
- **Database Views**: Pre-computed station summaries and parameter statistics
- **Data Validation**: Automated quality assurance with comprehensive error checking

---

## Professional Applications

### Environmental Consulting
- **Environmental Impact Assessment**: Multi-domain risk analysis for proposed projects
- **Regulatory Compliance**: EPA data integration and automated reporting
- **Due Diligence**: Property assessment with environmental risk evaluation
- **Climate Resilience**: Long-term environmental monitoring and trend analysis

### Government Agencies
- **Public Health Protection**: Real-time monitoring and alert systems
- **Policy Development**: Data-driven environmental regulation and planning
- **Emergency Response**: Rapid assessment during environmental incidents  
- **Regulatory Enforcement**: Compliance monitoring and violation detection

### Research Institutions  
- **Academic Research**: Platform for environmental health studies
- **Graduate Education**: Real-world dataset for spatial analysis coursework
- **Collaborative Research**: API access for multi-institutional studies
- **Publication Support**: High-quality data for peer-reviewed research

---

## Development Workflow

### Branch Strategy
- **main**: Production-ready code with tagged stable releases
- **feature/water-quality-integration**: Water quality domain expansion (completed)
- **feature/enhanced-api-endpoints**: Additional API functionality (completed)
- **feature/multi-domain-risk-scoring**: Cross-domain risk assessment (completed)

### Testing
```bash
# Run comprehensive test suite (97.1% success rate)
python3 tests/test_all_endpoints.py

# Performance testing
python3 tests/stress_test_api.py

# Data quality validation
python3 src/etl/validate_data_quality.py
```

### Code Quality Standards
- **Type Hints**: Python code uses comprehensive type annotations
- **Documentation**: All functions have docstring documentation
- **Error Handling**: Graceful failure with informative error messages
- **Testing**: Unit tests for all core functionality
- **Performance**: Spatial queries optimized for sub-second response times

---

## Contributing

### Development Setup
1. Fork the repository on GitHub
2. Create feature branch from main
3. Follow existing code style and documentation patterns  
4. Add comprehensive tests for new functionality
5. Submit pull request with detailed description

### Adding New Environmental Domains
The platform architecture supports easy expansion to additional environmental domains:
- Soil quality monitoring
- Noise pollution tracking
- Climate data integration
- Satellite imagery analysis

---

## License and Attribution

### Data Sources
- **Air Quality Data**: EPA Air Quality System (AQS) - Public Domain
- **Water Quality Data**: USGS National Water Information System (NWIS) - Public Domain  
- **Administrative Boundaries**: U.S. Census Bureau TIGER/Line - Public Domain
- **Spatial Analysis**: Original algorithms based on published EPA methodologies

### Software License
Open source project available under MIT License. See LICENSE file for details.

### Citation
If using this platform for research or publication:
```
Environmental Risk Assessment Platform (2025). Multi-domain environmental monitoring 
system for Washington State. https://github.com/MegaDeadCowboy/wa-environmental-platform
```

---

## Contact and Support

**GitHub Repository**: https://github.com/MegaDeadCowboy/wa-environmental-platform  
**Issues and Feature Requests**: GitHub Issues tab
**Technical Documentation**: See `/docs` folder in repository

### Getting Help
1. Check existing GitHub Issues for similar questions
2. Review database schema documentation in `database_schema_readme.md`
3. Examine test files in `/tests` folder for usage examples
4. Create new GitHub Issue with detailed problem description

---

**Current Version**: 2.0-stable  
**Last Updated**: August 30, 2025  
**Platform Status**: Production-ready with active government data integration  
**Test Coverage**: 97.1% success rate across comprehensive endpoint testing

This platform demonstrates production-ready environmental data engineering capabilities with real-world government data integration, suitable for environmental consulting, regulatory compliance, and research applications. The multi-domain architecture provides a foundation for comprehensive environmental monitoring and analysis.