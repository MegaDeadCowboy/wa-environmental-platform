#!/usr/bin/env python3
"""
Generate Test Environmental Measurements
Creates realistic test data for risk analysis development
"""

import sys
import os
import random
import numpy as np
from datetime import datetime, timedelta
from sqlalchemy import text

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))
from config.database import DatabaseManager

def generate_realistic_measurements():
    """Generate realistic environmental measurements for all stations"""
    
    print("🧪 Generating realistic test environmental measurements...")
    
    db = DatabaseManager()
    
    # Test database connection
    if not db.test_connection():
        print("❌ Database connection failed")
        return False
    
    try:
        with db.get_connection() as conn:
            # Get all monitoring stations
            stations_query = text("""
                SELECT station_id, name, metadata->>'parameter_name' as parameter
                FROM monitoring_stations 
                WHERE type = 'air_quality' AND active = true
            """)
            
            result = conn.execute(stations_query)
            stations = result.fetchall()
            
            if not stations:
                print("❌ No monitoring stations found")
                return False
            
            print(f"📊 Found {len(stations)} stations to populate with data")
            
            # Generate 30 days of data
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
            
            total_measurements = 0
            
            for station_id, station_name, parameter in stations:
                print(f"   📍 Generating data for: {station_name} ({parameter})")
                
                # Generate realistic baseline values based on parameter type
                if parameter == 'PM2.5 Mass':
                    # PM2.5: typically 5-25 μg/m³, occasionally higher
                    base_value = random.uniform(8, 18)
                    unit = 'μg/m³'
                elif parameter == 'Ozone':
                    # Ozone: typically 20-70 ppb, higher in summer
                    base_value = random.uniform(30, 60)
                    unit = 'ppb'
                elif parameter == 'PM10 Mass':
                    # PM10: typically 10-40 μg/m³
                    base_value = random.uniform(15, 35)
                    unit = 'μg/m³'
                elif parameter == 'SO2':
                    # SO2: typically very low, 1-10 ppb
                    base_value = random.uniform(1, 8)
                    unit = 'ppb'
                else:
                    # Default for other parameters
                    base_value = random.uniform(10, 50)
                    unit = 'ppb'
                
                # Generate daily measurements for 30 days
                current_date = start_date
                measurements_for_station = 0
                
                while current_date <= end_date:
                    # Add some realistic daily and seasonal variation
                    daily_variation = random.normalvariate(0, 0.2)  # ±20% daily variation
                    seasonal_factor = 1.1 if current_date.month in [6, 7, 8] else 0.9  # Summer vs winter
                    
                    # Occasional pollution episodes (5% chance of elevated readings)
                    if random.random() < 0.05:
                        episode_factor = random.uniform(1.5, 3.0)  # 50-300% increase
                    else:
                        episode_factor = 1.0
                    
                    # Calculate final value
                    final_value = base_value * (1 + daily_variation) * seasonal_factor * episode_factor
                    
                    # Ensure non-negative values
                    final_value = max(final_value, 0.1)
                    
                    # Insert measurement
                    insert_query = text("""
                        INSERT INTO environmental_measurements 
                        (station_id, parameter, value, unit, measurement_date, data_source, quality_flag)
                        VALUES (:station_id, :parameter, :value, :unit, :measurement_date, :data_source, :quality_flag)
                    """)
                    
                    conn.execute(insert_query, {
                        'station_id': station_id,
                        'parameter': parameter,
                        'value': round(final_value, 2),
                        'unit': unit,
                        'measurement_date': current_date,
                        'data_source': 'TEST_DATA_GENERATOR',
                        'quality_flag': 'VALID'
                    })
                    
                    measurements_for_station += 1
                    total_measurements += 1
                    current_date += timedelta(days=1)
                
                print(f"      ✅ Generated {measurements_for_station} measurements")
            
            # Commit all changes
            conn.commit()
            
            print(f"🎉 Successfully generated {total_measurements} environmental measurements!")
            
            # Verify the data
            verify_query = text("""
                SELECT 
                    parameter,
                    COUNT(*) as measurement_count,
                    ROUND(AVG(value), 2) as avg_value,
                    ROUND(MIN(value), 2) as min_value,
                    ROUND(MAX(value), 2) as max_value,
                    MAX(unit) as unit
                FROM environmental_measurements 
                WHERE data_source = 'TEST_DATA_GENERATOR'
                GROUP BY parameter
                ORDER BY parameter
            """)
            
            result = conn.execute(verify_query)
            verification_data = result.fetchall()
            
            print("\n📊 Generated Data Summary:")
            print("Parameter           Count    Avg      Min      Max      Unit")
            print("-" * 65)
            for param, count, avg_val, min_val, max_val, unit in verification_data:
                print(f"{param:<18} {count:>6}   {avg_val:>6}   {min_val:>6}   {max_val:>6}   {unit}")
            
            return True
            
    except Exception as e:
        print(f"❌ Failed to generate test data: {e}")
        return False

def clean_test_data():
    """Remove all test data"""
    print("🧹 Cleaning up test data...")
    
    db = DatabaseManager()
    
    try:
        with db.get_connection() as conn:
            delete_query = text("DELETE FROM environmental_measurements WHERE data_source = 'TEST_DATA_GENERATOR'")
            result = conn.execute(delete_query)
            conn.commit()
            
            print(f"✅ Deleted {result.rowcount} test measurements")
            return True
            
    except Exception as e:
        print(f"❌ Failed to clean test data: {e}")
        return False

def main():
    """Main function with options"""
    if len(sys.argv) > 1 and sys.argv[1] == 'clean':
        clean_test_data()
    else:
        print("🧪 Environmental Data Test Generator")
        print("====================================")
        print()
        print("This script generates realistic test environmental measurements")
        print("for all monitoring stations in your database.")
        print()
        print("Generated data includes:")
        print("• 30 days of daily measurements")
        print("• Realistic baseline values by pollutant type")
        print("• Natural daily and seasonal variation")
        print("• Occasional pollution episodes")
        print("• All data marked as 'TEST_DATA_GENERATOR' source")
        print()
        
        response = input("Generate test data? (y/n): ").lower().strip()
        
        if response == 'y' or response == 'yes':
            if generate_realistic_measurements():
                print()
                print("✅ Test data generation complete!")
                print()
                print("Next steps:")
                print("1. Run: python test_risk_engine.py")
                print("2. Watch the risk scoring engine analyze real data!")
                print()
                print("To clean up test data later:")
                print("python generate_test_measurements.py clean")
            else:
                print("❌ Test data generation failed")
        else:
            print("👋 Test data generation cancelled")

if __name__ == "__main__":
    main()
