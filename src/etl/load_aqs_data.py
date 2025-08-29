# src/etl/load_aqs_data.py
"""
EPA Air Quality System (AQS) API Data Connector
Loads monitoring stations and air quality measurements for Washington State
"""

import os
import time
import requests
import pandas as pd
import geopandas as gpd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import logging
import json
from sqlalchemy import text

# Import our database manager
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.database import DatabaseManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AQSDataConnector:
    """
    Connects to EPA AQS API and loads air quality data for Washington State
    
    EPA AQS API Documentation: https://aqs.epa.gov/aqsweb/documents/data_api.html
    Registration required at: https://aqs.epa.gov/aqsweb/signup.html
    """
    
    def __init__(self, email: str, api_key: str):
        self.email = email
        self.api_key = api_key
        self.base_url = "https://aqs.epa.gov/data/api"
        self.db = DatabaseManager()
        
        # Washington State FIPS code
        self.wa_state_code = "53"
        
        # Key air quality parameters
        self.parameters = {
            "44201": "Ozone",           # 8-hour average ozone
            "81102": "PM10 Mass",       # PM10 particulate matter  
            "88101": "PM2.5 Mass",      # PM2.5 particulate matter
            "42401": "SO2",             # Sulfur dioxide
            "42101": "CO",              # Carbon monoxide
            "42602": "NO2"              # Nitrogen dioxide
        }
        
        # Rate limiting: EPA requests max 10 requests/minute, 5 second pause
        self.rate_limit_delay = 5
    
    def _make_api_request(self, endpoint: str, params: Dict) -> Optional[Dict]:
        """
        Make authenticated request to AQS API with error handling
        """
        # Add authentication to all requests
        params.update({
            'email': self.email,
            'key': self.api_key
        })
        
        url = f"{self.base_url}/{endpoint}"
        
        try:
            logger.info(f"Making request to: {endpoint}")
            response = requests.get(url, params=params, timeout=60)
            
            # Rate limiting pause
            time.sleep(self.rate_limit_delay)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check API response status
                if data.get('Header', [{}])[0].get('status') == 'Success':
                    logger.info(f"✅ Success: {data['Header'][0].get('rows', 0)} rows returned")
                    return data
                elif data.get('Header', [{}])[0].get('status') == 'No data matched your selection':
                    logger.warning(f"⚠️  No data found for request: {endpoint}")
                    return {'Header': [{'rows': 0}], 'Data': [], 'Body': []}  # Include both Data and Body
                else:
                    logger.error(f"❌ API Error: {data.get('Header', [{}])[0]}")
                    return None
            else:
                logger.error(f"❌ HTTP Error {response.status_code}: {response.text}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Request failed: {e}")
            return None
    
    def get_wa_counties(self) -> List[Dict]:
        """Get list of Washington State counties for API queries"""
        endpoint = "list/countiesByState"
        params = {'state': self.wa_state_code}
        
        response = self._make_api_request(endpoint, params)
        if response and response.get('Data'):  # Fixed: EPA uses 'Data' not 'Body' for this endpoint
            return response['Data']
        return []
    
    def load_monitoring_stations(self, parameter_codes: List[str] = None) -> bool:
        """
        Load air quality monitoring stations for Washington State
        
        Args:
            parameter_codes: List of AQS parameter codes to filter by
        """
        if not parameter_codes:
            # Try multiple parameters to increase chance of finding stations
            parameter_codes = ["88101", "44201", "42401"]  # PM2.5, Ozone, SO2
        
        logger.info(f"Loading monitoring stations for parameters: {parameter_codes}")
        
        all_stations = []
        counties = self.get_wa_counties()
        
        if not counties:
            logger.error("❌ Could not retrieve county list")
            return False
        
        logger.info(f"Processing {len(counties)} Washington counties")
        
        # Focus on major counties that are more likely to have monitors
        priority_counties = ['033', '053', '061', '035', '011', '067', '015', '073']  # King, Pierce, Snohomish, Kitsap, Clark, Thurston, Chelan, Whatcom
        
        # Filter to priority counties first, then try others if needed
        priority_county_data = [c for c in counties if c['code'] in priority_counties]
        
        counties_to_process = priority_county_data if priority_county_data else counties[:10]  # Process priority or first 10
        
        logger.info(f"Focusing on {len(counties_to_process)} priority counties")
        
        for county in counties_to_process:
            county_code = county['code']
            county_name = county['value_represented']
            
            logger.info(f"Processing {county_name} County ({county_code})")
            
            for param_code in parameter_codes:
                # Get monitoring stations for this county and parameter
                endpoint = "monitors/byCounty"
                params = {
                    'state': self.wa_state_code,
                    'county': county_code,
                    'param': param_code,
                    'bdate': '20240101',  # Try 2024 data - more recent
                    'edate': '20241231'
                }
                
                logger.info(f"Looking for {param_code} monitors in {county_name} ({county_code})")
                response = self._make_api_request(endpoint, params)
                
                if response and response.get('Data'):  # Fixed: EPA uses 'Data' for monitor endpoints
                    for station in response['Data']:
                        station_info = {
                            'station_id': f"{station['state_code']}-{station['county_code']}-{station['site_number']}",
                            'name': f"{station.get('local_site_name', 'Unknown')} - {county_name}",
                            'type': 'air_quality',
                            'agency': station.get('owning_agency', 'Unknown'),
                            'location': f"POINT({station['longitude']} {station['latitude']})",
                            'active': True,
                            'metadata': {
                                'state_code': station['state_code'],
                                'county_code': station['county_code'],
                                'site_number': station['site_number'],
                                'latitude': station['latitude'],
                                'longitude': station['longitude'],
                                'elevation_m': station.get('elevation', None),
                                'land_use': station.get('land_use', None),
                                'location_setting': station.get('location_setting', None),
                                'parameter_code': param_code,
                                'parameter_name': self.parameters.get(param_code, param_code),
                                'monitor_start_date': station.get('monitor_start_date', None),
                                'monitor_end_date': station.get('last_sample_date', None)
                            }
                        }
                        all_stations.append(station_info)
        
        if all_stations:
            # Convert to DataFrame and save to database
            stations_df = pd.DataFrame(all_stations)
            
            # Remove duplicates (stations may monitor multiple parameters)
            stations_df = stations_df.drop_duplicates(subset=['station_id'])
            
            logger.info(f"Loading {len(stations_df)} unique monitoring stations to database")
            
            # Save to database
            success = self._load_stations_to_db(stations_df)
            if success:
                logger.info("✅ Successfully loaded monitoring stations")
                return True
            else:
                logger.error("❌ Failed to load stations to database")
                return False
        else:
            logger.warning("⚠️  No monitoring stations found")
            return False
    
    def _load_stations_to_db(self, stations_df: pd.DataFrame) -> bool:
        """Load stations DataFrame to PostGIS database"""
        try:
            with self.db.get_connection() as conn:
                # Check for existing stations to avoid duplicates
                for _, station in stations_df.iterrows():
                    check_query = text("""
                        SELECT COUNT(*) FROM monitoring_stations 
                        WHERE station_id = :station_id
                    """)
                    
                    result = conn.execute(check_query, {'station_id': station['station_id']})
                    exists = result.fetchone()[0] > 0
                    
                    if not exists:
                        insert_query = text("""
                            INSERT INTO monitoring_stations 
                            (station_id, name, type, agency, location, active, metadata)
                            VALUES (:station_id, :name, :type, :agency, 
                                   ST_GeomFromText(:location, 4326), :active, :metadata)
                        """)
                        
                        conn.execute(insert_query, {
                            'station_id': station['station_id'],
                            'name': station['name'],
                            'type': station['type'],
                            'agency': station['agency'],
                            'location': station['location'],
                            'active': station['active'],
                            'metadata': json.dumps(station['metadata'])  # Convert dict to JSON string
                        })
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Database error: {e}")
            return False
    
    def load_recent_measurements(self, days_back: int = 30, parameter_codes: List[str] = None) -> bool:
        """
        Load recent air quality measurements for Washington State
        
        Args:
            days_back: Number of days of historical data to load
            parameter_codes: List of AQS parameter codes to load
        """
        if not parameter_codes:
            parameter_codes = ["88101"]  # PM2.5
        
        # EPA data has 3-6 month delay, so look at data from early 2024
        end_date = datetime(2024, 6, 30)  # June 2024 (should have data)
        start_date = datetime(2024, 6, 1)   # One month of data
        
        logger.info(f"Loading measurements from {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
        
        all_measurements = []
        
        # Only check counties where we found stations
        counties_with_stations = ['011', '033', '035', '053', '061', '067', '073']  # Clark, King, Kitsap, Pierce, Snohomish, Thurston, Whatcom
        
        county_names = {
            '011': 'Clark',
            '033': 'King', 
            '035': 'Kitsap',
            '053': 'Pierce',
            '061': 'Snohomish',
            '067': 'Thurston',
            '073': 'Whatcom'
        }
        
        for county_code in counties_with_stations[:3]:  # Limit to first 3 for testing
            county_code = county['code']
            county_name = county['value_represented']
            
            logger.info(f"Loading data for {county_name} County")
            
            for param_code in parameter_codes:
                # Get daily summary data (more manageable than raw samples)
                endpoint = "dailyData/byCounty"
                params = {
                    'state': self.wa_state_code,
                    'county': county_code,
                    'param': param_code,
                    'bdate': start_date.strftime('%Y%m%d'),
                    'edate': end_date.strftime('%Y%m%d')
                }
                
                response = self._make_api_request(endpoint, params)
                
                if response and response.get('Data'):  # Fixed: EPA uses 'Data' for daily data endpoints
                    for measurement in response['Data']:
                        # Create standardized measurement record
                        station_id = f"{measurement['state_code']}-{measurement['county_code']}-{measurement['site_number']}"
                        
                        measurement_record = {
                            'station_id': station_id,
                            'parameter': self.parameters.get(param_code, param_code),
                            'value': measurement.get('arithmetic_mean', measurement.get('first_max_value')),
                            'unit': measurement.get('units_of_measure', 'μg/m³'),
                            'measurement_date': pd.to_datetime(measurement['date_local']),
                            'data_source': 'EPA AQS API',
                            'quality_flag': 'VALID' if measurement.get('event_type') == 'None' else 'SUSPECT'
                        }
                        all_measurements.append(measurement_record)
        
        if all_measurements:
            measurements_df = pd.DataFrame(all_measurements)
            logger.info(f"Loaded {len(measurements_df)} measurements")
            
            # Save to database
            success = self._load_measurements_to_db(measurements_df)
            if success:
                logger.info("✅ Successfully loaded measurements")
                return True
            else:
                logger.error("❌ Failed to load measurements")
                return False
        else:
            logger.warning("⚠️  No measurements found")
            return False
    
    def _load_measurements_to_db(self, measurements_df: pd.DataFrame) -> bool:
        """Load measurements DataFrame to database"""
        try:
            with self.db.get_connection() as conn:
                for _, measurement in measurements_df.iterrows():
                    # Check for duplicates
                    check_query = text("""
                        SELECT COUNT(*) FROM environmental_measurements 
                        WHERE station_id = :station_id 
                        AND parameter = :parameter 
                        AND measurement_date = :measurement_date
                    """)
                    
                    result = conn.execute(check_query, {
                        'station_id': measurement['station_id'],
                        'parameter': measurement['parameter'],
                        'measurement_date': measurement['measurement_date']
                    })
                    
                    if result.fetchone()[0] == 0:  # No duplicate found
                        insert_query = text("""
                            INSERT INTO environmental_measurements 
                            (station_id, parameter, value, unit, measurement_date, 
                             data_source, quality_flag)
                            VALUES (:station_id, :parameter, :value, :unit, 
                                   :measurement_date, :data_source, :quality_flag)
                        """)
                        
                        conn.execute(insert_query, {
                            'station_id': measurement['station_id'],
                            'parameter': measurement['parameter'],
                            'value': measurement['value'],
                            'unit': measurement['unit'],
                            'measurement_date': measurement['measurement_date'],
                            'data_source': measurement['data_source'],
                            'quality_flag': measurement['quality_flag']
                        })
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Database error: {e}")
            return False
    
    def run_full_etl(self):
        """
        Run complete ETL process for AQS data
        """
        logger.info("🚀 Starting EPA AQS data ETL process")
        
        # Step 1: Load monitoring stations
        logger.info("📍 Loading monitoring stations...")
        stations_success = self.load_monitoring_stations(['88101', '44201'])  # PM2.5 and Ozone stations
        
        if not stations_success:
            logger.error("❌ Station loading failed, stopping ETL")
            return False
        
        # Step 2: Load recent measurements  
        logger.info("📊 Loading recent measurements...")
        measurements_success = self.load_recent_measurements(days_back=7, parameter_codes=['88101', '44201'])
        
        if not measurements_success:
            logger.error("❌ Measurements loading failed")
            return False
        
        # Step 3: Verify data load
        logger.info("✅ Verifying data load...")
        self._verify_data_load()
        
        logger.info("🎉 EPA AQS ETL process completed successfully!")
        return True
    
    def _verify_data_load(self):
        """Verify the loaded data"""
        try:
            with self.db.get_connection() as conn:
                # Count stations
                result = conn.execute(text("SELECT COUNT(*) FROM monitoring_stations WHERE type = 'air_quality'"))
                station_count = result.fetchone()[0]
                
                # Count measurements
                result = conn.execute(text("SELECT COUNT(*) FROM environmental_measurements"))
                measurement_count = result.fetchone()[0]
                
                # Test spatial join
                result = conn.execute(text("""
                    SELECT b.name as county, COUNT(s.station_id) as station_count
                    FROM administrative_boundaries b
                    LEFT JOIN monitoring_stations s ON ST_Within(s.location, b.geometry)
                    WHERE b.type = 'county' AND s.type = 'air_quality'
                    GROUP BY b.name
                    ORDER BY station_count DESC
                    LIMIT 5
                """))
                
                spatial_results = result.fetchall()
                
                logger.info(f"📊 Data verification results:")
                logger.info(f"   • Air quality stations: {station_count}")
                logger.info(f"   • Total measurements: {measurement_count}")
                logger.info(f"   • Stations by county:")
                
                for county, count in spatial_results:
                    logger.info(f"     - {county}: {count} stations")
                
        except Exception as e:
            logger.error(f"Verification failed: {e}")


def main():
    """
    Demo script for EPA AQS data loading
    
    REQUIREMENTS:
    1. Sign up for EPA AQS API at: https://aqs.epa.gov/aqsweb/signup.html
    2. Set environment variables: EPA_AQS_EMAIL and EPA_AQS_API_KEY
    3. Ensure database is set up with Phase 1 boundaries loaded
    """
    
    # Get API credentials from environment
    email = os.getenv('EPA_AQS_EMAIL')
    api_key = os.getenv('EPA_AQS_API_KEY')
    
    if not email or not api_key:
        logger.error("❌ EPA AQS credentials not found!")
        logger.info("Please set environment variables:")
        logger.info("   export EPA_AQS_EMAIL='your-email@example.com'")
        logger.info("   export EPA_AQS_API_KEY='your-api-key'")
        logger.info("Sign up at: https://aqs.epa.gov/aqsweb/signup.html")
        return
    
    # Initialize connector
    connector = AQSDataConnector(email, api_key)
    
    # Test database connection first
    if not connector.db.test_connection():
        logger.error("❌ Database connection failed")
        return
    
    # Run ETL process
    success = connector.run_full_etl()
    
    if success:
        logger.info("✅ AQS data integration complete!")
        logger.info("Ready for Phase 3: Spatial Analysis Engine")
    else:
        logger.error("❌ AQS data integration failed")


if __name__ == "__main__":
    main()