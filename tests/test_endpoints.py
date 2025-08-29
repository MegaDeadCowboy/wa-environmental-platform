# test_endpoints.py
"""
Quick test script to verify API endpoints work with your data
Run this while your Flask API is running on localhost:5000
"""

import requests
import json

def test_api():
    """Test key API endpoints quickly"""
    base_url = "http://localhost:5000/api"
    
    print("🧪 Quick API Test Suite")
    print("=" * 40)
    
    tests = [
        {
            'name': 'Health Check',
            'url': f"{base_url}/health",
            'expect': 'status'
        },
        {
            'name': 'Counties (GeoJSON)',
            'url': f"{base_url}/counties",
            'expect': 'features'
        },
        {
            'name': 'Monitoring Stations',
            'url': f"{base_url}/stations",
            'expect': 'features'
        },
        {
            'name': 'Risk Scores',
            'url': f"{base_url}/risk-scores?type=station",
            'expect': 'risk_scores'
        },
        {
            'name': 'Hotspot Detection',
            'url': f"{base_url}/hotspots",
            'expect': 'hotspots'
        }
    ]
    
    for test in tests:
        try:
            print(f"\n🔍 {test['name']}")
            response = requests.get(test['url'], timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                if test['expect'] == 'status':
                    print(f"   ✅ Status: {data.get('status', 'unknown')}")
                elif test['expect'] == 'features':
                    features = data.get('features', [])
                    print(f"   ✅ Found {len(features)} features")
                    if features:
                        sample = features[0]['properties']
                        name = sample.get('name', sample.get('station_id', 'Unknown'))
                        print(f"   📍 Sample: {name}")
                elif test['expect'] == 'risk_scores':
                    scores = data.get('risk_scores', [])
                    print(f"   ✅ Found {len(scores)} risk scores")
                    if scores:
                        avg = sum(s['risk_score'] for s in scores) / len(scores)
                        print(f"   📊 Avg risk: {avg:.2f}")
                elif test['expect'] == 'hotspots':
                    print(f"   ✅ Hotspot analysis completed")
                    if 'summary' in data:
                        print(f"   🔥 Summary: {data['summary']}")
                        
            else:
                print(f"   ❌ HTTP {response.status_code}")
                try:
                    error = response.json()
                    print(f"   Error: {error.get('error', 'Unknown error')}")
                except:
                    print(f"   Error: {response.text[:100]}...")
                    
        except requests.exceptions.ConnectionError:
            print(f"   ❌ Connection failed - API server not running?")
            break
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    print(f"\n🌐 Try these URLs in your browser:")
    print(f"   • http://localhost:5000 (API docs)")
    print(f"   • http://localhost:5000/api/counties (WA counties)")
    print(f"   • http://localhost:5000/api/stations (monitoring stations)")

if __name__ == "__main__":
    test_api()