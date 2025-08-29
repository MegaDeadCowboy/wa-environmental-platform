# src/etl/load_water_with_dataretrieval.py
"""
Water Quality Integration using the official dataretrieval Python package
This is the recommended approach by USGS for accessing their water data

Installation required:
pip install dataretrieval

This package handles all the API complexity and is actively maintained.
"""

import os
import sys
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import logging
import json
from sqlalchemy import text

# Import database manager
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.database import DatabaseManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DataRetrievalWaterQuality:
    """
    Water Quality integration using the official dataretrieval package
    This is the most reliable method for accessing USGS/WQP data
    """
    
    def __init__(self):
        self.db = DatabaseManager()
        
        # Try to import dataretrieval
        try:
            import dataretrieval.nwis as nwis
            import dataretrieval.wqp as wqp
            self.nwis = nwis
            self.wqp = wqp
            logger.info("✅ dataretrieval package loaded successfully")
        except ImportError:
            logger.error("❌ dataretrieval package not found!")
            logger.error("Please install it with: pip install dataretrieval")
            sys.exit(1)
        
        # Washington State bounding box
        self.wa_bounds = [-124.8, 45.5, -116.9, 49.0]  # [west, south, east, north]
        
        # USGS parameter codes for water quality
        self.usgs_parameters = {
            '00010': 'Temperature, water',
            '00300': 'Dissolved oxygen',
            '00400': 'pH',
            '63680': 'Turbidity',
            '00095': 'Specific conductance',
            '00618': 'Nitrate',
            '00665': 'Phosphorus, Total'
        }
        
    def test_dataretrieval_connection(self) -> bool:
        """Test the dataretrieval package with a simple query"""
        logger.info("🧪 Testing dataretrieval connection...")
        
        try:
            # Try a simple NWIS site search in Washington
            sites_df = self.nwis.get_record(
                stateCd='WA',
                service='site',
                seriesCatalogOutput=True,
                parameterCd='00010',  # Temperature
                hasDataTypeCd='dv',   # Daily values
                outputDataTypeCd='dv'
            )
            
            if sites_df is not None and len(sites_df) > 0:
                logger.info(f"✅ Found {len(sites_df)} USGS sites in Washington")
                logger.info(f"Sample sites: {sites_df.head(3)['station_nm'].tolist()}")
                return True
            else:
                logger.warning("⚠️ No USGS sites found, but connection works")
                return True
                
        except Exception as e:
            logger.error(f"❌ dataretrieval test failed: {e}")
            return False
    
    def get_wa_water_quality_sites(self, max_sites: int = 50) -> pd.DataFrame:
        """
        Get water quality monitoring sites in Washington using NWIS
        """
        logger.info("🔍 Finding active water quality sites in Washington...")
        
        try:
            # Search for sites with water quality data
            sites_df = self.nwis.get_record(
                stateCd='WA',
                service='site',
                seriesCatalogOutput=True,
                parameterCd=['00010', '00300', '00400'],  # Temp, DO, pH
                hasDataTypeCd='dv',  # Daily values
                outputDataTypeCd='dv'
            )
            
            if sites_df is not None and len(sites_df) > 0:
                logger.info(f"📊 Found {len(sites_df)} USGS water quality sites")
                
                # Filter for sites with recent data
                sites_with_recent_data = sites_df[
                    pd.to_datetime(sites_df['end_date']) >= datetime.now() - timedelta(days=365*2)
                ].head(max_sites)
                
                logger.info(f"✅ {len(sites_with_recent_data)} sites have data within last 2 years")
                return sites_with_recent_data
            else:
                logger.warning("⚠️ No USGS water quality sites found")
                return pd.DataFrame()
                
        except Exception as e:
            logger.error(f"❌ Failed to get water quality sites: {e}")
            return pd.DataFrame()
    
    def get_site_measurements(self, 
                            site_code: str, 
                            parameter_codes: List[str] = None,
                            days_back: int = 365) -> pd.DataFrame:
        """
        Get water quality measurements for a specific site
        Enhanced to handle USGS data format properly
        """
        if parameter_codes is None:
            parameter_codes = ['00010', '00300', '00400']  # Temp, DO, pH
        
        logger.info(f"📊 Getting measurements for site {site_code}")
        
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)
            
            # Get daily values data
            df = self.nwis.get_record(
                sites=site_code,
                service='dv',
                start=start_date.strftime('%Y-%m-%d'),
                end=end_date.strftime('%Y-%m-%d'),
                parameterCd=parameter_codes
            )
            
            if df is not None and len(df) > 0:
                logger.info(f"   ✅ Found {len(df)} measurements")
                logger.info(f"   📋 Data columns: {list(df.columns)}")
                logger.info(f"   📊 Data sample: {df.head(2).to_dict()}")
                return df
            else:
                logger.info(f"   ⚠️ No measurements found")
                return pd.DataFrame()
                
        except Exception as e:
            logger.error(f"   ❌ Failed to get measurements for {site_code}: {e}")
            return pd.DataFrame()
    
    def convert_nwis_to_our_format(self, 
                                  nwis_df: pd.DataFrame, 
                                  site_info: pd.Series) -> List[Dict]:
        """
        Convert NWIS dataframe to our database format
        Handles USGS quality codes and data flags properly
        """
        measurements = []
        
        if nwis_df.empty:
            return measurements
        
        try:
            # Reset index to access the datetime index
            df = nwis_df.reset_index()
            
            logger.info(f"   🔍 Processing NWIS data with columns: {list(df.columns)}")
            
            for _, row in df.iterrows():
                # Skip the datetime column, process parameter columns
                for col in df.columns:
                    if col == 'datetime':
                        continue
                    
                    # NWIS column format is usually like "00010_Mean" or "00300_Mean"
                    if '_' in col:
                        param_code = col.split('_')[0]
                        
                        if param_code in self.usgs_parameters:
                            raw_value = row[col]
                            
                            # Skip NaN values
                            if pd.isna(raw_value):
                                continue
                            
                            # Handle USGS quality codes and convert to numeric
                            cleaned_value, quality_flag = self._clean_usgs_value(raw_value)
                            
                            if cleaned_value is not None:
                                measurement = {
                                    'station_id': f"NWIS-{site_info.get('site_no', 'Unknown')}",
                                    'parameter': self.usgs_parameters[param_code],
                                    'value': float(cleaned_value),
                                    'unit': self._get_parameter_unit(param_code),
                                    'measurement_date': pd.to_datetime(row['datetime']),
                                    'data_source': 'USGS NWIS',
                                    'quality_flag': quality_flag
                                }
                                measurements.append(measurement)
            
            logger.info(f"   📊 Converted {len(measurements)} valid measurements to our format")
            return measurements
            
        except Exception as e:
            logger.error(f"Failed to convert NWIS data: {e}")
            logger.error(f"Data sample: {nwis_df.head()}")
            return []
    
    def _clean_usgs_value(self, raw_value) -> Tuple[Optional[float], str]:
        """
        Clean USGS values handling quality codes
        
        USGS Quality Codes:
        - 'A' = Approved for publication - processing and review completed
        - 'P' = Provisional - subject to revision 
        - 'e' = Value has been estimated
        - Numbers = actual measurements
        
        Returns: (cleaned_numeric_value, quality_flag)
        """
        if pd.isna(raw_value):
            return None, 'MISSING'
        
        # Convert to string for processing
        str_value = str(raw_value).strip()
        
        # Handle common USGS quality codes
        quality_flag = 'VALID'
        
        if str_value == 'A':
            # 'A' alone means approved but no numeric value - skip
            return None, 'NO_VALUE'
        elif str_value == 'P':
            # 'P' alone means provisional but no numeric value - skip
            return None, 'NO_VALUE'
        elif str_value == 'e':
            # 'e' alone means estimated but no numeric value - skip
            return None, 'NO_VALUE'
        
        # Try to extract numeric value, handling embedded quality codes
        numeric_part = ''
        for char in str_value:
            if char.isdigit() or char in '.-':
                numeric_part += char
            elif char in 'AaPpEe':
                # Set quality flag based on code
                if char in 'Aa':
                    quality_flag = 'APPROVED'
                elif char in 'Pp':
                    quality_flag = 'PROVISIONAL'
                elif char in 'Ee':
                    quality_flag = 'ESTIMATED'
        
        # Try to convert the numeric part
        if numeric_part:
            try:
                return float(numeric_part), quality_flag
            except ValueError:
                pass
        
        # Try direct conversion as fallback
        try:
            return float(str_value), quality_flag
        except ValueError:
            logger.debug(f"Could not convert value: '{raw_value}'")
            return None, 'INVALID'
    
    def _get_parameter_unit(self, param_code: str) -> str:
        """Get standard unit for parameter code"""
        units = {
            '00010': 'deg C',
            '00300': 'mg/L',
            '00400': 'pH units',
            '63680': 'NTU',
            '00095': 'uS/cm',
            '00618': 'mg/L as N',
            '00665': 'mg/L'
        }
        return units.get(param_code, 'Unknown')
    
    def create_water_quality_stations(self, sites_df: pd.DataFrame) -> bool:
        """Create water quality station records from NWIS sites data"""
        logger.info(f"🏭 Creating {len(sites_df)} water quality station records...")
        
        try:
            with self.db.get_connection() as conn:
                created_count = 0
                
                for _, site in sites_df.iterrows():
                    station_id = f"NWIS-{site.get('site_no', 'Unknown')}"
                    
                    # Check if already exists
                    check_query = text("""
                        SELECT COUNT(*) FROM monitoring_stations 
                        WHERE station_id = :station_id
                    """)
                    
                    result = conn.execute(check_query, {'station_id': station_id})
                    if result.fetchone()[0] > 0:
                        continue  # Skip existing
                    
                    # Create station record
                    latitude = float(site.get('dec_lat_va', 47.0))
                    longitude = float(site.get('dec_long_va', -122.0))
                    
                    insert_query = text("""
                        INSERT INTO monitoring_stations 
                        (station_id, name, type, agency, location, active, metadata)
                        VALUES (:station_id, :name, :type, :agency, 
                               ST_GeomFromText(:location, 4326), :active, :metadata)
                    """)
                    
                    metadata = {
                        'site_no': str(site.get('site_no', '')),
                        'latitude': latitude,
                        'longitude': longitude,
                        'huc_cd': str(site.get('huc_cd', '')),
                        'data_type': 'NWIS Daily Values',
                        'begin_date': str(site.get('begin_date', '')),
                        'end_date': str(site.get('end_date', '')),
                        'count_nu': str(site.get('count_nu', '')),
                        'site_tp_cd': str(site.get('site_tp_cd', ''))
                    }
                    
                    conn.execute(insert_query, {
                        'station_id': station_id,
                        'name': str(site.get('station_nm', f'USGS Site {site.get("site_no", "Unknown")}')),
                        'type': 'water_quality',
                        'agency': 'USGS',
                        'location': f"POINT({longitude} {latitude})",
                        'active': True,
                        'metadata': json.dumps(metadata)
                    })
                    
                    created_count += 1
                
                conn.commit()
                logger.info(f"✅ Created {created_count} new water quality stations")
                return True
                
        except Exception as e:
            logger.error(f"❌ Failed to create stations: {e}")
            return False
    
    def load_measurements_to_database(self, measurements: List[Dict]) -> bool:
        """Load measurements to database"""
        if not measurements:
            return False
            
        logger.info(f"💾 Loading {len(measurements)} water quality measurements...")
        
        try:
            with self.db.get_connection() as conn:
                loaded_count = 0
                
                for measurement in measurements:
                    try:
                        insert_query = text("""
                            INSERT INTO environmental_measurements 
                            (station_id, parameter, value, unit, measurement_date, 
                             data_source, quality_flag)
                            VALUES (:station_id, :parameter, :value, :unit, 
                                   :measurement_date, :data_source, :quality_flag)
                            ON CONFLICT DO NOTHING
                        """)
                        
                        result = conn.execute(insert_query, measurement)
                        
                        if result.rowcount > 0:
                            loaded_count += 1
                            
                    except Exception as e:
                        logger.debug(f"Failed to insert measurement: {e}")
                        continue
                
                conn.commit()
                logger.info(f"✅ Successfully loaded {loaded_count} new measurements")
                return loaded_count > 0
                
        except Exception as e:
            logger.error(f"❌ Failed to load measurements: {e}")
            return False
    
    def run_dataretrieval_integration(self, max_sites: int = 20, max_measurements_per_site: int = 100):
        """
        Run complete water quality integration using dataretrieval
        """
        logger.info("🚀 Starting dataretrieval Water Quality Integration")
        logger.info("="*60)
        
        # Test connection
        if not self.test_dataretrieval_connection():
            logger.error("❌ dataretrieval connection test failed")
            return False
        
        # Get water quality sites
        logger.info("📍 Step 1: Finding Water Quality Sites")
        sites_df = self.get_wa_water_quality_sites(max_sites=max_sites)
        
        if sites_df.empty:
            logger.error("❌ No water quality sites found")
            return False
        
        # Create station records
        logger.info("🏭 Step 2: Creating Station Records")
        stations_success = self.create_water_quality_stations(sites_df)
        
        if not stations_success:
            logger.error("❌ Failed to create stations")
            return False
        
        # Get measurements for each site
        logger.info("📊 Step 3: Loading Measurements")
        all_measurements = []
        
        for _, site in sites_df.iterrows():
            site_code = site.get('site_no')
            site_name = site.get('station_nm', 'Unknown')
            
            logger.info(f"   Processing {site_name} ({site_code})")
            
            # Get measurements
            measurements_df = self.get_site_measurements(site_code, days_back=730)  # 2 years
            
            if not measurements_df.empty:
                # Convert to our format
                measurements = self.convert_nwis_to_our_format(measurements_df, site)
                
                if measurements:
                    # Limit measurements per site
                    limited_measurements = measurements[:max_measurements_per_site]
                    all_measurements.extend(limited_measurements)
                    logger.info(f"   ✅ Added {len(limited_measurements)} measurements")
            
            # Rate limiting
            import time
            time.sleep(1)
        
        logger.info(f"\n📊 Total measurements collected: {len(all_measurements)}")
        
        if all_measurements:
            # Load to database
            success = self.load_measurements_to_database(all_measurements)
            
            if success:
                # Verify integration
                self.verify_complete_integration()
                
                logger.info("\n🎉 DATARETRIEVAL INTEGRATION SUCCESSFUL!")
                logger.info("🌊 Water quality data successfully integrated!")
                return True
        
        logger.warning("❌ No measurements loaded")
        return False
    
    def verify_complete_integration(self):
        """Verify the complete integration"""
        try:
            with self.db.get_connection() as conn:
                # Get comprehensive stats
                result = conn.execute(text("""
                    SELECT 
                        s.type,
                        COUNT(DISTINCT s.station_id) as stations,
                        COUNT(m.id) as measurements
                    FROM monitoring_stations s
                    LEFT JOIN environmental_measurements m ON s.station_id = m.station_id
                    GROUP BY s.type
                    ORDER BY stations DESC
                """))
                
                stats = result.fetchall()
                
                # Water quality parameters
                result = conn.execute(text("""
                    SELECT 
                        m.parameter,
                        COUNT(*) as count,
                        MIN(m.measurement_date) as earliest,
                        MAX(m.measurement_date) as latest
                    FROM environmental_measurements m
                    JOIN monitoring_stations s ON m.station_id = s.station_id
                    WHERE s.type = 'water_quality'
                    GROUP BY m.parameter
                    ORDER BY count DESC
                """))
                
                water_params = result.fetchall()
                
                logger.info("\n🌍 MULTI-DOMAIN PLATFORM INTEGRATION COMPLETE!")
                logger.info("="*60)
                
                logger.info("📊 PLATFORM STATISTICS:")
                for station_type, station_count, measurement_count in stats:
                    logger.info(f"   • {station_type.replace('_', ' ').title()}: {station_count} stations, {measurement_count} measurements")
                
                if water_params:
                    logger.info("\n💧 WATER QUALITY PARAMETERS:")
                    for param, count, earliest, latest in water_params:
                        logger.info(f"   • {param}: {count} measurements ({earliest.strftime('%Y-%m-%d')} to {latest.strftime('%Y-%m-%d')})")
                
                logger.info("\n🏆 PHASE 6A: WATER QUALITY INTEGRATION ✅ COMPLETE")
                
        except Exception as e:
            logger.error(f"Verification failed: {e}")


def main():
    """
    Main function for dataretrieval water quality integration
    """
    logger.info("💧 Water Quality Integration with dataretrieval")
    logger.info("="*60)
    
    integrator = DataRetrievalWaterQuality()
    
    # Test database connection
    if not integrator.db.test_connection():
        logger.error("❌ Database connection failed")
        return
    
    # Run integration
    success = integrator.run_dataretrieval_integration(
        max_sites=15,  # Start with manageable number
        max_measurements_per_site=200  # Reasonable limit per site
    )
    
    if success:
        logger.info("\n🎯 INTEGRATION SUCCESSFUL!")
        logger.info("✅ Your platform now supports multi-domain environmental monitoring")
        logger.info("🔄 Ready for enhanced risk scoring, API updates, and frontend integration")
    else:
        logger.warning("⚠️ Integration completed but with limited success")


if __name__ == "__main__":
    main()