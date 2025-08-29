# src/config/database.py
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import geopandas as gpd
import pandas as pd

# Load environment variables
load_dotenv()

class DatabaseManager:
    def __init__(self):
    # Use Unix socket connection (bypass .env file for now)
        self.db_url = 'postgresql:///wa_environmental_platform'
        self.engine = create_engine(self.db_url)
        self.Session = sessionmaker(bind=self.engine)
    
    def get_connection(self):
        """Get database connection"""
        return self.engine.connect()
    
    def test_connection(self):
        """Test database connection and PostGIS"""
        try:
            with self.engine.connect() as conn:
                # Test basic connection
                result = conn.execute(text("SELECT version();"))
                pg_version = result.fetchone()[0]
                print(f"✓ PostgreSQL: {pg_version}")
                
                # Test PostGIS
                result = conn.execute(text("SELECT PostGIS_version();"))
                postgis_version = result.fetchone()[0]
                print(f"✓ PostGIS: {postgis_version}")
                
                # Test tables exist
                result = conn.execute(text("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_type = 'BASE TABLE'
                    ORDER BY table_name;
                """))
                tables = [row[0] for row in result.fetchall()]
                print(f"✓ Tables found: {', '.join(tables)}")
                
                return True
                
        except Exception as e:
            print(f"✗ Database connection failed: {e}")
            return False
    
    def load_geodataframe(self, gdf, table_name, if_exists='append'):
        """Load a GeoDataFrame to PostGIS table"""
        try:
            gdf.to_postgis(
                table_name, 
                self.engine, 
                if_exists=if_exists,
                index=False,
                chunksize=1000
            )
            print(f"✓ Loaded {len(gdf)} records to {table_name}")
            return True
        except Exception as e:
            print(f"✗ Failed to load data to {table_name}: {e}")
            return False
    
    def query_geodataframe(self, query):
        """Execute spatial query and return GeoDataFrame"""
        try:
            return gpd.read_postgis(query, self.engine, geom_col='geometry')
        except Exception as e:
            print(f"✗ Query failed: {e}")
            return None

# Test the connection (run this to verify setup)
if __name__ == "__main__":
    db = DatabaseManager()
    db.test_connection()