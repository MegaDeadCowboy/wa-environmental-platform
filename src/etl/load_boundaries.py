# src/etl/load_boundaries.py
import requests
import geopandas as gpd
import pandas as pd
from pathlib import Path
import sys
import os
import urllib3
from sqlalchemy import text

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Add src to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from config.database import DatabaseManager

class BoundaryETL:
    def __init__(self):
        self.db = DatabaseManager()
        self.data_dir = Path("data/boundaries")
        self.data_dir.mkdir(parents=True, exist_ok=True)
    
    def download_wa_counties(self):
        """Download Washington State county boundaries from Census Bureau"""
        print("Downloading US county boundaries (will filter for WA)...")
        
        # Census Bureau TIGER/Line Shapefiles - ALL US counties
        url = "https://www2.census.gov/geo/tiger/TIGER2020/COUNTY/tl_2020_us_county.zip"
        
        try:
            # Download file with SSL verification disabled
            response = requests.get(url, stream=True, verify=False)
            response.raise_for_status()
            
            zip_path = self.data_dir / "us_counties_2020.zip"
            with open(zip_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            print(f"✓ Downloaded: {zip_path}")
            
            # Read shapefile directly from zip
            gdf_all = gpd.read_file(f"zip://{zip_path}")
            
            # Filter for Washington state (STATEFP = '53')
            wa_counties = gdf_all[gdf_all['STATEFP'] == '53'].copy()
            print(f"✓ Filtered {len(wa_counties)} WA counties from {len(gdf_all)} total counties")
            
            return wa_counties
        
        except Exception as e:
            print(f"✗ Download failed: {e}")
            return None
    
    def download_wa_cities(self):
        """Download Washington State city boundaries"""
        print("Downloading WA city boundaries...")
        
        # Census Bureau places (cities/towns) for WA
        url = "https://www2.census.gov/geo/tiger/TIGER2023/PLACE/tl_2023_53_place.zip"
        
        try:
            response = requests.get(url, stream=True, verify=False)
            response.raise_for_status()
            
            zip_path = self.data_dir / "wa_places_2023.zip"
            with open(zip_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            print(f"✓ Downloaded: {zip_path}")
            
            # Read shapefile
            gdf = gpd.read_file(f"zip://{zip_path}")
            print(f"✓ Loaded {len(gdf)} places")
            
            return gdf
            
        except Exception as e:
            print(f"✗ Download failed: {e}")
            return None
    
    def process_counties(self, gdf):
        """Process county data for database loading"""
        if gdf is None:
            return None
        
        print("Processing county boundaries...")
        
        # Select and rename columns to match our schema
        processed = gdf[['NAME', 'GEOID', 'geometry']].copy()
        processed = processed.rename(columns={
            'NAME': 'name',
            'GEOID': 'fips_code'
        })
        
        # Add type column
        processed['type'] = 'county'
        
        # Ensure geometry is valid
        processed['geometry'] = processed['geometry'].buffer(0)
        
        # Convert to WGS84 if needed
        if processed.crs != 'EPSG:4326':
            processed = processed.to_crs('EPSG:4326')
        
        print(f"✓ Processed {len(processed)} counties")
        return processed
    
    def process_cities(self, gdf):
        """Process city data for database loading"""
        if gdf is None:
            return None
        
        print("Processing city boundaries...")
        
        # Select and rename columns
        processed = gdf[['NAME', 'GEOID', 'geometry']].copy()
        processed = processed.rename(columns={
            'NAME': 'name',
            'GEOID': 'fips_code'
        })
        
        # Add type column
        processed['type'] = 'city'
        
        # Convert to projected CRS for area calculation to avoid warning
        projected = processed.to_crs('EPSG:3857')  # Web Mercator
        
        # Filter for larger cities/towns (removes very small places)
        # Using 100,000 sq meters (0.1 sq km) as minimum area
        projected = projected[projected.geometry.area > 100000].copy()
        
        # Convert back to WGS84
        processed = projected.to_crs('EPSG:4326')
        
        # Ensure geometry is valid
        processed['geometry'] = processed['geometry'].buffer(0)
        
        print(f"✓ Processed {len(processed)} cities/places")
        return processed
    
    def load_to_database(self, gdf, boundary_type):
        """Load processed boundary data to database"""
        if gdf is None or len(gdf) == 0:
            print(f"✗ No data to load for {boundary_type}")
            return False
        
        print(f"Loading {len(gdf)} {boundary_type} boundaries to database...")
        
        return self.db.load_geodataframe(
            gdf, 
            'administrative_boundaries',
            if_exists='append'
        )
    
    def check_existing_data(self, boundary_type):
        """Check if boundary type already exists in database"""
        try:
            with self.db.get_connection() as conn:
                result = conn.execute(text(
                    "SELECT COUNT(*) FROM administrative_boundaries WHERE type = :type"
                ), {"type": boundary_type})
                count = result.fetchone()[0]
                return count
        except Exception as e:
            print(f"✗ Failed to check existing data: {e}")
            return 0
    
    def clean_duplicates(self):
        """Remove duplicate records from database"""
        print("Cleaning duplicate records...")
        try:
            with self.db.get_connection() as conn:
                # Remove duplicates, keeping the first occurrence
                result = conn.execute(text("""
                    DELETE FROM administrative_boundaries 
                    WHERE id NOT IN (
                        SELECT MIN(id) 
                        FROM administrative_boundaries 
                        GROUP BY name, type, fips_code
                    );
                """))
                conn.commit()
                print(f"✓ Removed {result.rowcount} duplicate records")
        except Exception as e:
            print(f"✗ Failed to clean duplicates: {e}")
    
    def run_full_etl(self):
        """Run complete boundary ETL process"""
        print("=== Washington State Boundary ETL ===")
        
        # Test database connection
        if not self.db.test_connection():
            print("✗ Database connection failed. Exiting.")
            return False
        
        # Process counties
        print("\n--- Processing Counties ---")
        county_count = self.check_existing_data('county')
        if county_count > 0:
            print(f"✓ {county_count} counties already loaded, skipping download")
            county_success = True
        else:
            county_raw = self.download_wa_counties()
            county_processed = self.process_counties(county_raw)
            county_success = self.load_to_database(county_processed, 'counties')
        
        # Process cities
        print("\n--- Processing Cities ---")
        city_count = self.check_existing_data('city')
        if city_count > 0:
            print(f"✓ {city_count} cities already loaded, skipping download")
            city_success = True
        else:
            city_raw = self.download_wa_cities()
            city_processed = self.process_cities(city_raw)
            city_success = self.load_to_database(city_processed, 'cities')
        
        # Clean duplicates if any data was loaded
        if county_success or city_success:
            print("\n--- Cleaning Data ---")
            self.clean_duplicates()
        
        # Summary
        print("\n=== ETL Summary ===")
        print(f"Counties: {'✓' if county_success else '✗'}")
        print(f"Cities: {'✓' if city_success else '✗'}")
        
        if county_success or city_success:
            # Verify data loaded
            self.verify_loaded_data()
            return True
        
        return False
    
    def verify_loaded_data(self):
        """Verify data was loaded correctly"""
        print("\n--- Verification ---")
        
        try:
            with self.db.get_connection() as conn:
                # Count boundaries by type
                result = conn.execute(text("""
                    SELECT type, COUNT(*) as count 
                    FROM administrative_boundaries 
                    GROUP BY type 
                    ORDER BY type;
                """))
                
                for row in result:
                    print(f"✓ {row[1]} {row[0]} boundaries loaded")
                
                # Show sample data
                result = conn.execute(text("""
                    SELECT name, type, fips_code 
                    FROM administrative_boundaries 
                    ORDER BY type, name 
                    LIMIT 10;
                """))
                
                print("\nSample records:")
                for row in result:
                    print(f"  {row[1]}: {row[0]} ({row[2]})")
                    
        except Exception as e:
            print(f"✗ Verification failed: {e}")

# For command line execution
if __name__ == "__main__":
    etl = BoundaryETL()
    etl.run_full_etl()