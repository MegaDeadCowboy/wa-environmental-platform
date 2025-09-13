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
                'version': '2.0.0'
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
                    # Handle metadata
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
            location_type = request.args.get('type', 'station')
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
                        # Handle contributing_factors
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

class WaterQualityStationsResource(Resource):
    """Water quality monitoring stations with enhanced metadata"""
    
    def get(self):
        try:
            # Get query parameters
            county = request.args.get('county')
            active_only = request.args.get('active', 'true').lower() == 'true'
            water_body_type = request.args.get('water_body_type')
            
            with db.get_connection() as conn:
                from sqlalchemy import text
                
                query = """
                    SELECT 
                        s.station_id,
                        s.name,
                        s.agency,
                        s.active,
                        s.metadata,
                        ST_X(s.location) as longitude,
                        ST_Y(s.location) as latitude,
                        b.name as county_name,
                        COALESCE(s.water_body_name, s.metadata->>'water_body_name', 'Unknown') as water_body_name,
                        COALESCE(s.water_body_type, s.metadata->>'water_body_type', 'Unknown') as water_body_type,
                        s.huc_code,
                        s.usgs_site_no,
                        s.last_measurement_date,
                        COALESCE(s.measurement_count, 0) as measurement_count
                    FROM monitoring_stations s
                    LEFT JOIN administrative_boundaries b 
                        ON ST_Within(s.location, b.geometry) AND b.type = 'county'
                    WHERE s.type = 'water_quality'
                """
                
                params = {}
                if active_only:
                    query += " AND s.active = true"
                if county:
                    query += " AND b.name = :county"
                    params['county'] = county
                if water_body_type:
                    query += " AND COALESCE(s.water_body_type, s.metadata->>'water_body_type') = :water_body_type"
                    params['water_body_type'] = water_body_type
                
                query += " ORDER BY COALESCE(s.measurement_count, 0) DESC"
                
                result = conn.execute(text(query), params)
                stations = []
                
                for row in result:
                    # Parse metadata
                    metadata = row[4]
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
                            'agency': row[2],
                            'active': row[3],
                            'county': row[7],
                            'water_body_name': row[8],
                            'water_body_type': row[9],
                            'huc_code': row[10],
                            'usgs_site_no': row[11],
                            'last_measurement_date': row[12].isoformat() if row[12] else None,
                            'measurement_count': int(row[13]) if row[13] else 0,
                            'data_provider': metadata.get('data_provider', 'Unknown'),
                            'site_type': metadata.get('site_type', 'Unknown')
                        },
                        'geometry': {
                            'type': 'Point',
                            'coordinates': [float(row[5]), float(row[6])]
                        }
                    })
                
                return {
                    'type': 'FeatureCollection',
                    'features': stations,
                    'summary': {
                        'total_stations': len(stations),
                        'active_stations': len([s for s in stations if s['properties']['active']]),
                        'counties_covered': len(set(s['properties']['county'] for s in stations if s['properties']['county']))
                    }
                }, 200
                
        except Exception as e:
            logger.error(f"Water quality stations endpoint failed: {e}")
            return {'error': str(e)}, 500

class WaterQualityParametersResource(Resource):
    """Available water quality parameters and their statistics"""
    
    def get(self):
        try:
            with db.get_connection() as conn:
                from sqlalchemy import text
                
                query = text("""
                    SELECT 
                        m.parameter,
                        m.unit,
                        COUNT(*) as measurement_count,
                        COUNT(DISTINCT m.station_id) as station_count,
                        AVG(m.value) as avg_value,
                        MIN(m.value) as min_value,
                        MAX(m.value) as max_value,
                        MIN(m.measurement_date) as earliest_date,
                        MAX(m.measurement_date) as latest_date
                    FROM environmental_measurements m
                    JOIN monitoring_stations s ON m.station_id = s.station_id
                    WHERE s.type = 'water_quality'
                    GROUP BY m.parameter, m.unit
                    ORDER BY measurement_count DESC
                """)
                
                result = conn.execute(query)
                parameters = []
                
                for row in result:
                    # Determine parameter health status
                    parameter_name = row[0]
                    avg_value = float(row[4]) if row[4] else None
                    
                    # Basic water quality standards
                    health_status = 'GOOD'
                    if parameter_name == 'pH':
                        if avg_value and (avg_value < 6.5 or avg_value > 8.5):
                            health_status = 'CONCERNING'
                    elif parameter_name == 'Temperature, water' and avg_value:
                        if avg_value > 20:
                            health_status = 'ELEVATED'
                    elif 'Dissolved oxygen' in parameter_name and avg_value:
                        if avg_value < 5.0:
                            health_status = 'LOW'
                    
                    parameters.append({
                        'parameter': parameter_name,
                        'unit': row[1],
                        'measurement_count': row[2],
                        'station_count': row[3],
                        'statistics': {
                            'average': round(avg_value, 3) if avg_value else None,
                            'minimum': float(row[5]) if row[5] else None,
                            'maximum': float(row[6]) if row[6] else None,
                            'health_status': health_status
                        },
                        'date_range': {
                            'earliest': row[7].isoformat() if row[7] else None,
                            'latest': row[8].isoformat() if row[8] else None
                        }
                    })
                
                return {
                    'parameters': parameters,
                    'summary': {
                        'total_parameters': len(parameters),
                        'total_measurements': sum(p['measurement_count'] for p in parameters),
                        'total_stations': len(set(p['station_count'] for p in parameters))
                    }
                }, 200
                
        except Exception as e:
            logger.error(f"Water quality parameters endpoint failed: {e}")
            return {'error': str(e)}, 500

class WaterQualityTrendsResource(Resource):
    """Water quality trends and time series analysis"""
    
    def get(self):
        try:
            station_id = request.args.get('station_id')
            parameter = request.args.get('parameter')
            days_back = int(request.args.get('days', 90))
            
            if not station_id:
                return {'error': 'station_id is required'}, 400
            
            with db.get_connection() as conn:
                from sqlalchemy import text
                
                end_date = datetime.now()
                start_date = end_date - timedelta(days=days_back)
                
                query = """
                    SELECT 
                        m.parameter,
                        m.value,
                        m.unit,
                        m.measurement_date,
                        m.quality_flag
                    FROM environmental_measurements m
                    JOIN monitoring_stations s ON m.station_id = s.station_id
                    WHERE s.type = 'water_quality'
                    AND m.station_id = :station_id
                    AND m.measurement_date BETWEEN :start_date AND :end_date
                """
                
                params = {
                    'station_id': station_id,
                    'start_date': start_date,
                    'end_date': end_date
                }
                
                if parameter:
                    query += " AND m.parameter = :parameter"
                    params['parameter'] = parameter
                
                query += " ORDER BY m.measurement_date ASC"
                
                result = conn.execute(text(query), params)
                measurements = []
                
                for row in result:
                    measurements.append({
                        'parameter': row[0],
                        'value': float(row[1]),
                        'unit': row[2],
                        'date': row[3].isoformat(),
                        'quality_flag': row[4]
                    })
                
                # Group by parameter for trend analysis
                parameter_trends = {}
                for measurement in measurements:
                    param = measurement['parameter']
                    if param not in parameter_trends:
                        parameter_trends[param] = {
                            'parameter': param,
                            'unit': measurement['unit'],
                            'data_points': [],
                            'statistics': {}
                        }
                    
                    parameter_trends[param]['data_points'].append({
                        'date': measurement['date'],
                        'value': measurement['value'],
                        'quality_flag': measurement['quality_flag']
                    })
                
                # Calculate basic statistics for each parameter
                for param_data in parameter_trends.values():
                    values = [dp['value'] for dp in param_data['data_points']]
                    if values:
                        param_data['statistics'] = {
                            'count': len(values),
                            'average': round(sum(values) / len(values), 3),
                            'minimum': min(values),
                            'maximum': max(values),
                            'latest_value': values[-1],
                            'trend': 'stable'
                        }
                
                return {
                    'station_id': station_id,
                    'date_range': {
                        'start': start_date.isoformat(),
                        'end': end_date.isoformat(),
                        'days': days_back
                    },
                    'parameter_trends': list(parameter_trends.values())
                }, 200
                
        except Exception as e:
            logger.error(f"Water quality trends endpoint failed: {e}")
            return {'error': str(e)}, 500

class WaterBodyTypesResource(Resource):
    """Water body types and their monitoring coverage"""
    
    def get(self):
        try:
            with db.get_connection() as conn:
                from sqlalchemy import text
                
                query = text("""
                    SELECT 
                        COALESCE(
                            s.water_body_type, 
                            s.metadata->>'water_body_type', 
                            'Unknown'
                        ) as water_body_type,
                        COUNT(s.station_id) as station_count,
                        COUNT(CASE WHEN s.active = true THEN 1 END) as active_stations,
                        SUM(COALESCE(s.measurement_count, 0)) as total_measurements,
                        MAX(s.last_measurement_date) as latest_measurement
                    FROM monitoring_stations s
                    WHERE s.type = 'water_quality'
                    GROUP BY COALESCE(s.water_body_type, s.metadata->>'water_body_type', 'Unknown')
                    ORDER BY station_count DESC
                """)
                
                result = conn.execute(query)
                water_body_types = []
                
                for row in result:
                    water_body_types.append({
                        'water_body_type': row[0],
                        'station_count': row[1],
                        'active_stations': row[2],
                        'total_measurements': row[3] or 0,
                        'latest_measurement': row[4].isoformat() if row[4] else None,
                        'coverage_status': 'GOOD' if row[2] >= 5 else 'LIMITED'
                    })
                
                return {
                    'water_body_types': water_body_types,
                    'summary': {
                        'total_types': len(water_body_types),
                        'total_stations': sum(wb['station_count'] for wb in water_body_types),
                        'well_covered_types': len([wb for wb in water_body_types if wb['coverage_status'] == 'GOOD'])
                    }
                }, 200
                
        except Exception as e:
            logger.error(f"Water body types endpoint failed: {e}")
            return {'error': str(e)}, 500

class WaterQualityAlertsResource(Resource):
    """Water quality alerts and threshold violations"""
    
    def get(self):
        try:
            days_back = int(request.args.get('days', 7))
            severity = request.args.get('severity', 'all')
            
            with db.get_connection() as conn:
                from sqlalchemy import text
                
                end_date = datetime.now()
                start_date = end_date - timedelta(days=days_back)
                
                query = text("""
                    SELECT 
                        m.station_id,
                        s.name,
                        m.parameter,
                        m.value,
                        m.unit,
                        m.measurement_date,
                        ST_X(s.location) as longitude,
                        ST_Y(s.location) as latitude,
                        b.name as county
                    FROM environmental_measurements m
                    JOIN monitoring_stations s ON m.station_id = s.station_id
                    LEFT JOIN administrative_boundaries b 
                        ON ST_Within(s.location, b.geometry) AND b.type = 'county'
                    WHERE s.type = 'water_quality'
                    AND m.measurement_date BETWEEN :start_date AND :end_date
                    AND (
                        (m.parameter = 'pH' AND (m.value < 6.5 OR m.value > 8.5)) OR
                        (m.parameter LIKE '%Dissolved oxygen%' AND m.value < 5.0) OR
                        (m.parameter = 'Temperature, water' AND m.value > 25.0) OR
                        (m.parameter = 'Turbidity' AND m.value > 10.0)
                    )
                    ORDER BY m.measurement_date DESC
                """)
                
                result = conn.execute(query, {
                    'start_date': start_date,
                    'end_date': end_date
                })
                
                alerts = []
                for row in result:
                    parameter = row[2]
                    value = float(row[3])
                    
                    alert_severity = 'WARNING'
                    alert_message = f"{parameter} outside normal range"
                    
                    if parameter == 'pH':
                        if value < 6.0 or value > 9.0:
                            alert_severity = 'CRITICAL'
                            alert_message = f"pH critically outside safe range: {value}"
                        else:
                            alert_message = f"pH outside optimal range: {value}"
                    elif 'Dissolved oxygen' in parameter:
                        if value < 3.0:
                            alert_severity = 'CRITICAL'
                            alert_message = f"Critically low dissolved oxygen: {value} mg/L"
                        else:
                            alert_message = f"Low dissolved oxygen: {value} mg/L"
                    elif parameter == 'Temperature, water':
                        if value > 30.0:
                            alert_severity = 'CRITICAL'
                            alert_message = f"Critically high water temperature: {value}°C"
                        else:
                            alert_message = f"Elevated water temperature: {value}°C"
                    
                    if severity != 'all' and alert_severity.lower() != severity.lower():
                        continue
                    
                    alerts.append({
                        'alert_id': f"{row[0]}-{row[2]}-{row[5].strftime('%Y%m%d%H%M')}",
                        'station_id': row[0],
                        'station_name': row[1],
                        'parameter': parameter,
                        'value': value,
                        'unit': row[4],
                        'measurement_date': row[5].isoformat(),
                        'location': {
                            'longitude': float(row[6]),
                            'latitude': float(row[7])
                        },
                        'county': row[8],
                        'severity': alert_severity,
                        'message': alert_message,
                        'alert_generated': datetime.now().isoformat()
                    })
                
                return {
                    'alerts': alerts,
                    'summary': {
                        'total_alerts': len(alerts),
                        'critical_alerts': len([a for a in alerts if a['severity'] == 'CRITICAL']),
                        'warning_alerts': len([a for a in alerts if a['severity'] == 'WARNING']),
                        'date_range': {
                            'start': start_date.isoformat(),
                            'end': end_date.isoformat()
                        }
                    }
                }, 200
                
        except Exception as e:
            logger.error(f"Water quality alerts endpoint failed: {e}")
            return {'error': str(e)}, 500

# Register API routes - ENHANCED WITH WATER QUALITY ENDPOINTS
api.add_resource(HealthCheckResource, '/api/health')
api.add_resource(CountiesResource, '/api/counties')
api.add_resource(MonitoringStationsResource, '/api/stations')
api.add_resource(RiskScoresResource, '/api/risk-scores')
api.add_resource(HotspotsResource, '/api/hotspots')
api.add_resource(MeasurementsResource, '/api/measurements')
api.add_resource(StatewideRiskResource, '/api/statewide-risk')

# NEW WATER QUALITY ENDPOINTS
api.add_resource(WaterQualityStationsResource, '/api/water-quality/stations')
api.add_resource(WaterQualityParametersResource, '/api/water-quality/parameters')
api.add_resource(WaterQualityTrendsResource, '/api/water-quality/trends')
api.add_resource(WaterBodyTypesResource, '/api/water-quality/water-body-types')
api.add_resource(WaterQualityAlertsResource, '/api/water-quality/alerts')

@app.route('/')
def home():
    """API documentation homepage"""
    return {
        'name': 'Washington State Environmental Risk Assessment API',
        'version': '2.0.0',
        'description': 'RESTful API for multi-domain spatial environmental data analysis',
        'endpoints': {
            '/api/health': 'Health check and system status',
            '/api/counties': 'Washington State county boundaries (GeoJSON)',
            '/api/stations': 'Air quality monitoring stations (GeoJSON)',
            '/api/risk-scores': 'Environmental risk scores by location',
            '/api/hotspots': 'Pollution hotspot analysis results (GeoJSON)',
            '/api/measurements': 'Time-series environmental measurements',
            '/api/statewide-risk': 'Statewide risk summary and county rankings',
            '/api/water-quality/stations': 'Water quality monitoring stations (GeoJSON)',
            '/api/water-quality/parameters': 'Available water quality parameters and statistics',
            '/api/water-quality/trends': 'Water quality trends and time series data',
            '/api/water-quality/water-body-types': 'Water body types and coverage analysis',
            '/api/water-quality/alerts': 'Water quality alerts and threshold violations'
        },
        'parameters': {
            'county': 'Filter by county name',
            'station_id': 'Specific monitoring station ID',
            'parameter': 'Environmental parameter (PM2.5 Mass, Ozone, Temperature, pH, etc.)',
            'active': 'Filter active stations only (true/false)',
            'days': 'Number of days for time series (default: 30)',
            'significance': 'Statistical significance level (90%, 95%, 99%)',
            'water_body_type': 'Water body type filter (Stream, Lake, River)',
            'severity': 'Alert severity filter (critical, warning, all)'
        },
        'data_domains': {
            'air_quality': 'EPA AQS stations with PM2.5, Ozone, SO2, CO, NO2 measurements',
            'water_quality': 'USGS NWIS stations with temperature, pH, dissolved oxygen measurements'
        },
        'total_stations': 97,
        'total_measurements': '1,620+',
        'coverage': '7 Washington counties with real-time government data integration'
    }

@app.errorhandler(404)
def not_found(error):
    return {'error': 'Endpoint not found'}, 404

@app.errorhandler(500)
def internal_error(error):
    return {'error': 'Internal server error'}, 500

if __name__ == '__main__':
    # Test database connection on startup
    logger.info("Starting Washington State Environmental API...")
    
    if db.test_connection():
        logger.info("Database connection successful")
        logger.info("API available at: http://localhost:5000")
        logger.info("API documentation: http://localhost:5000")
        
        # Run development server
        app.run(
            host='0.0.0.0',
            port=5000,
            debug=True
        )
    else:
        logger.error("Database connection failed - cannot start API")
        logger.info("Please check your database configuration and connection")