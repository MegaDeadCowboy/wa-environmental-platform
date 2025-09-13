#!/usr/bin/env python3
"""
Washington State Environmental API - Comprehensive Endpoint Testing Script
Tests all 12 API endpoints with various parameters and stress scenarios
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any
import concurrent.futures
import sys

class APITester:
    def __init__(self, base_url: str = "http://localhost:5000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.results = {}
        self.errors = []
        
    def log(self, message: str, level: str = "INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def test_endpoint(self, name: str, endpoint: str, params: Dict = None, timeout: int = 10) -> Dict:
        """Test a single endpoint and return performance metrics"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            start_time = time.time()
            response = self.session.get(url, params=params, timeout=timeout)
            end_time = time.time()
            
            response_time = round((end_time - start_time) * 1000, 2)  # milliseconds
            
            result = {
                'name': name,
                'endpoint': endpoint,
                'params': params or {},
                'status_code': response.status_code,
                'response_time_ms': response_time,
                'content_length': len(response.content),
                'success': response.status_code == 200,
                'error': None
            }
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    result['data_type'] = type(data).__name__
                    
                    # Extract useful metrics from response
                    if isinstance(data, dict):
                        if 'features' in data:  # GeoJSON
                            result['feature_count'] = len(data['features'])
                        elif 'risk_scores' in data:  # Risk scores
                            result['risk_score_count'] = len(data['risk_scores'])
                        elif 'parameters' in data:  # Parameters
                            result['parameter_count'] = len(data['parameters'])
                        elif 'alerts' in data:  # Alerts
                            result['alert_count'] = len(data['alerts'])
                        elif 'measurements' in data:  # Measurements
                            result['measurement_count'] = len(data['measurements'])
                        elif 'water_body_types' in data:  # Water body types
                            result['water_body_type_count'] = len(data['water_body_types'])
                        
                except json.JSONDecodeError:
                    result['error'] = "Invalid JSON response"
                    result['success'] = False
            else:
                result['error'] = f"HTTP {response.status_code}: {response.text[:200]}"
                result['success'] = False
                
        except requests.exceptions.Timeout:
            result = {
                'name': name, 'endpoint': endpoint, 'params': params or {},
                'status_code': 0, 'response_time_ms': timeout * 1000,
                'content_length': 0, 'success': False, 
                'error': f"Timeout after {timeout}s"
            }
        except requests.exceptions.RequestException as e:
            result = {
                'name': name, 'endpoint': endpoint, 'params': params or {},
                'status_code': 0, 'response_time_ms': 0,
                'content_length': 0, 'success': False,
                'error': str(e)
            }
            
        return result
    
    def run_basic_tests(self) -> List[Dict]:
        """Test all 12 endpoints with basic parameters"""
        self.log("Starting basic endpoint tests...")
        
        test_cases = [
            # Core endpoints
            ("Health Check", "/api/health"),
            ("API Documentation", "/"),
            ("Counties", "/api/counties"),
            ("Air Quality Stations", "/api/stations"),
            ("Risk Scores", "/api/risk-scores"),
            ("Hotspots", "/api/hotspots"),
            ("Statewide Risk", "/api/statewide-risk"),
            
            # Water Quality endpoints
            ("Water Quality Stations", "/api/water-quality/stations"),
            ("Water Quality Parameters", "/api/water-quality/parameters"),
            ("Water Body Types", "/api/water-quality/water-body-types"),
            ("Water Quality Alerts", "/api/water-quality/alerts"),
        ]
        
        results = []
        for name, endpoint in test_cases:
            self.log(f"Testing {name}...")
            result = self.test_endpoint(name, endpoint)
            results.append(result)
            
            status = "PASS" if result['success'] else "FAIL"
            self.log(f"  {status}: {result['response_time_ms']}ms, {result['content_length']} bytes")
            
            if not result['success']:
                self.errors.append(f"{name}: {result['error']}")
                
        return results
    
    def run_parameter_tests(self) -> List[Dict]:
        """Test endpoints with various parameters"""
        self.log("Starting parameter-based tests...")
        
        # First get some data to use in parameterized tests
        stations_response = self.session.get(f"{self.base_url}/api/stations")
        water_stations_response = self.session.get(f"{self.base_url}/api/water-quality/stations")
        
        sample_station_id = None
        sample_water_station_id = None
        
        try:
            if stations_response.status_code == 200:
                stations_data = stations_response.json()
                if stations_data.get('features'):
                    sample_station_id = stations_data['features'][0]['properties']['station_id']
                    
            if water_stations_response.status_code == 200:
                water_data = water_stations_response.json()
                if water_data.get('features'):
                    sample_water_station_id = water_data['features'][0]['properties']['station_id']
        except:
            pass
        
        parameter_tests = [
            ("Air Stations - Active Only", "/api/stations", {"active": "true"}),
            ("Air Stations - All", "/api/stations", {"active": "false"}),
            ("Risk Scores - Station Type", "/api/risk-scores", {"type": "station"}),
            ("Risk Scores - County Type", "/api/risk-scores", {"type": "county"}),
            ("Hotspots - 95% Significance", "/api/hotspots", {"significance": "95%"}),
            ("Hotspots - PM2.5", "/api/hotspots", {"parameter": "PM2.5 Mass"}),
            ("Water Stations - Active", "/api/water-quality/stations", {"active": "true"}),
            ("Water Alerts - 30 days", "/api/water-quality/alerts", {"days": "30"}),
            ("Water Alerts - Critical", "/api/water-quality/alerts", {"severity": "critical"}),
        ]
        
        # Add measurement tests if we have station IDs
        if sample_station_id:
            parameter_tests.append(("Measurements - Air Station", "/api/measurements", 
                                  {"station_id": sample_station_id, "days": "7"}))
            
        if sample_water_station_id:
            parameter_tests.append(("Water Trends", "/api/water-quality/trends", 
                                  {"station_id": sample_water_station_id, "days": "30"}))
        
        results = []
        for name, endpoint, params in parameter_tests:
            self.log(f"Testing {name}...")
            result = self.test_endpoint(name, endpoint, params)
            results.append(result)
            
            status = "PASS" if result['success'] else "FAIL"
            self.log(f"  {status}: {result['response_time_ms']}ms")
            
            if not result['success']:
                self.errors.append(f"{name}: {result['error']}")
                
        return results
    
    def run_stress_tests(self) -> List[Dict]:
        """Run concurrent requests to test server performance"""
        self.log("Starting stress tests (concurrent requests)...")
        
        # Test endpoints that should handle multiple concurrent requests well
        stress_endpoints = [
            ("Health Check", "/api/health"),
            ("Counties", "/api/counties"),
            ("Air Quality Stations", "/api/stations"),
            ("Water Quality Stations", "/api/water-quality/stations"),
            ("Water Quality Parameters", "/api/water-quality/parameters"),
        ]
        
        results = []
        
        for name, endpoint in stress_endpoints:
            self.log(f"Stress testing {name} (10 concurrent requests)...")
            
            # Run 10 concurrent requests
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                start_time = time.time()
                futures = [executor.submit(self.test_endpoint, f"{name} #{i+1}", endpoint) 
                          for i in range(10)]
                
                concurrent_results = []
                for future in concurrent.futures.as_completed(futures):
                    concurrent_results.append(future.result())
                    
                end_time = time.time()
                
            # Analyze results
            successful = [r for r in concurrent_results if r['success']]
            failed = [r for r in concurrent_results if not r['success']]
            
            if successful:
                avg_response_time = sum(r['response_time_ms'] for r in successful) / len(successful)
                max_response_time = max(r['response_time_ms'] for r in successful)
                min_response_time = min(r['response_time_ms'] for r in successful)
            else:
                avg_response_time = max_response_time = min_response_time = 0
                
            stress_result = {
                'name': f"{name} - Stress Test",
                'endpoint': endpoint,
                'total_requests': 10,
                'successful_requests': len(successful),
                'failed_requests': len(failed),
                'success_rate': len(successful) / 10 * 100,
                'total_time_ms': round((end_time - start_time) * 1000, 2),
                'avg_response_time_ms': round(avg_response_time, 2),
                'min_response_time_ms': round(min_response_time, 2),
                'max_response_time_ms': round(max_response_time, 2),
                'success': len(successful) >= 8  # At least 80% success rate
            }
            
            results.append(stress_result)
            
            status = "PASS" if stress_result['success'] else "FAIL"
            self.log(f"  {status}: {stress_result['success_rate']:.0f}% success, {stress_result['avg_response_time_ms']:.0f}ms avg")
            
            if not stress_result['success']:
                self.errors.append(f"{name} stress test: Only {len(successful)}/10 requests succeeded")
                
        return results
    
    def run_edge_case_tests(self) -> List[Dict]:
        """Test edge cases and error conditions"""
        self.log("Starting edge case tests...")
        
        edge_cases = [
            ("Invalid Endpoint", "/api/nonexistent", None, 404),
            ("Measurements - No Station ID", "/api/measurements", {}, 400),
            ("Water Trends - No Station ID", "/api/water-quality/trends", {}, 400),
            ("Measurements - Invalid Station", "/api/measurements", {"station_id": "INVALID-123"}, 200),  # Should return empty
            ("Water Alerts - Invalid Severity", "/api/water-quality/alerts", {"severity": "invalid"}, 200),  # Should default
            ("Hotspots - Invalid Significance", "/api/hotspots", {"significance": "invalid"}, 200),  # Should default
            ("Large Days Parameter", "/api/water-quality/alerts", {"days": "9999"}, 200),  # Should handle gracefully
        ]
        
        results = []
        for name, endpoint, params, expected_status in edge_cases:
            self.log(f"Testing {name}...")
            result = self.test_endpoint(name, endpoint, params)
            
            # For edge cases, we expect specific status codes
            result['expected_status'] = expected_status
            result['success'] = result['status_code'] == expected_status
            
            results.append(result)
            
            status = "PASS" if result['success'] else "FAIL"
            expected_got = f"(expected {expected_status}, got {result['status_code']})"
            self.log(f"  {status}: {result['response_time_ms']}ms {expected_got}")
            
            if not result['success']:
                self.errors.append(f"{name}: Expected {expected_status}, got {result['status_code']}")
                
        return results
    
    def generate_report(self, all_results: List[Dict]):
        """Generate a comprehensive test report"""
        self.log("Generating test report...")
        
        print("\n" + "="*80)
        print("WASHINGTON STATE ENVIRONMENTAL API - COMPREHENSIVE TEST REPORT")
        print("="*80)
        print(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Base URL: {self.base_url}")
        
        # Overall statistics
        total_tests = len(all_results)
        successful_tests = len([r for r in all_results if r.get('success', False)])
        failed_tests = total_tests - successful_tests
        success_rate = successful_tests / total_tests * 100 if total_tests > 0 else 0
        
        print(f"\nOVERALL RESULTS:")
        print(f"  Total Tests: {total_tests}")
        print(f"  Successful: {successful_tests}")
        print(f"  Failed: {failed_tests}")
        print(f"  Success Rate: {success_rate:.1f}%")
        
        # Performance statistics for successful tests
        successful_results = [r for r in all_results if r.get('success', False) and 'response_time_ms' in r]
        if successful_results:
            response_times = [r['response_time_ms'] for r in successful_results]
            avg_response = sum(response_times) / len(response_times)
            max_response = max(response_times)
            min_response = min(response_times)
            
            print(f"\nPERFORMANCE METRICS:")
            print(f"  Average Response Time: {avg_response:.1f}ms")
            print(f"  Fastest Response: {min_response:.1f}ms")
            print(f"  Slowest Response: {max_response:.1f}ms")
            
            # Performance categories
            fast_responses = len([t for t in response_times if t < 100])
            medium_responses = len([t for t in response_times if 100 <= t < 500])
            slow_responses = len([t for t in response_times if t >= 500])
            
            print(f"  Fast (<100ms): {fast_responses}")
            print(f"  Medium (100-500ms): {medium_responses}")
            print(f"  Slow (>500ms): {slow_responses}")
        
        # Data volume statistics
        data_tests = [r for r in all_results if r.get('success', False)]
        if data_tests:
            print(f"\nDATA VOLUME ANALYSIS:")
            
            for key in ['feature_count', 'risk_score_count', 'parameter_count', 'alert_count']:
                relevant_tests = [r for r in data_tests if key in r]
                if relevant_tests:
                    values = [r[key] for r in relevant_tests]
                    total_items = sum(values)
                    print(f"  {key.replace('_', ' ').title()}: {total_items} total across {len(values)} endpoints")
        
        # Failed tests details
        if self.errors:
            print(f"\nFAILED TESTS DETAILS:")
            for error in self.errors:
                print(f"  ❌ {error}")
        
        # Endpoint-specific results
        print(f"\nDETAILED ENDPOINT RESULTS:")
        print("-" * 80)
        for result in all_results:
            status_icon = "✅" if result.get('success', False) else "❌"
            name = result.get('name', 'Unknown')
            endpoint = result.get('endpoint', '')
            response_time = result.get('response_time_ms', 0)
            
            print(f"{status_icon} {name}")
            print(f"   Endpoint: {endpoint}")
            print(f"   Response Time: {response_time}ms")
            
            if 'params' in result and result['params']:
                print(f"   Parameters: {result['params']}")
                
            if result.get('feature_count'):
                print(f"   Features: {result['feature_count']}")
            if result.get('alert_count') is not None:
                print(f"   Alerts: {result['alert_count']}")
            if result.get('parameter_count'):
                print(f"   Parameters: {result['parameter_count']}")
                
            if result.get('error'):
                print(f"   Error: {result['error']}")
                
            print()
        
        print("="*80)
        
        # Final assessment
        if success_rate >= 90:
            print("🎉 ASSESSMENT: API is performing excellently!")
        elif success_rate >= 75:
            print("✅ ASSESSMENT: API is performing well with minor issues")
        elif success_rate >= 50:
            print("⚠️  ASSESSMENT: API has significant issues that need attention")
        else:
            print("❌ ASSESSMENT: API has major problems and requires immediate fixes")
            
        print(f"Multi-domain platform status: {'OPERATIONAL' if success_rate >= 80 else 'NEEDS ATTENTION'}")
        
    def run_all_tests(self):
        """Run the complete test suite"""
        print("🚀 Starting comprehensive API testing...")
        print("This will test all 12 endpoints with various scenarios")
        print()
        
        all_results = []
        
        # Run all test categories
        all_results.extend(self.run_basic_tests())
        print()
        all_results.extend(self.run_parameter_tests()) 
        print()
        all_results.extend(self.run_stress_tests())
        print()
        all_results.extend(self.run_edge_case_tests())
        print()
        
        # Generate comprehensive report
        self.generate_report(all_results)
        
        return len(self.errors) == 0  # Return True if no errors

def main():
    """Main function to run the test suite"""
    if len(sys.argv) > 1:
        base_url = sys.argv[1]
    else:
        base_url = "http://localhost:5000"
        
    print(f"Testing API at: {base_url}")
    print("Make sure your Flask API is running before starting tests!")
    print()
    
    # Wait a moment for user to confirm
    try:
        input("Press Enter to start testing, or Ctrl+C to cancel...")
    except KeyboardInterrupt:
        print("\nTest cancelled by user")
        return
        
    tester = APITester(base_url)
    
    try:
        success = tester.run_all_tests()
        
        if success:
            print("\n🎉 All tests passed! Your API is ready for production.")
            sys.exit(0)
        else:
            print(f"\n⚠️  {len(tester.errors)} test(s) failed. Review the report above.")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\nTesting interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Testing failed with error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()