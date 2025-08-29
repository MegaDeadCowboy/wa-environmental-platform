# src/api/app.py
"""
Flask API for Washington State Environmental Risk Assessment Platform
Provides RESTful endpoints for spatial environmental data
"""

from flask import Flask, request, jsonify
from flask_restful import Api, Resource
from flask_cors import CORS
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import logging
import sys
import os

# Add src to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.database import DatabaseManager
from analysis.risk_scoring import EnvironmentalRiskScoring
from analysis.spatial_stats import SpatialStatsEngine

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'wa-environmental-platform-dev-key'

# Enable CORS for frontend integration
CORS(app, origins=["http://localhost:3000", "http://localhost:5173"])

# Initialize Flask-RESTful
api = Api(app)

# Initialize our analysis engines
db = DatabaseManager()
risk_engine = EnvironmentalRiskScoring()
spatial_engine = SpatialStatsEngine()

class HealthCheckResource(Resource):
    """Health check endpoint"""
    
    def get(self):
        try:
            # Test database connection
            db_status = db.test_connection()
            
            return {
                'status': 'healthy' if db_status else 'unhealthy',
                'timestamp': datetime.now().isoformat(),
                'database': 'connected' if db_status else 'disconnected',
                'version': '1.0.0'
            }, 200 if db_status else 503
            
        except Exception as e:
            return {'status': 'error', 'message': str(e)}, 500

class CountiesResource(Resource):
    """Washington State counties with boundaries"""
    
    def get(self):
        try:
            with db.get_connection() as conn:
                from sqlalchemy import text
                
                query = text("""
                    SELECT 
                        name,
                        fips_code,
                        ST_AsGeoJSON(geometry) as geometry
                    FROM administrative_boundaries 
                    WHERE type = 'county'
                    ORDER BY name
                """)
                
                result = conn.execute(query)
                counties = []
                
                for row in result:
                    counties.append({
                        'name': row[0],
                        'fips_code': row[1],
                        'geometry': json.loads(row[2])
                    })
                
                return {
                    'type': 'FeatureCollection',
                    'features': [
                        {
                            'type': 'Feature',
                            'properties': {
                                'name': county['name'],
                                'fips_code': county['fips_code']
                            },
                            'geometry': county['geometry']
                        }
                        for county in counties
                    ]
                }, 200
                
        except Exception as e:
            logger.error(f"Counties endpoint failed: {e}")
            return {'error': str(e)}, 500

class MonitoringStationsResource(Resource):
    """Air quality monitoring stations"""
    
    def get(self):
        try:
            # Get query parameters
            county = request.args.get('county')
            active_only = request.args.get('active', 'true').lower() == 'true'
            
            with db.get_connection() as conn:
                from sqlalchemy import text
                
                query = """
                    SELECT 
                        s.station_id,
                        s.name,
                        s.type,
                        s.agency,
                        s.active,
                        s.metadata,
                        ST_X(s.location) as longitude,
                        ST_Y(s.location) as latitude,
                        b.name as county_name
                    FROM monitoring_stations s
                    LEFT JOIN administrative_boundaries b 
                        ON ST_Within(s.location, b.geometry) AND b.type = 'county'
                    WHERE s.type = 'air_quality'
                """
                
                params = {}
                if active_only:
                    query += " AND s.active = true"
                if county:
                    query += " AND b.name = :county"
                    params['county'] = county
                
                query += " ORDER BY s.station_id"
                
                result = conn.execute(text(query), params)
                stations = []
                
                for row in result:
                    # Handle metadata - it might already be a dict or need JSON parsing
                    metadata = row[5]
                    if isinstance(metadata, str):
                        try:
                            metadata = json.loads(metadata)
                        except:
                            metadata = {}
                    elif metadata is None:
                        metadata = {}
                    
                    stations.append({
                        'type': 'Feature',
                        'properties': {
                            'station_id': row[0],
                            'name': row[1],
                            'type': row[2],
                            'agency': row[3],
                            'active': row[4],
                            'county': row[8],
                            'parameter_name': metadata.get('parameter_name', 'Unknown'),
                            'elevation_m': metadata.get('elevation_m'),
                            'monitor_start_date': metadata.get('monitor_start_date')
                        },
                        'geometry': {
                            'type': 'Point',
                            'coordinates': [float(row[6]), float(row[7])]
                        }
                    })
                
                return {
                    'type': 'FeatureCollection',
                    'features': stations
                }, 200
                
        except Exception as e:
            logger.error(f"Stations endpoint failed: {e}")
            return {'error': str(e)}, 500

class RiskScoresResource(Resource):
    """Environmental risk scores by location"""
    
    def get(self):
        try:
            # Get query parameters
            location_type = request.args.get('type', 'station')  # 'station' or 'county'
            location_id = request.args.get('id')
            
            if location_id:
                # Get specific location risk score
                if location_type == 'station':
                    risk_data = risk_engine.calculate_station_risk_score(location_id)
                else:
                    risk_data = risk_engine.calculate_county_risk_score(location_id)
                
                return risk_data, 200
            else:
                # Get all available risk scores
                with db.get_connection() as conn:
                    from sqlalchemy import text
                    
                    query = text("""
                        SELECT 
                            location_id,
                            location_type,
                            risk_score,
                            risk_category,
                            contributing_factors,
                            calculation_date
                        FROM environmental_risk_scores
                        WHERE location_type = :location_type
                        ORDER BY risk_score DESC
                    """)
                    
                    result = conn.execute(query, {'location_type': location_type})
                    risk_scores = []
                    
                    for row in result:
                        # Handle contributing_factors - might be dict or JSON string
                        contributing_factors = row[4]
                        if isinstance(contributing_factors, str):
                            try:
                                contributing_factors = json.loads(contributing_factors)
                            except:
                                contributing_factors = {}
                        elif contributing_factors is None:
                            contributing_factors = {}
                        
                        risk_scores.append({
                            'location_id': row[0],
                            'location_type': row[1],
                            'risk_score': float(row[2]),
                            'risk_category': row[3],
                            'contributing_factors': contributing_factors,
                            'calculation_date': row[5].isoformat() if row[5] else None
                        })
                    
                    return {'risk_scores': risk_scores}, 200
                    
        except Exception as e:
            logger.error(f"Risk scores endpoint failed: {e}")
            return {'error': str(e)}, 500

class HotspotsResource(Resource):
    """Pollution hotspot detection results"""
    
    def get(self):
        try:
            # Get query parameters
            parameter = request.args.get('parameter')
            significance_level = request.args.get('significance', '95%')
            
            # Run hotspot analysis
            hotspot_results = spatial_engine.detect_pollution_hotspots(
                parameter=parameter,
                significance_level=significance_level
            )
            
            if 'error' in hotspot_results:
                return hotspot_results, 400
            
            # Convert to GeoJSON format
            hotspot_features = []
            
            # Add hotspot stations
            for station in hotspot_results.get('hotspot_stations', []):
                hotspot_features.append({
                    'type': 'Feature',
                    'properties': {
                        'station_id': station['station_id'],
                        'name': station['name'],
                        'hotspot_type': 'HOT_SPOT',
                        'value': station['value'],
                        'z_score': station['z_score'],
                        'p_value': station['p_value']
                    },
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [station['longitude'], station['latitude']]
                    }
                })
            
            # Add coldspot stations
            for station in hotspot_results.get('coldspot_stations', []):
                hotspot_features.append({
                    'type': 'Feature',
                    'properties': {
                        'station_id': station['station_id'],
                        'name': station['name'],
                        'hotspot_type': 'COLD_SPOT',
                        'value': station['value'],
                        'z_score': station['z_score'],
                        'p_value': station['p_value']
                    },
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [station['longitude'], station['latitude']]
                    }
                })
            
            return {
                'analysis_metadata': {
                    'parameter': hotspot_results['parameter'],
                    'significance_level': hotspot_results['significance_level'],
                    'stations_analyzed': hotspot_results['stations_analyzed'],
                    'analysis_date': hotspot_results['analysis_date']
                },
                'summary': hotspot_results['summary'],
                'hotspots': {
                    'type': 'FeatureCollection',
                    'features': hotspot_features
                }
            }, 200
            
        except Exception as e:
            logger.error(f"Hotspots endpoint failed: {e}")
            return {'error': str(e)}, 500

class MeasurementsResource(Resource):
    """Environmental measurements data"""
    
    def get(self):
        try:
            # Get query parameters
            station_id = request.args.get('station_id')
            parameter = request.args.get('parameter')
            days_back = int(request.args.get('days', 30))
            
            if not station_id:
                return {'error': 'station_id is required'}, 400
            
            with db.get_connection() as conn:
                # Get measurements for station
                from sqlalchemy import text
                
                end_date = datetime.now()
                start_date = end_date - timedelta(days=days_back)
                
                query = """
                    SELECT 
                        parameter,
                        value,
                        unit,
                        measurement_date,
                        quality_flag
                    FROM environmental_measurements
                    WHERE station_id = :station_id
                    AND measurement_date BETWEEN :start_date AND :end_date
                """
                
                params = {
                    'station_id': station_id,
                    'start_date': start_date,
                    'end_date': end_date
                }
                
                if parameter:
                    query += " AND parameter = :parameter"
                    params['parameter'] = parameter
                
                query += " ORDER BY measurement_date DESC"
                
                result = conn.execute(text(query), params)
                measurements = []
                
                for row in result:
                    measurements.append({
                        'parameter': row[0],
                        'value': float(row[1]),
                        'unit': row[2],
                        'measurement_date': row[3].isoformat(),
                        'quality_flag': row[4]
                    })
                
                return {
                    'station_id': station_id,
                    'date_range': {
                        'start': start_date.isoformat(),
                        'end': end_date.isoformat()
                    },
                    'measurements': measurements
                }, 200
                
        except Exception as e:
            logger.error(f"Measurements endpoint failed: {e}")
            return {'error': str(e)}, 500

class StatewideRiskResource(Resource):
    """Statewide risk summary and county rankings"""
    
    def get(self):
        try:
            # Calculate statewide risk summary
            statewide_summary = risk_engine.calculate_statewide_risk_summary()
            
            if 'error' in statewide_summary:
                return statewide_summary, 400
            
                            # Add geographic data for county rankings
            if 'county_rankings' in statewide_summary:
                with db.get_connection() as conn:
                    from sqlalchemy import text
                    
                    county_features = []
                    
                    for county_risk in statewide_summary['county_rankings']:
                        county_name = county_risk['county']
                        
                        # Get county geometry
                        query = text("""
                            SELECT ST_AsGeoJSON(geometry)
                            FROM administrative_boundaries
                            WHERE name = :county_name AND type = 'county'
                        """)
                        
                        result = conn.execute(query, {'county_name': county_name})
                        geometry_row = result.fetchone()
                        
                        if geometry_row:
                            county_features.append({
                                'type': 'Feature',
                                'properties': {
                                    'name': county_name,
                                    'risk_score': county_risk['risk_score'],
                                    'risk_level': county_risk['risk_level'],
                                    'station_count': county_risk['station_count'],
                                    'data_availability': county_risk['data_availability']
                                },
                                'geometry': json.loads(geometry_row[0])
                            })
                
                statewide_summary['county_map'] = {
                    'type': 'FeatureCollection',
                    'features': county_features
                }
            
            return statewide_summary, 200
            
        except Exception as e:
            logger.error(f"Statewide risk endpoint failed: {e}")
            return {'error': str(e)}, 500

# Register API routes
api.add_resource(HealthCheckResource, '/api/health')
api.add_resource(CountiesResource, '/api/counties')
api.add_resource(MonitoringStationsResource, '/api/stations')
api.add_resource(RiskScoresResource, '/api/risk-scores')
api.add_resource(HotspotsResource, '/api/hotspots')
api.add_resource(MeasurementsResource, '/api/measurements')
api.add_resource(StatewideRiskResource, '/api/statewide-risk')

@app.route('/')
def home():
    """API documentation homepage"""
    return {
        'name': 'Washington State Environmental Risk Assessment API',
        'version': '1.0.0',
        'description': 'RESTful API for spatial environmental data analysis',
        'endpoints': {
            '/api/health': 'Health check and system status',
            '/api/counties': 'Washington State county boundaries (GeoJSON)',
            '/api/stations': 'Air quality monitoring stations (GeoJSON)',
            '/api/risk-scores': 'Environmental risk scores by location',
            '/api/hotspots': 'Pollution hotspot analysis results (GeoJSON)',
            '/api/measurements': 'Time-series environmental measurements',
            '/api/statewide-risk': 'Statewide risk summary and county rankings'
        },
        'parameters': {
            'county': 'Filter by county name',
            'station_id': 'Specific monitoring station ID',
            'parameter': 'Environmental parameter (PM2.5 Mass, Ozone, etc.)',
            'active': 'Filter active stations only (true/false)',
            'days': 'Number of days for time series (default: 30)',
            'significance': 'Statistical significance level (90%, 95%, 99%)'
        }
    }

@app.errorhandler(404)
def not_found(error):
    return {'error': 'Endpoint not found'}, 404

@app.errorhandler(500)
def internal_error(error):
    return {'error': 'Internal server error'}, 500

if __name__ == '__main__':
    # Test database connection on startup
    logger.info("🚀 Starting Washington State Environmental API...")
    
    if db.test_connection():
        logger.info("✅ Database connection successful")
        logger.info("🌐 API available at: http://localhost:5000")
        logger.info("📖 API documentation: http://localhost:5000")
        
        # Run development server
        app.run(
            host='0.0.0.0',
            port=5000,
            debug=True
        )
    else:
        logger.error("❌ Database connection failed - cannot start API")
        logger.info("Please check your database configuration and connection")