# src/etl/load_water_quality_fixed.py
"""
FIXED Water Quality Data Integration for Washington State Environmental Platform
Working version with correct Water Quality Portal API parameters

FIXES APPLIED:
- Correct parameter names (statecode, not bBox)  
- Proper state code format (US:53 for Washington)
- Simplified approach focusing on working parameters first
- Better error handling and debugging
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
import numpy as np

# Import our database manager
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.database import DatabaseManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WaterQualityConnectorFixed:
    """
    FIXED Water Quality Portal integration for Washington State
    Uses correct API parameters and simplified approach
    """
    
    def __init__(self):
        self.wqp_base_url = "https://www.waterqualitydata.us"
        self.db = DatabaseManager()
        
        # Washington State code in WQP format
        self.wa_state_code = "US:53"  # Format: US:FIPS_STATE_CODE
        
        # Key water quality parameters (simplified for initial testing)
        self.key_parameters = [
            "pH",
            "Temperature, water", 
            "Dissolved oxygen (DO)",
            "Turbidity"
        ]
        
        # Rate limiting for API calls
        self.rate_limit_delay = 3  # Increased delay to be conservative
        
    def _make_wqp_request(self, endpoint: str, params: Dict) -> Optional[requests.Response]:
        """Make request to Water Quality Portal with enhanced error handling"""
        url = f"{self.wqp_base_url}{endpoint}"
        
        # Log the full request URL for debugging
        param_string = "&".join([f"{k}={v}" for k, v in params.items()])
        full_url = f"{url}?{param_string}"
        logger.info(f"🔗 Full request URL: {full_url}")
        
        try:
            logger.info(f"Making WQP request: {endpoint}")
            logger.info(f"Parameters: {params}")
            
            response = requests.get(url, params=params, timeout=120)  # Increased timeout
            
            # Rate limiting
            time.sleep(self.rate_limit_delay)
            
            logger.info(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                content_length = len(response.content)
                logger.info(f"✅ WQP request successful: {content_length} bytes")
                
                # Log first part of response for debugging
                if hasattr(response, 'text') and response.text:
                    logger.info(f"Response preview: {response.text[:200]}...")
                
                return response
            else:
                logger.error(f"❌ WQP HTTP Error {response.status_code}")
                logger.error(f"Response text: {response.text[:500]}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ WQP Request failed: {e}")
            return None
    
    def test_wqp_connection(self) -> bool:
        """Test basic WQP connectivity with a simple request"""
        logger.info("🧪 Testing WQP connection with simple request...")
        
        endpoint = "/data/Station/search"
        
        # Simple test: get one station from a known county
        params = {
            'mimeType': 'csv',
            'zip': 'no',
            'statecode': self.wa_state_code,
            'countycode': 'US:53:033',  # King County
            'sorted': 'yes'
        }
        
        response = self._make_wqp_request(endpoint, params)
        
        if response and response.status_code == 200:
            logger.info("✅ WQP connection test successful")
            return True
        else:
            logger.error("❌ WQP connection test failed")
            return False
    
    def get_wa_water_monitoring_stations(self, max_per_county: int = 20) -> List[Dict]:
        """
        Get water quality monitoring stations in Washington State
        Uses state code approach with county-by-county requests
        """
        logger.info("🔍 Fetching water quality monitoring stations for Washington State...")
        
        # Major Washington counties with likely water monitoring
        wa_counties = {
            'US:53:033': 'King County',      # Seattle
            'US:53:053': 'Pierce County',    # Tacoma  
            'US:53:061': 'Snohomish County', # Everett
            'US:53:067': 'Thurston County',  # Olympia
            'US:53:011': 'Clark County',     # Vancouver
            'US:53:035': 'Kitsap County',    # Bremerton
            'US:53:073': 'Whatcom County'    # Bellingham
        }
        
        all_stations = []
        
        for county_code, county_name in wa_counties.items():
            logger.info(f"📍 Fetching stations for {county_name} ({county_code})")
            
            endpoint = "/data/Station/search"
            
            params = {
                'mimeType': 'csv',
                'zip': 'no',
                'statecode': self.wa_state_code,
                'countycode': county_code,
                'providers': 'NWIS',  # Start with USGS only for reliability
                'sorted': 'yes'
            }
            
            response = self._make_wqp_request(endpoint, params)
            
            if response and response.status_code == 200:
                try:
                    # Parse CSV response
                    from io import StringIO
                    df = pd.read_csv(StringIO(response.text))
                    
                    logger.info(f"📊 Found {len(df)} stations in {county_name}")
                    
                    # Process stations (limit per county to manage data volume)
                    county_stations = []
                    for _, row in df.head(max_per_county).iterrows():
                        # Skip stations without coordinates
                        if pd.isna(row.get('LatitudeMeasure')) or pd.isna(row.get('LongitudeMeasure')):
                            continue
                        
                        station_data = {
                            'station_id': f"WQ-{row.get('MonitoringLocationIdentifier', 'UNKNOWN')}",
                            'original_id': str(row.get('MonitoringLocationIdentifier', '')),
                            'name': str(row.get('MonitoringLocationName', 'Unknown Water Station'))[:255],  # Truncate long names
                            'type': 'water_quality',
                            'agency': str(row.get('OrganizationIdentifier', 'Unknown'))[:100],
                            'location': f"POINT({row['LongitudeMeasure']} {row['LatitudeMeasure']})",
                            'active': True,
                            'metadata': {
                                'latitude': float(row['LatitudeMeasure']),
                                'longitude': float(row['LongitudeMeasure']),
                                'original_id': str(row.get('MonitoringLocationIdentifier', '')),
                                'site_type': str(row.get('MonitoringLocationTypeName', 'Unknown'))[:100],
                                'county': county_name,
                                'county_code': county_code,
                                'state': 'WA',
                                'huc_code': str(row.get('HUCEightDigitCode', ''))[:20],
                                'provider_name': str(row.get('ProviderName', ''))[:100],
                                'organization_name': str(row.get('OrganizationFormalName', ''))[:255],
                                'description': str(row.get('MonitoringLocationDescriptionText', ''))[:500],
                                'water_body_name': str(row.get('ResolvedMonitoringLocationTypeName', ''))[:255]
                            }
                        }
                        county_stations.append(station_data)
                    
                    all_stations.extend(county_stations)
                    logger.info(f"✅ Processed {len(county_stations)} valid stations from {county_name}")
                    
                except Exception as e:
                    logger.error(f"❌ Failed to parse stations for {county_name}: {e}")
                    continue
            else:
                logger.warning(f"⚠️ No data returned for {county_name}")
        
        logger.info(f"🎯 Total water quality stations found: {len(all_stations)}")
        return all_stations
    
    def get_sample_measurements(self, station_original_id: str, max_results: int = 100) -> List[Dict]:
        """
        Get a sample of recent water quality measurements for a station
        Simplified approach for initial testing
        """
        logger.info(f"🔍 Getting sample measurements for station {station_original_id}")
        
        endpoint = "/data/Result/search"
        
        # Get recent data (last year)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365)
        
        params = {
            'mimeType': 'csv',
            'zip': 'no',
            'siteid': station_original_id,
            'startDateLo': start_date.strftime('%m-%d-%Y'),
            'startDateHi': end_date.strftime('%m-%d-%Y'),
            'sorted': 'yes'
        }
        
        response = self._make_wqp_request(endpoint, params)
        
        if response and response.status_code == 200:
            try:
                from io import StringIO
                df = pd.read_csv(StringIO(response.text))
                
                logger.info(f"📊 Found {len(df)} raw measurements for {station_original_id}")
                
                measurements = []
                processed_count = 0
                
                for _, row in df.head(max_results).iterrows():
                    # Skip rows without valid measurement values
                    if pd.isna(row.get('ResultMeasureValue')):
                        continue
                    
                    # Parse activity date
                    activity_date = row.get('ActivityStartDate')
                    if pd.isna(activity_date):
                        continue
                    
                    try:
                        measurement_date = pd.to_datetime(activity_date)
                    except:
                        continue
                    
                    # Get parameter info
                    characteristic_name = str(row.get('CharacteristicName', 'Unknown'))
                    
                    # Create measurement record
                    measurement = {
                        'station_id': f"WQ-{station_original_id}",
                        'parameter': characteristic_name[:100],  # Truncate long parameter names
                        'value': float(row['ResultMeasureValue']),
                        'unit': str(row.get('ResultMeasure.MeasureUnitCode', 'Unknown'))[:20],
                        'measurement_date': measurement_date,
                        'data_source': 'Water Quality Portal',
                        'quality_flag': 'VALID',  # Simplified for now
                    }
                    measurements.append(measurement)
                    processed_count += 1
                
                logger.info(f"✅ Processed {processed_count} valid measurements for {station_original_id}")
                return measurements
                
            except Exception as e:
                logger.error(f"❌ Failed to parse measurements for {station_original_id}: {e}")
                return []
        
        logger.warning(f"⚠️ No measurements found for {station_original_id}")
        return []
    
    def load_stations_to_database(self, stations: List[Dict]) -> bool:
        """Load water quality stations to database with better error handling"""
        if not stations:
            logger.warning("⚠️ No stations to load")
            return False
            
        logger.info(f"💾 Loading {len(stations)} water quality stations to database...")
        
        try:
            with self.db.get_connection() as conn:
                loaded_count = 0
                for station in stations:
                    try:
                        # Check if station already exists
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
                                'metadata': json.dumps(station['metadata'])
                            })
                            loaded_count += 1
                        else:
                            logger.debug(f"Station {station['station_id']} already exists, skipping")
                    
                    except Exception as e:
                        logger.error(f"Failed to load station {station.get('station_id', 'Unknown')}: {e}")
                        continue
                
                conn.commit()
                logger.info(f"✅ Successfully loaded {loaded_count} new water quality stations")
                return loaded_count > 0
                
        except Exception as e:
            logger.error(f"❌ Failed to load stations to database: {e}")
            return False
    
    def load_measurements_to_database(self, measurements: List[Dict]) -> bool:
        """Load measurements with better error handling"""
        if not measurements:
            logger.warning("⚠️ No measurements to load")
            return False
            
        logger.info(f"💾 Loading {len(measurements)} water quality measurements...")
        
        try:
            with self.db.get_connection() as conn:
                loaded_count = 0
                for measurement in measurements:
                    try:
                        # Simplified duplicate check
                        insert_query = text("""
                            INSERT INTO environmental_measurements 
                            (station_id, parameter, value, unit, measurement_date, 
                             data_source, quality_flag)
                            VALUES (:station_id, :parameter, :value, :unit, 
                                   :measurement_date, :data_source, :quality_flag)
                            ON CONFLICT DO NOTHING
                        """)
                        
                        result = conn.execute(insert_query, {
                            'station_id': measurement['station_id'],
                            'parameter': measurement['parameter'],
                            'value': measurement['value'],
                            'unit': measurement['unit'],
                            'measurement_date': measurement['measurement_date'],
                            'data_source': measurement['data_source'],
                            'quality_flag': measurement['quality_flag']
                        })
                        
                        if result.rowcount > 0:
                            loaded_count += 1
                    
                    except Exception as e:
                        logger.error(f"Failed to load measurement: {e}")
                        continue
                
                conn.commit()
                logger.info(f"✅ Successfully loaded {loaded_count} new measurements")
                return loaded_count > 0
                
        except Exception as e:
            logger.error(f"❌ Failed to load measurements: {e}")
            return False
    
    def run_simplified_water_etl(self, include_measurements: bool = False):
        """
        Run simplified water quality ETL process
        Focus on getting stations working first, then add measurements
        """
        logger.info("🚀 Starting SIMPLIFIED Water Quality ETL Process")
        logger.info("="*60)
        
        # Step 0: Test connectivity
        logger.info("🧪 Step 0: Testing WQP API connectivity")
        if not self.test_wqp_connection():
            logger.error("❌ WQP connectivity test failed, stopping ETL")
            return False
        
        # Step 1: Load monitoring stations
        logger.info("📍 Step 1: Loading Water Quality Monitoring Stations")
        stations = self.get_wa_water_monitoring_stations(max_per_county=10)  # Start small
        
        if not stations:
            logger.error("❌ No water quality stations found, stopping ETL")
            return False
        
        stations_success = self.load_stations_to_database(stations)
        
        if not stations_success:
            logger.error("❌ Failed to load stations, stopping ETL")
            return False
        
        # Step 2: Load sample measurements (optional)
        if include_measurements:
            logger.info("📊 Step 2: Loading Sample Water Quality Measurements")
            
            # Test with first few stations
            test_stations = stations[:3]  # Test with 3 stations
            all_measurements = []
            
            for station in test_stations:
                original_id = station['metadata']['original_id']
                measurements = self.get_sample_measurements(original_id, max_results=50)
                all_measurements.extend(measurements)
                
                # Rate limiting
                time.sleep(2)
            
            if all_measurements:
                measurements_success = self.load_measurements_to_database(all_measurements)
                logger.info(f"📊 Loaded {len(all_measurements)} sample measurements")
            else:
                measurements_success = False
                logger.warning("⚠️ No measurements found")
        else:
            measurements_success = True
            logger.info("⏩ Skipping measurements (set include_measurements=True to load)")
        
        # Step 3: Verification
        logger.info("✅ Step 3: Data Verification")
        self._verify_water_quality_data()
        
        # Summary
        logger.info("\n" + "="*60)
        logger.info("🎉 SIMPLIFIED WATER QUALITY ETL SUMMARY")
        logger.info("="*60)
        logger.info(f"✅ Stations loaded: {stations_success}")
        logger.info(f"✅ Measurements loaded: {measurements_success}")
        
        if stations_success:
            logger.info("🌊 Water quality monitoring integration successful!")
            logger.info("🔗 Ready for integration with existing air quality platform")
            return True
        else:
            logger.error("❌ Water quality integration failed")
            return False
    
    def _verify_water_quality_data(self):
        """Verify loaded water quality data"""
        try:
            with self.db.get_connection() as conn:
                # Count water quality stations
                result = conn.execute(text("""
                    SELECT COUNT(*) FROM monitoring_stations 
                    WHERE type = 'water_quality'
                """))
                wq_station_count = result.fetchone()[0]
                
                # Get station breakdown by county
                result = conn.execute(text("""
                    SELECT 
                        (metadata->>'county')::text as county,
                        COUNT(*) as station_count
                    FROM monitoring_stations 
                    WHERE type = 'water_quality'
                    GROUP BY metadata->>'county'
                    ORDER BY station_count DESC
                """))
                county_breakdown = result.fetchall()
                
                # Count measurements if any
                result = conn.execute(text("""
                    SELECT COUNT(*) FROM environmental_measurements m
                    JOIN monitoring_stations s ON m.station_id = s.station_id
                    WHERE s.type = 'water_quality'
                """))
                measurement_count = result.fetchone()[0]
                
                logger.info("📊 WATER QUALITY DATA VERIFICATION")
                logger.info(f"   • Water quality stations: {wq_station_count}")
                logger.info(f"   • Water quality measurements: {measurement_count}")
                
                logger.info("🏞️ Station Distribution:")
                for county, count in county_breakdown:
                    logger.info(f"     - {county or 'Unknown'}: {count} stations")
                
        except Exception as e:
            logger.error(f"❌ Verification failed: {e}")


def main():
    """
    Demo script for FIXED water quality data integration
    """
    logger.info("🌊 FIXED Water Quality Data Integration Demo")
    logger.info("="*60)
    
    # Initialize fixed connector
    connector = WaterQualityConnectorFixed()
    
    # Test database connection
    if not connector.db.test_connection():
        logger.error("❌ Database connection failed")
        return
    
    # Run simplified ETL process
    success = connector.run_simplified_water_etl(
        include_measurements=True  # Set to False for stations-only test
    )
    
    if success:
        logger.info("✅ FIXED water quality integration complete!")
        logger.info("🔄 Ready for Phase 6A expansion")
    else:
        logger.error("❌ Water quality integration still failing")


if __name__ == "__main__":
    main()