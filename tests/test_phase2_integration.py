# test_phase2_integration.py
"""
Phase 2 Integration Testing Script
Tests EPA AQS data integration and spatial analysis capabilities
"""

import os
import sys
import pandas as pd
from datetime import datetime
from sqlalchemy import text

# Add src directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from config.database import DatabaseManager

class Phase2Tester:
    """Test suite for Phase 2 EPA AQS integration"""
    
    def __init__(self):
        self.db = DatabaseManager()
        self.test_results = []
    
    def log_test(self, test_name: str, passed: bool, details: str = ""):
        """Log test results"""
        status = "✅ PASS" if passed else "❌ FAIL"
        message = f"{status}: {test_name}"
        if details:
            message += f" - {details}"
        
        print(message)
        self.test_results.append({
            'test': test_name,
            'passed': passed,
            'details': details,
            'timestamp': datetime.now()
        })
        
        return passed
    
    def test_database_connection(self):
        """Test 1: Verify database connection and PostGIS"""
        try:
            with self.db.get_connection() as conn:
                # Test PostgreSQL
                result = conn.execute(text("SELECT version();"))
                pg_version = result.fetchone()[0]
                
                # Test PostGIS
                result = conn.execute(text("SELECT PostGIS_version();"))
                postgis_version = result.fetchone()[0]
                
                return self.log_test(
                    "Database Connection",
                    True,
                    f"PostgreSQL + PostGIS working"
                )
        except Exception as e:
            return self.log_test(
                "Database Connection",
                False,
                f"Connection failed: {e}"
            )
    
    def test_boundary_data(self):
        """Test 2: Verify Phase 1 boundary data exists"""
        try:
            with self.db.get_connection() as conn:
                # Check counties
                result = conn.execute(text("""
                    SELECT COUNT(*) FROM administrative_boundaries 
                    WHERE type = 'county'
                """))
                county_count = result.fetchone()[0]
                
                # Check cities
                result = conn.execute(text("""
                    SELECT COUNT(*) FROM administrative_boundaries 
                    WHERE type = 'city'
                """))
                city_count = result.fetchone()[0]
                
                # Should have 39 counties, 600+ cities for WA
                if county_count >= 39 and city_count >= 500:
                    return self.log_test(
                        "Boundary Data",
                        True,
                        f"{county_count} counties, {city_count} cities loaded"
                    )
                else:
                    return self.log_test(
                        "Boundary Data",
                        False,
                        f"Insufficient data: {county_count} counties, {city_count} cities"
                    )
        except Exception as e:
            return self.log_test(
                "Boundary Data",
                False,
                f"Query failed: {e}"
            )
    
    def test_monitoring_stations(self):
        """Test 3: Verify air quality monitoring stations loaded"""
        try:
            with self.db.get_connection() as conn:
                # Count air quality stations
                result = conn.execute(text("""
                    SELECT COUNT(*) FROM monitoring_stations 
                    WHERE type = 'air_quality'
                """))
                station_count = result.fetchone()[0]
                
                # Check for required fields
                result = conn.execute(text("""
                    SELECT COUNT(*) FROM monitoring_stations 
                    WHERE type = 'air_quality' 
                    AND station_id IS NOT NULL 
                    AND location IS NOT NULL
                    AND metadata IS NOT NULL
                """))
                valid_stations = result.fetchone()[0]
                
                if station_count > 0 and valid_stations == station_count:
                    return self.log_test(
                        "Monitoring Stations",
                        True,
                        f"{station_count} stations loaded with complete metadata"
                    )
                else:
                    return self.log_test(
                        "Monitoring Stations",
                        False,
                        f"{station_count} total, {valid_stations} valid stations"
                    )
        except Exception as e:
            return self.log_test(
                "Monitoring Stations",
                False,
                f"Query failed: {e}"
            )
    
    def test_environmental_measurements(self):
        """Test 4: Verify environmental measurements loaded"""
        try:
            with self.db.get_connection() as conn:
                # Count measurements
                result = conn.execute(text("""
                    SELECT COUNT(*) FROM environmental_measurements
                """))
                measurement_count = result.fetchone()[0]
                
                # Check data quality
                result = conn.execute(text("""
                    SELECT 
                        COUNT(*) as total,
                        COUNT(CASE WHEN quality_flag = 'VALID' THEN 1 END) as valid,
                        COUNT(DISTINCT station_id) as stations,
                        MIN(measurement_date) as earliest,
                        MAX(measurement_date) as latest
                    FROM environmental_measurements
                """))
                
                stats = result.fetchone()
                
                if measurement_count > 0 and stats.valid > 0:
                    return self.log_test(
                        "Environmental Measurements",
                        True,
                        f"{stats.total} measurements, {stats.valid} valid, {stats.stations} stations"
                    )
                else:
                    return self.log_test(
                        "Environmental Measurements",
                        False,
                        f"No valid measurements found ({measurement_count} total)"
                    )
        except Exception as e:
            return self.log_test(
                "Environmental Measurements",
                False,
                f"Query failed: {e}"
            )
    
    def test_spatial_joins(self):
        """Test 5: Verify spatial joins between stations and boundaries work"""
        try:
            with self.db.get_connection() as conn:
                # Test spatial join
                result = conn.execute(text("""
                    SELECT 
                        b.name as county,
                        COUNT(s.station_id) as station_count
                    FROM administrative_boundaries b
                    LEFT JOIN monitoring_stations s ON ST_Within(s.location, b.geometry)
                    WHERE b.type = 'county' 
                    AND (s.type = 'air_quality' OR s.type IS NULL)
                    GROUP BY b.name
                    HAVING COUNT(s.station_id) > 0
                    ORDER BY station_count DESC
                    LIMIT 5
                """))
                
                spatial_results = result.fetchall()
                
                if len(spatial_results) > 0:
                    top_county = spatial_results[0]
                    return self.log_test(
                        "Spatial Joins",
                        True,
                        f"Spatial joins working, top county: {top_county.county} ({top_county.station_count} stations)"
                    )
                else:
                    return self.log_test(
                        "Spatial Joins",
                        False,
                        "No stations found within county boundaries"
                    )
        except Exception as e:
            return self.log_test(
                "Spatial Joins",
                False,
                f"Spatial query failed: {e}"
            )
    
    def test_time_series_analysis(self):
        """Test 6: Verify time-series analysis capabilities"""
        try:
            with self.db.get_connection() as conn:
                # Test time-series aggregation
                result = conn.execute(text("""
                    SELECT 
                        station_id,
                        parameter,
                        COUNT(*) as measurement_count,
                        ROUND(AVG(value), 2) as avg_value,
                        MIN(measurement_date) as start_date,
                        MAX(measurement_date) as end_date
                    FROM environmental_measurements
                    WHERE quality_flag = 'VALID'
                    GROUP BY station_id, parameter
                    ORDER BY measurement_count DESC
                    LIMIT 3
                """))
                
                time_series_results = result.fetchall()
                
                if len(time_series_results) > 0:
                    best_station = time_series_results[0]
                    return self.log_test(
                        "Time Series Analysis",
                        True,
                        f"Time-series working, best station: {best_station.station_id} ({best_station.measurement_count} measurements)"
                    )
                else:
                    return self.log_test(
                        "Time Series Analysis",
                        False,
                        "No valid time-series data found"
                    )
        except Exception as e:
            return self.log_test(
                "Time Series Analysis",
                False,
                f"Time-series query failed: {e}"
            )
    
    def test_environmental_risk_analysis(self):
        """Test 7: Verify environmental risk analysis queries"""
        try:
            with self.db.get_connection() as conn:
                # Test risk categorization
                result = conn.execute(text("""
                    SELECT 
                        CASE 
                            WHEN value <= 12 THEN 'Good'
                            WHEN value <= 35.4 THEN 'Moderate'
                            WHEN value <= 55.4 THEN 'Unhealthy for Sensitive Groups'
                            ELSE 'Unhealthy'
                        END as risk_category,
                        COUNT(*) as measurement_count,
                        ROUND(AVG(value), 2) as avg_value
                    FROM environmental_measurements
                    WHERE parameter = 'PM2.5 Mass' 
                    AND quality_flag = 'VALID'
                    AND value IS NOT NULL
                    GROUP BY 
                        CASE 
                            WHEN value <= 12 THEN 'Good'
                            WHEN value <= 35.4 THEN 'Moderate'
                            WHEN value <= 55.4 THEN 'Unhealthy for Sensitive Groups'
                            ELSE 'Unhealthy'
                        END
                    ORDER BY avg_value
                """))
                
                risk_results = result.fetchall()
                
                if len(risk_results) > 0:
                    total_measurements = sum(r.measurement_count for r in risk_results)
                    categories = [r.risk_category for r in risk_results]
                    return self.log_test(
                        "Environmental Risk Analysis",
                        True,
                        f"Risk analysis working, {total_measurements} measurements in {len(categories)} categories"
                    )
                else:
                    return self.log_test(
                        "Environmental Risk Analysis",
                        False,
                        "No PM2.5 measurements found for risk analysis"
                    )
        except Exception as e:
            return self.log_test(
                "Environmental Risk Analysis",
                False,
                f"Risk analysis query failed: {e}"
            )
    
    def test_spatial_index_performance(self):
        """Test 8: Verify spatial indexes are being used"""
        try:
            with self.db.get_connection() as conn:
                # Test spatial index usage with EXPLAIN
                result = conn.execute(text("""
                    EXPLAIN (FORMAT JSON)
                    SELECT COUNT(*)
                    FROM monitoring_stations s
                    JOIN administrative_boundaries b ON ST_Within(s.location, b.geometry)
                    WHERE b.name = 'King County' AND b.type = 'county'
                """))
                
                explain_result = result.fetchone()[0]
                explain_text = str(explain_result)
                
                # Check if index scan is being used
                uses_index = "Index Scan" in explain_text or "Bitmap Index Scan" in explain_text
                
                return self.log_test(
                    "Spatial Index Performance",
                    uses_index,
                    "Spatial indexes active" if uses_index else "Spatial indexes may not be used"
                )
        except Exception as e:
            return self.log_test(
                "Spatial Index Performance",
                False,
                f"Performance test failed: {e}"
            )
    
    def test_data_freshness(self):
        """Test 9: Check data freshness and completeness"""
        try:
            with self.db.get_connection() as conn:
                result = conn.execute(text("""
                    SELECT 
                        COUNT(DISTINCT station_id) as total_stations,
                        COUNT(DISTINCT CASE 
                            WHEN measurement_date >= CURRENT_DATE - INTERVAL '7 days' 
                            THEN station_id 
                        END) as stations_with_recent_data,
                        MAX(measurement_date) as latest_measurement,
                        MIN(measurement_date) as earliest_measurement,
                        CURRENT_DATE - MAX(measurement_date::date) as days_since_latest
                    FROM environmental_measurements
                """))
                
                freshness = result.fetchone()
                
                # Consider data fresh if it's within 30 days (EPA data has delays)
                is_fresh = freshness.days_since_latest is not None and freshness.days_since_latest <= 30
                
                return self.log_test(
                    "Data Freshness",
                    is_fresh,
                    f"Latest: {freshness.latest_measurement}, {freshness.stations_with_recent_data}/{freshness.total_stations} stations recent"
                )
        except Exception as e:
            return self.log_test(
                "Data Freshness",
                False,
                f"Freshness check failed: {e}"
            )
    
    def test_geojson_export(self):
        """Test 10: Verify GeoJSON export for web mapping"""
        try:
            with self.db.get_connection() as conn:
                # Test GeoJSON generation
                result = conn.execute(text("""
                    SELECT 
                        jsonb_build_object(
                            'type', 'Feature',
                            'geometry', ST_AsGeoJSON(s.location)::jsonb,
                            'properties', jsonb_build_object(
                                'station_id', s.station_id,
                                'name', s.name,
                                'agency', s.agency,
                                'type', s.type
                            )
                        ) as geojson_feature
                    FROM monitoring_stations s
                    WHERE s.type = 'air_quality'
                    LIMIT 1
                """))
                
                geojson_result = result.fetchone()
                
                if geojson_result and geojson_result.geojson_feature:
                    geojson_data = geojson_result.geojson_feature
                    has_geometry = 'geometry' in geojson_data and 'coordinates' in geojson_data['geometry']
                    has_properties = 'properties' in geojson_data
                    
                    return self.log_test(
                        "GeoJSON Export",
                        has_geometry and has_properties,
                        "GeoJSON format valid for web mapping"
                    )
                else:
                    return self.log_test(
                        "GeoJSON Export",
                        False,
                        "No GeoJSON data generated"
                    )
        except Exception as e:
            return self.log_test(
                "GeoJSON Export",
                False,
                f"GeoJSON test failed: {e}"
            )
    
    def run_all_tests(self):
        """Run complete test suite"""
        print("🧪 Running Phase 2 Integration Tests")
        print("=" * 50)
        
        # Run all tests
        tests = [
            self.test_database_connection,
            self.test_boundary_data,
            self.test_monitoring_stations,
            self.test_environmental_measurements,
            self.test_spatial_joins,
            self.test_time_series_analysis,
            self.test_environmental_risk_analysis,
            self.test_spatial_index_performance,
            self.test_data_freshness,
            self.test_geojson_export
        ]
        
        passed_tests = []
        failed_tests = []
        
        for test in tests:
            if test():
                passed_tests.append(test.__name__)
            else:
                failed_tests.append(test.__name__)
        
        # Print summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        print(f"✅ Passed: {len(passed_tests)}/{len(tests)}")
        print(f"❌ Failed: {len(failed_tests)}/{len(tests)}")
        
        if failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in failed_tests:
                print(f"   - {test}")
        
        # Overall assessment
        success_rate = len(passed_tests) / len(tests)
        if success_rate >= 0.8:
            print(f"\n🎉 PHASE 2 INTEGRATION: SUCCESS ({success_rate:.1%})")
            print("✅ Ready to proceed to Phase 3: Spatial Analysis Engine")
        elif success_rate >= 0.6:
            print(f"\n⚠️  PHASE 2 INTEGRATION: PARTIAL ({success_rate:.1%})")
            print("🔧 Some issues found, but core functionality working")
        else:
            print(f"\n❌ PHASE 2 INTEGRATION: NEEDS WORK ({success_rate:.1%})")
            print("🛠️  Significant issues found, review setup")
        
        return success_rate >= 0.6
    
    def generate_status_report(self):
        """Generate detailed status report"""
        try:
            with self.db.get_connection() as conn:
                # Collect comprehensive statistics
                stats_query = text("""
                    SELECT 
                        (SELECT COUNT(*) FROM administrative_boundaries WHERE type = 'county') as counties,
                        (SELECT COUNT(*) FROM administrative_boundaries WHERE type = 'city') as cities,
                        (SELECT COUNT(*) FROM monitoring_stations WHERE type = 'air_quality') as air_stations,
                        (SELECT COUNT(*) FROM environmental_measurements) as measurements,
                        (SELECT COUNT(*) FROM environmental_measurements WHERE quality_flag = 'VALID') as valid_measurements,
                        (SELECT COUNT(DISTINCT parameter) FROM environmental_measurements) as parameters,
                        (SELECT MAX(measurement_date) FROM environmental_measurements) as latest_data,
                        (SELECT MIN(measurement_date) FROM environmental_measurements) as earliest_data
                """)
                
                stats = conn.execute(stats_query).fetchone()
                
                # Top counties by station count
                top_counties_query = text("""
                    SELECT 
                        b.name as county,
                        COUNT(s.station_id) as stations,
                        COALESCE(ROUND(AVG(m.value), 1), 0) as avg_pm25
                    FROM administrative_boundaries b
                    LEFT JOIN monitoring_stations s ON ST_Within(s.location, b.geometry)
                    LEFT JOIN environmental_measurements m ON s.station_id = m.station_id 
                        AND m.parameter = 'PM2.5 Mass' 
                        AND m.quality_flag = 'VALID'
                    WHERE b.type = 'county'
                    GROUP BY b.name
                    ORDER BY stations DESC, avg_pm25 DESC
                    LIMIT 10
                """)
                
                top_counties = conn.execute(top_counties_query).fetchall()
                
                print("\n📋 PHASE 2 STATUS REPORT")
                print("=" * 50)
                print(f"📊 Database Contents:")
                print(f"   • Counties: {stats.counties}")
                print(f"   • Cities: {stats.cities}")
                print(f"   • Air Quality Stations: {stats.air_stations}")
                print(f"   • Total Measurements: {stats.measurements}")
                print(f"   • Valid Measurements: {stats.valid_measurements}")
                print(f"   • Parameters Monitored: {stats.parameters}")
                print(f"   • Date Range: {stats.earliest_data} to {stats.latest_data}")
                
                print(f"\n🏆 Top Counties by Station Coverage:")
                for county in top_counties[:5]:
                    if county.stations > 0:
                        pm25_info = f", avg PM2.5: {county.avg_pm25}" if county.avg_pm25 > 0 else ""
                        print(f"   • {county.county}: {county.stations} stations{pm25_info}")
                
                data_quality_pct = (stats.valid_measurements / stats.measurements * 100) if stats.measurements > 0 else 0
                print(f"\n✅ Data Quality: {data_quality_pct:.1f}% measurements validated")
                
        except Exception as e:
            print(f"❌ Status report generation failed: {e}")


def main():
    """Run Phase 2 integration tests"""
    print("🚀 Washington State Environmental Risk Assessment Platform")
    print("Phase 2: EPA AQS Integration Testing")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tester = Phase2Tester()
    
    # Run tests
    success = tester.run_all_tests()
    
    # Generate detailed report
    tester.generate_status_report()
    
    print(f"\n🏁 Testing completed: {datetime.now().strftime('%H:%M:%S')}")
    
    # Return exit code for CI/CD
    return 0 if success else 1


if __name__ == "__main__":
    exit(main())