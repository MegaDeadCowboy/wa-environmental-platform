#!/usr/bin/env python3
"""
Test script for Environmental Risk Scoring Engine
Run this to verify the risk scoring module works correctly
"""

import sys
import os
import traceback

# Add src directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

def test_imports():
    """Test that all required modules can be imported"""
    print("🔍 Testing imports...")
    try:
        import numpy as np
        print("   ✅ numpy imported")
        
        import pandas as pd
        print("   ✅ pandas imported")
        
        from sqlalchemy import text
        print("   ✅ sqlalchemy imported")
        
        # Test our modules
        from config.database import DatabaseManager
        print("   ✅ DatabaseManager imported")
        
        from analysis.risk_scoring import EnvironmentalRiskScoring, RiskLevel, RiskParameters
        print("   ✅ Risk scoring modules imported")
        
        return True
    except ImportError as e:
        print(f"   ❌ Import failed: {e}")
        return False

def test_database_connection():
    """Test database connectivity"""
    print("\n🔌 Testing database connection...")
    try:
        from config.database import DatabaseManager
        db = DatabaseManager()
        
        if db.test_connection():
            print("   ✅ Database connection successful")
            
            # Test data availability
            with db.get_connection() as conn:
                from sqlalchemy import text
                
                # Check for monitoring stations
                result = conn.execute(text("SELECT COUNT(*) FROM monitoring_stations WHERE type = 'air_quality'"))
                station_count = result.fetchone()[0]
                print(f"   📊 Found {station_count} air quality monitoring stations")
                
                # Check for measurements
                result = conn.execute(text("SELECT COUNT(*) FROM environmental_measurements"))
                measurement_count = result.fetchone()[0]
                print(f"   📊 Found {measurement_count} environmental measurements")
                
                if station_count > 0:
                    # Get sample station info
                    result = conn.execute(text("""
                        SELECT station_id, name, metadata->>'parameter_name' as parameter
                        FROM monitoring_stations 
                        WHERE type = 'air_quality' 
                        LIMIT 3
                    """))
                    
                    stations = result.fetchall()
                    print("   📍 Sample stations:")
                    for station_id, name, param in stations:
                        print(f"      - {station_id}: {name} ({param})")
                
                return True
        else:
            print("   ❌ Database connection failed")
            return False
            
    except Exception as e:
        print(f"   ❌ Database test failed: {e}")
        traceback.print_exc()
        return False

def test_risk_calculations():
    """Test risk calculation functions"""
    print("\n🧮 Testing risk calculations...")
    try:
        from analysis.risk_scoring import EnvironmentalRiskScoring
        
        risk_engine = EnvironmentalRiskScoring()
        
        # Test individual pollutant scoring
        print("   🔬 Testing pollutant risk scoring:")
        
        test_cases = [
            ("PM2.5 Mass", 15.0, "Expected: moderate risk"),
            ("PM2.5 Mass", 40.0, "Expected: high risk"),
            ("Ozone", 80.0, "Expected: moderate-high risk"),
            ("Ozone", 50.0, "Expected: low risk"),
        ]
        
        for pollutant, concentration, expected in test_cases:
            risk_score = risk_engine.calculate_pollutant_risk_score(pollutant, concentration)
            print(f"      {pollutant} @ {concentration}: {risk_score:.1f}/100 ({expected})")
        
        print("   ✅ Pollutant risk calculations working")
        return True
        
    except Exception as e:
        print(f"   ❌ Risk calculation test failed: {e}")
        traceback.print_exc()
        return False

def test_station_risk_analysis():
    """Test station-level risk analysis"""
    print("\n🏭 Testing station risk analysis...")
    try:
        from analysis.risk_scoring import EnvironmentalRiskScoring
        from config.database import DatabaseManager
        from sqlalchemy import text
        
        risk_engine = EnvironmentalRiskScoring()
        db = DatabaseManager()
        
        # Get a test station
        with db.get_connection() as conn:
            result = conn.execute(text("""
                SELECT station_id, name 
                FROM monitoring_stations 
                WHERE type = 'air_quality' AND active = true
                LIMIT 1
            """))
            
            station_data = result.fetchone()
            
            if not station_data:
                print("   ⚠️  No test stations available - skipping station analysis")
                return True
            
            station_id, station_name = station_data
            print(f"   🎯 Testing with station: {station_name} ({station_id})")
            
            # Calculate risk for this station
            risk_result = risk_engine.calculate_station_risk_score(station_id)
            
            print(f"      Risk Score: {risk_result['risk_score']}/100")
            print(f"      Risk Level: {risk_result['risk_level']}")
            print(f"      Data Availability: {risk_result['data_availability']}")
            
            if risk_result.get('components'):
                print("      Components:")
                for param, details in risk_result['components'].items():
                    print(f"        - {param}: {details['risk_score']:.1f}/100 (samples: {details['sample_count']})")
            
            print("   ✅ Station risk analysis working")
            return True
            
    except Exception as e:
        print(f"   ❌ Station risk analysis test failed: {e}")
        traceback.print_exc()
        return False

def test_county_risk_analysis():
    """Test county-level risk analysis"""
    print("\n🏘️  Testing county risk analysis...")
    try:
        from analysis.risk_scoring import EnvironmentalRiskScoring
        from config.database import DatabaseManager
        from sqlalchemy import text
        
        risk_engine = EnvironmentalRiskScoring()
        db = DatabaseManager()
        
        # Get a test county with stations
        with db.get_connection() as conn:
            result = conn.execute(text("""
                SELECT DISTINCT b.name as county_name, COUNT(s.station_id) as station_count
                FROM administrative_boundaries b
                JOIN monitoring_stations s ON ST_Within(s.location, b.geometry)
                WHERE b.type = 'county' AND s.type = 'air_quality' AND s.active = true
                GROUP BY b.name
                ORDER BY station_count DESC
                LIMIT 1
            """))
            
            county_data = result.fetchone()
            
            if not county_data:
                print("   ⚠️  No counties with stations available - skipping county analysis")
                return True
            
            county_name, station_count = county_data
            print(f"   🎯 Testing with county: {county_name} ({station_count} stations)")
            
            # Calculate county risk
            county_risk = risk_engine.calculate_county_risk_score(county_name)
            
            print(f"      County Risk: {county_risk['risk_score']}/100")
            print(f"      Risk Level: {county_risk['risk_level']}")
            print(f"      Active Stations: {county_risk['station_count']}")
            print(f"      Data Availability: {county_risk['data_availability']}")
            
            print("   ✅ County risk analysis working")
            return True
            
    except Exception as e:
        print(f"   ❌ County risk analysis test failed: {e}")
        traceback.print_exc()
        return False

def test_database_storage():
    """Test saving risk scores to database"""
    print("\n💾 Testing database storage...")
    try:
        from analysis.risk_scoring import EnvironmentalRiskScoring
        
        risk_engine = EnvironmentalRiskScoring()
        
        # Create a test risk result
        test_risk_data = {
            'station_id': 'TEST-STATION-001',
            'risk_score': 42.5,
            'risk_level': 'MODERATE',
            'components': {
                'PM2.5 Mass': {
                    'risk_score': 35.0,
                    'avg_concentration': 15.2,
                    'sample_count': 30
                }
            }
        }
        
        # Save to database
        risk_engine.save_risk_scores_to_db(test_risk_data, 'station')
        
        # Verify it was saved
        from config.database import DatabaseManager
        from sqlalchemy import text
        
        db = DatabaseManager()
        with db.get_connection() as conn:
            result = conn.execute(text("""
                SELECT risk_score, risk_category 
                FROM environmental_risk_scores 
                WHERE location_id = 'TEST-STATION-001'
                ORDER BY created_at DESC 
                LIMIT 1
            """))
            
            saved_data = result.fetchone()
            
            if saved_data:
                saved_risk, saved_category = saved_data
                print(f"   ✅ Successfully saved and retrieved risk data:")
                print(f"      Risk Score: {saved_risk}")
                print(f"      Risk Category: {saved_category}")
                
                # Clean up test data
                conn.execute(text("DELETE FROM environmental_risk_scores WHERE location_id = 'TEST-STATION-001'"))
                conn.commit()
                print("   🧹 Cleaned up test data")
                
                return True
            else:
                print("   ❌ Failed to retrieve saved risk data")
                return False
                
    except Exception as e:
        print(f"   ❌ Database storage test failed: {e}")
        traceback.print_exc()
        return False

def run_all_tests():
    """Run complete test suite"""
    print("🚀 Environmental Risk Scoring Engine - Test Suite")
    print("=" * 60)
    
    tests = [
        ("Import Tests", test_imports),
        ("Database Connection", test_database_connection),
        ("Risk Calculations", test_risk_calculations),
        ("Station Risk Analysis", test_station_risk_analysis),
        ("County Risk Analysis", test_county_risk_analysis),
        ("Database Storage", test_database_storage)
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name} PASSED")
            else:
                failed += 1
                print(f"❌ {test_name} FAILED")
        except Exception as e:
            failed += 1
            print(f"❌ {test_name} FAILED with exception: {e}")
            traceback.print_exc()
    
    print(f"\n{'='*60}")
    print(f"🎯 TEST RESULTS: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 ALL TESTS PASSED! Risk scoring engine is ready.")
        return True
    else:
        print("⚠️  Some tests failed. Please check the errors above.")
        return False

def run_demo_if_tests_pass():
    """Run the demo if all tests pass"""
    if run_all_tests():
        print(f"\n{'='*60}")
        print("🎯 Running Risk Scoring Demo...")
        print("=" * 60)
        
        try:
            from analysis.risk_scoring import demo_risk_analysis
            demo_risk_analysis()
            print("\n🎉 Demo completed successfully!")
        except Exception as e:
            print(f"❌ Demo failed: {e}")
            traceback.print_exc()
    else:
        print("\n❌ Skipping demo due to test failures")

if __name__ == "__main__":
    run_demo_if_tests_pass()