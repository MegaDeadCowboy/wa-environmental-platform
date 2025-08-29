# src/database/apply_schema_extension.py
"""
Simple script to apply database schema extensions
Avoids command-line SQL syntax issues by applying changes through Python
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.database import DatabaseManager
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SchemaExtension:
    """Apply database schema extensions step by step"""
    
    def __init__(self):
        self.db = DatabaseManager()
    
    def add_station_columns(self):
        """Add new columns to monitoring_stations table"""
        logger.info("Adding new columns to monitoring_stations...")
        
        try:
            with self.db.get_connection() as conn:
                # Add columns one by one to avoid syntax issues
                columns_to_add = [
                    "ADD COLUMN IF NOT EXISTS water_body_name VARCHAR(255)",
                    "ADD COLUMN IF NOT EXISTS water_body_type VARCHAR(100)", 
                    "ADD COLUMN IF NOT EXISTS huc_code VARCHAR(20)",
                    "ADD COLUMN IF NOT EXISTS usgs_site_no VARCHAR(20)",
                    "ADD COLUMN IF NOT EXISTS data_provider VARCHAR(100)",
                    "ADD COLUMN IF NOT EXISTS last_measurement_date DATE",
                    "ADD COLUMN IF NOT EXISTS measurement_count INTEGER DEFAULT 0"
                ]
                
                for column_def in columns_to_add:
                    query = f"ALTER TABLE monitoring_stations {column_def}"
                    conn.execute(text(query))
                    logger.info(f"  Added: {column_def}")
                
                conn.commit()
                logger.info("✅ Station columns added successfully")
                return True
                
        except Exception as e:
            logger.error(f"Failed to add station columns: {e}")
            return False
    
    def create_parameter_definitions(self):
        """Create parameter definitions table"""
        logger.info("Creating parameter definitions table...")
        
        try:
            with self.db.get_connection() as conn:
                # Create table
                create_table_sql = """
                CREATE TABLE IF NOT EXISTS parameter_definitions (
                    id SERIAL PRIMARY KEY,
                    parameter_code VARCHAR(20) UNIQUE,
                    parameter_name VARCHAR(255) NOT NULL,
                    short_name VARCHAR(100),
                    category VARCHAR(50),
                    domain VARCHAR(50),
                    unit VARCHAR(50),
                    epa_standard NUMERIC,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )
                """
                
                conn.execute(text(create_table_sql))
                logger.info("✅ Parameter definitions table created")
                
                # Insert parameter definitions
                parameters = [
                    ('00010', 'Temperature, water', 'Water Temperature', 'physical', 'water_quality', 'deg C', None, 'Water temperature'),
                    ('00300', 'Dissolved oxygen', 'Dissolved Oxygen', 'chemical', 'water_quality', 'mg/L', 5.0, 'Dissolved oxygen concentration'),
                    ('00400', 'pH', 'pH', 'chemical', 'water_quality', 'pH units', 7.0, 'pH level'),
                    ('88101', 'PM2.5 Mass', 'PM2.5', 'physical', 'air_quality', 'ug/m3', 12.0, 'Fine particulate matter'),
                    ('44201', 'Ozone', 'Ozone', 'chemical', 'air_quality', 'ppb', 70.0, 'Ground-level ozone'),
                    ('42401', 'SO2', 'Sulfur Dioxide', 'chemical', 'air_quality', 'ppb', 75.0, 'Sulfur dioxide'),
                    ('42101', 'CO', 'Carbon Monoxide', 'chemical', 'air_quality', 'ppm', 35.0, 'Carbon monoxide'),
                    ('42602', 'NO2', 'Nitrogen Dioxide', 'chemical', 'air_quality', 'ppb', 100.0, 'Nitrogen dioxide')
                ]
                
                insert_sql = """
                INSERT INTO parameter_definitions 
                (parameter_code, parameter_name, short_name, category, domain, unit, epa_standard, description) 
                VALUES (:code, :name, :short, :category, :domain, :unit, :standard, :desc)
                ON CONFLICT (parameter_code) DO UPDATE SET
                    parameter_name = EXCLUDED.parameter_name,
                    short_name = EXCLUDED.short_name,
                    domain = EXCLUDED.domain,
                    unit = EXCLUDED.unit,
                    epa_standard = EXCLUDED.epa_standard
                """
                
                for param in parameters:
                    conn.execute(text(insert_sql), {
                        'code': param[0], 'name': param[1], 'short': param[2],
                        'category': param[3], 'domain': param[4], 'unit': param[5],
                        'standard': param[6], 'desc': param[7]
                    })
                
                conn.commit()
                logger.info(f"✅ Inserted {len(parameters)} parameter definitions")
                return True
                
        except Exception as e:
            logger.error(f"Failed to create parameter definitions: {e}")
            return False
    
    def add_measurement_columns(self):
        """Add new columns to environmental_measurements table"""
        logger.info("Adding columns to environmental_measurements...")
        
        try:
            with self.db.get_connection() as conn:
                # Add parameter_code column
                conn.execute(text("""
                    ALTER TABLE environmental_measurements 
                    ADD COLUMN IF NOT EXISTS parameter_code VARCHAR(20)
                """))
                
                logger.info("✅ Measurement columns added")
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Failed to add measurement columns: {e}")
            return False
    
    def update_existing_data(self):
        """Update existing data with new structure"""
        logger.info("Updating existing data...")
        
        try:
            with self.db.get_connection() as conn:
                # Update parameter codes
                parameter_mapping = {
                    'Temperature, water': '00010',
                    'Dissolved oxygen': '00300', 
                    'pH': '00400',
                    'PM2.5 Mass': '88101',
                    'Ozone': '44201',
                    'SO2': '42401',
                    'CO': '42101',
                    'NO2': '42602'
                }
                
                for param_name, param_code in parameter_mapping.items():
                    update_sql = """
                    UPDATE environmental_measurements 
                    SET parameter_code = :code 
                    WHERE parameter = :name AND parameter_code IS NULL
                    """
                    result = conn.execute(text(update_sql), {'code': param_code, 'name': param_name})
                    logger.info(f"  Updated {result.rowcount} measurements for {param_name}")
                
                # Update station metadata for NWIS stations
                conn.execute(text("""
                    UPDATE monitoring_stations 
                    SET 
                        data_provider = 'USGS-NWIS',
                        usgs_site_no = REPLACE(station_id, 'NWIS-', ''),
                        water_body_type = 'River'
                    WHERE station_id LIKE 'NWIS-%'
                """))
                
                # Update station metadata for EPA stations
                conn.execute(text("""
                    UPDATE monitoring_stations 
                    SET data_provider = 'EPA-AQS'
                    WHERE station_id NOT LIKE 'NWIS-%' AND type = 'air_quality'
                """))
                
                # Update measurement counts
                conn.execute(text("""
                    UPDATE monitoring_stations 
                    SET 
                        measurement_count = (
                            SELECT COUNT(*) 
                            FROM environmental_measurements m 
                            WHERE m.station_id = monitoring_stations.station_id
                        ),
                        last_measurement_date = (
                            SELECT MAX(measurement_date) 
                            FROM environmental_measurements m 
                            WHERE m.station_id = monitoring_stations.station_id
                        )
                """))
                
                conn.commit()
                logger.info("✅ Existing data updated successfully")
                return True
                
        except Exception as e:
            logger.error(f"Failed to update existing data: {e}")
            return False
    
    def create_views(self):
        """Create useful database views"""
        logger.info("Creating database views...")
        
        try:
            with self.db.get_connection() as conn:
                
                # Station summary view
                station_view_sql = """
                CREATE OR REPLACE VIEW station_summary AS
                SELECT 
                    s.station_id,
                    s.name,
                    s.type,
                    s.agency,
                    s.data_provider,
                    s.active,
                    ST_X(s.location) as longitude,
                    ST_Y(s.location) as latitude,
                    s.water_body_name,
                    s.measurement_count,
                    s.last_measurement_date,
                    (SELECT COUNT(DISTINCT m.parameter) 
                     FROM environmental_measurements m 
                     WHERE m.station_id = s.station_id) as parameter_count,
                    (SELECT b.name 
                     FROM administrative_boundaries b 
                     WHERE ST_Within(s.location, b.geometry) AND b.type = 'county'
                     LIMIT 1) as county
                FROM monitoring_stations s
                """
                
                conn.execute(text(station_view_sql))
                logger.info("✅ Created station_summary view")
                
                # Parameter statistics view
                param_view_sql = """
                CREATE OR REPLACE VIEW parameter_statistics AS
                SELECT 
                    pd.domain,
                    pd.parameter_name,
                    pd.short_name,
                    pd.unit,
                    pd.epa_standard,
                    COUNT(m.id) as measurement_count,
                    COUNT(DISTINCT m.station_id) as station_count,
                    MIN(m.measurement_date) as earliest_date,
                    MAX(m.measurement_date) as latest_date,
                    AVG(m.value) as mean_value,
                    MIN(m.value) as min_value,
                    MAX(m.value) as max_value
                FROM parameter_definitions pd
                LEFT JOIN environmental_measurements m ON pd.parameter_name = m.parameter
                GROUP BY pd.domain, pd.parameter_name, pd.short_name, pd.unit, pd.epa_standard
                ORDER BY measurement_count DESC
                """
                
                conn.execute(text(param_view_sql))
                logger.info("✅ Created parameter_statistics view")
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Failed to create views: {e}")
            return False
    
    def verify_extension(self):
        """Verify the schema extension was successful"""
        logger.info("\nVerifying schema extension...")
        
        try:
            with self.db.get_connection() as conn:
                
                # Check new columns exist
                result = conn.execute(text("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'monitoring_stations' 
                    AND column_name IN ('data_provider', 'water_body_name', 'measurement_count')
                """))
                new_cols = [row[0] for row in result.fetchall()]
                logger.info(f"New station columns: {new_cols}")
                
                # Check parameter definitions table
                result = conn.execute(text("SELECT COUNT(*) FROM parameter_definitions"))
                param_count = result.fetchone()[0]
                logger.info(f"Parameter definitions: {param_count}")
                
                # Check parameter codes in measurements
                result = conn.execute(text("""
                    SELECT 
                        COUNT(*) as total,
                        COUNT(parameter_code) as with_code
                    FROM environmental_measurements
                """))
                total, with_code = result.fetchone()
                logger.info(f"Measurements with parameter codes: {with_code}/{total}")
                
                # Overall platform stats
                result = conn.execute(text("""
                    SELECT 
                        s.type,
                        COUNT(DISTINCT s.station_id) as stations,
                        COUNT(m.id) as measurements
                    FROM monitoring_stations s
                    LEFT JOIN environmental_measurements m ON s.station_id = m.station_id
                    GROUP BY s.type
                """))
                
                logger.info("\nPlatform Summary:")
                for station_type, stations, measurements in result.fetchall():
                    logger.info(f"  {station_type}: {stations} stations, {measurements} measurements")
                
                return True
                
        except Exception as e:
            logger.error(f"Verification failed: {e}")
            return False
    
    def run_complete_extension(self):
        """Run the complete schema extension process"""
        logger.info("Starting database schema extension...")
        
        success = True
        
        # Run each step
        success &= self.add_station_columns()
        success &= self.create_parameter_definitions()
        success &= self.add_measurement_columns()
        success &= self.update_existing_data()
        success &= self.create_views()
        
        # Verify results
        self.verify_extension()
        
        if success:
            logger.info("\n🎉 Schema extension completed successfully!")
            logger.info("Your multi-domain environmental platform database is now enhanced!")
        else:
            logger.error("\n❌ Schema extension had some issues")
        
        return success

def main():
    """Apply schema extension"""
    extension = SchemaExtension()
    
    # Test database connection
    if not extension.db.test_connection():
        logger.error("Database connection failed")
        return False
    
    # Run extension
    return extension.run_complete_extension()

if __name__ == "__main__":
    main()