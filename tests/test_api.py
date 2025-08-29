# test_api.py
"""
Test script for Flask API endpoints
Verifies all API endpoints work correctly with your existing data
"""

import requests
import json
import sys
from datetime import datetime

# API base URL
BASE_URL = "http://localhost:5000/api"

def test_endpoint(endpoint, description, params=None):
    """Test a single API endpoint"""
    try:
        print(f"\n🔍 Testing: {description}")
        print(f"   Endpoint: {endpoint}")
        
        url = f"{BASE_URL}/{endpoint}"
        response = requests.get(url, params=params, timeout=30)
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if endpoint == 'counties':
                print(f"   ✅ Counties found: {len(data.get('features', []))}")
            elif endpoint == 'stations':
                print(f"   ✅ Stations found: {len(data.get('features', []))}")
                if data.get('features'):
                    sample = data['features'][0]['properties']
                    print(f"   📍 Sample: {sample.get('name')} ({sample.get('station_id')})")
            elif endpoint == 'risk-scores':
                scores = data.get('risk_scores', [])
                print(f"   ✅ Risk scores found: {len(scores)}")
                if scores:
                    avg_risk = sum(s['risk_score'] for s in scores) / len(scores)
                    print(f"   📊 Average risk: {avg_risk:.2f}")
            elif endpoint == 'hotspots':
                hotspots = data.get('hotspots', {}).get('features', [])
                print(f"   ✅ Hotspots analysis completed")
                print(f"   🔥 Total hotspots/coldspots: {len(hotspots)}")
                if 'summary' in data:
                    print(f"   📊 Summary: {data['summary']}")
            elif endpoint == 'statewide-risk':
                print(f"   ✅ Statewide analysis completed")
                if 'statewide_summary' in data:
                    avg = data['statewide_summary'].get('average_risk', 'N/A')
                    print(f"   📊 Average statewide risk: {avg}")
            else:
                print(f"   ✅ Response received")
                
        else:
            print(f"   ❌ Error: {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Error details: {error_data}")
            except:
                print(f"   Error text: {response.text}")
                
        return response.status_code == 200
        
    except requests.exceptions.ConnectionError:
        print(f"   ❌ Connection failed - is the API server running?")
        return False
    except Exception as e:
        print(f"   ❌ Unexpected error: {e}")
        return False

def main():
    """Run comprehensive API tests"""
    print("🚀 Washington State Environmental API Test Suite")
    print("=" * 60)
    
    # Test endpoints in logical order
    tests = [
        ('health', 'Health Check'),
        ('counties', 'County Boundaries'),
        ('stations', 'Monitoring Stations'),
        ('stations', 'Stations in King County', {'county': 'King County'}),
        ('risk-scores', 'Risk Scores (Stations)', {'type': 'station'}),
        ('risk-scores', 'Risk Scores (Counties)', {'type': 'county'}),
        ('hotspots', 'Hotspot Detection (Risk Scores)'),
        ('hotspots', 'Hotspot Detection (PM2.5)', {'parameter': 'PM2.5 Mass'}),
        ('statewide-risk', 'Statewide Risk Summary'),
    ]
    
    # Run tests
    passed = 0
    total = len(tests)
    
    for endpoint, description, *params in tests:
        params = params[0] if params else None
        success = test_endpoint(endpoint, description, params)
        if success:
            passed += 1
    
    # Test with specific station if available
    print(f"\n🔍 Testing: Station-Specific Data")
    try:
        # Get a station ID first
        response = requests.get(f"{BASE_URL}/stations", timeout=10)
        if response.status_code == 200:
            stations = response.json().get('features', [])
            if stations:
                station_id = stations[0]['properties']['station_id']
                print(f"   Using station: {station_id}")
                
                measurements_success = test_endpoint(
                    'measurements', 
                    f'Measurements for {station_id}',
                    {'station_id': station_id, 'days': 30}
                )
                
                if measurements_success:
                    passed += 1
                total += 1
    except Exception as e:
        print(f"   ❌ Station-specific test failed: {e}")
    
    # Summary
    print("\n" + "=" * 60)
    print(f"🎯 API Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("✅ All tests passed! API is ready for frontend integration.")
        print("\n🌐 Try these URLs in your browser:")
        print(f"   • http://localhost:5000 (API documentation)")
        print(f"   • http://localhost:5000/api/health (health check)")
        print(f"   • http://localhost:5000/api/counties (county GeoJSON)")
        print(f"   • http://localhost:5000/api/stations (monitoring stations)")
    else:
        print(f"❌ {total - passed} tests failed. Check the API server and database connection.")
        
    return passed == total

if __name__ == "__main__":
    # Check if API server is accessible
    try:
        response = requests.get("http://localhost:5000/api/health", timeout=5)
        main()
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to API server at http://localhost:5000")
        print("\nTo start the API server:")
        print("1. cd src/api")
        print("2. python app.py")
        print("\nThen run this test script again.")
        sys.exit(1)