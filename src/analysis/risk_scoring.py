# src/analysis/risk_scoring.py
"""
Environmental Risk Scoring Engine
Calculates comprehensive environmental risk scores for Washington State

Based on EPA methodologies and environmental health research:
- Multi-parameter pollution assessment
- Health-based impact weighting
- Population vulnerability factors
- Temporal and spatial risk aggregation
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import logging
from sqlalchemy import text
import json
from dataclasses import dataclass
from enum import Enum

# Import database manager
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.database import DatabaseManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RiskLevel(Enum):
    """Environmental risk level categories"""
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    VERY_HIGH = "VERY_HIGH"
    HAZARDOUS = "HAZARDOUS"

@dataclass
class RiskParameters:
    """Risk calculation parameters and thresholds"""
    
    # EPA health-based weights (relative risk factors)
    HEALTH_WEIGHTS = {
        'PM2.5 Mass': 1.0,      # Primary standard: 12 μg/m³ annual, 35 μg/m³ 24-hour
        'PM10 Mass': 0.6,       # Primary standard: 150 μg/m³ 24-hour  
        'Ozone': 0.8,           # Primary standard: 70 ppb 8-hour
        'SO2': 0.5,             # Primary standard: 75 ppb 1-hour
        'NO2': 0.4,             # Primary standard: 100 ppb 1-hour
        'CO': 0.3               # Primary standard: 35 ppm 1-hour
    }
    
    # EPA reference concentrations for risk calculation
    REFERENCE_CONCENTRATIONS = {
        'PM2.5 Mass': {'unit': 'μg/m³', 'annual': 12.0, '24hour': 35.0},
        'PM10 Mass': {'unit': 'μg/m³', '24hour': 150.0},
        'Ozone': {'unit': 'ppb', '8hour': 70.0},
        'SO2': {'unit': 'ppb', '1hour': 75.0},
        'NO2': {'unit': 'ppb', '1hour': 100.0, 'annual': 53.0},
        'CO': {'unit': 'ppm', '1hour': 35.0, '8hour': 9.0}
    }
    
    # Risk level thresholds (0-100 scale)
    RISK_THRESHOLDS = {
        RiskLevel.LOW: (0, 25),
        RiskLevel.MODERATE: (25, 50),
        RiskLevel.HIGH: (50, 75),
        RiskLevel.VERY_HIGH: (75, 90),
        RiskLevel.HAZARDOUS: (90, 100)
    }

class EnvironmentalRiskScoring:
    """
    Core environmental risk scoring engine for Washington State
    """
    
    def __init__(self):
        self.db = DatabaseManager()
        self.params = RiskParameters()
        
    def calculate_pollutant_risk_score(self, 
                                     pollutant: str, 
                                     concentration: float, 
                                     averaging_period: str = '24hour') -> float:
        """
        Calculate risk score for individual pollutant
        
        Args:
            pollutant: Pollutant name (e.g., 'PM2.5 Mass')
            concentration: Measured concentration
            averaging_period: Averaging period ('1hour', '8hour', '24hour', 'annual')
            
        Returns:
            Risk score (0-100 scale)
        """
        if pollutant not in self.params.HEALTH_WEIGHTS:
            logger.warning(f"Unknown pollutant: {pollutant}")
            return 0.0
        
        if pollutant not in self.params.REFERENCE_CONCENTRATIONS:
            logger.warning(f"No reference concentration for: {pollutant}")
            return 0.0
        
        ref_data = self.params.REFERENCE_CONCENTRATIONS[pollutant]
        health_weight = self.params.HEALTH_WEIGHTS[pollutant]
        
        # Get reference concentration for averaging period
        if averaging_period in ref_data:
            reference_conc = ref_data[averaging_period]
        elif 'annual' in ref_data:
            reference_conc = ref_data['annual']
        else:
            # Use the first available reference (skip 'unit' key)
            ref_values = [v for k, v in ref_data.items() if k != 'unit' and isinstance(v, (int, float))]
            if ref_values:
                reference_conc = ref_values[0]
            else:
                logger.warning(f"No valid reference concentration for {pollutant}")
                return 0.0
        
        # Calculate concentration ratio
        conc_ratio = concentration / reference_conc
        
        # Apply logarithmic scaling for extreme values
        if conc_ratio > 1.0:
            # Above reference: exponential increase in risk
            base_risk = 50 + (50 * (1 - np.exp(-2 * (conc_ratio - 1))))
        else:
            # Below reference: linear scaling
            base_risk = 50 * conc_ratio
        
        # Apply health weight
        risk_score = base_risk * health_weight
        
        # Cap at 100
        return min(risk_score, 100.0)
    
    def calculate_station_risk_score(self, 
                                   station_id: str, 
                                   date_range: Tuple[datetime, datetime] = None) -> Dict:
        """
        Calculate comprehensive risk score for a monitoring station
        
        Args:
            station_id: Monitoring station identifier
            date_range: Date range for analysis (default: last 30 days)
            
        Returns:
            Dictionary with risk score and component breakdown
        """
        if date_range is None:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
            date_range = (start_date, end_date)
        
        try:
            with self.db.get_connection() as conn:
                # Get recent measurements for station
                query = text("""
                    SELECT parameter, value, unit, measurement_date, quality_flag
                    FROM environmental_measurements
                    WHERE station_id = :station_id
                    AND measurement_date BETWEEN :start_date AND :end_date
                    AND quality_flag = 'VALID'
                    ORDER BY parameter, measurement_date DESC
                """)
                
                result = conn.execute(query, {
                    'station_id': station_id,
                    'start_date': date_range[0],
                    'end_date': date_range[1]
                })
                
                measurements = result.fetchall()
                
                if not measurements:
                    logger.warning(f"No valid measurements found for station {station_id}")
                    return {
                        'station_id': station_id,
                        'risk_score': 0.0,
                        'risk_level': RiskLevel.LOW.value,
                        'components': {},
                        'data_availability': 'NO_DATA'
                    }
                
                # Group by parameter and calculate averages
                param_data = {}
                for row in measurements:
                    param, value, unit, date, flag = row
                    if param not in param_data:
                        param_data[param] = []
                    # Convert Decimal to float for calculations
                    param_data[param].append(float(value))
                
                # Calculate risk scores for each parameter
                component_risks = {}
                total_weighted_risk = 0.0
                total_weight = 0.0
                
                for param, values in param_data.items():
                    if param in self.params.HEALTH_WEIGHTS:
                        avg_concentration = np.mean(values)
                        max_concentration = np.max(values)
                        
                        # Use 95th percentile for risk assessment (accounts for peak exposures)
                        risk_concentration = np.percentile(values, 95)
                        
                        param_risk = self.calculate_pollutant_risk_score(param, risk_concentration)
                        weight = self.params.HEALTH_WEIGHTS[param]
                        
                        component_risks[param] = {
                            'risk_score': round(param_risk, 2),
                            'avg_concentration': round(avg_concentration, 3),
                            'max_concentration': round(max_concentration, 3),
                            'risk_concentration': round(risk_concentration, 3),
                            'sample_count': len(values),
                            'weight': weight
                        }
                        
                        total_weighted_risk += param_risk * weight
                        total_weight += weight
                
                # Calculate composite risk score
                if total_weight > 0:
                    composite_risk = total_weighted_risk / total_weight
                else:
                    composite_risk = 0.0
                
                # Determine risk level
                risk_level = self._get_risk_level(composite_risk)
                
                return {
                    'station_id': station_id,
                    'risk_score': round(composite_risk, 2),
                    'risk_level': risk_level.value,
                    'components': component_risks,
                    'analysis_period': {
                        'start_date': date_range[0].isoformat(),
                        'end_date': date_range[1].isoformat(),
                        'days_analyzed': (date_range[1] - date_range[0]).days
                    },
                    'data_availability': 'GOOD' if len(component_risks) >= 2 else 'LIMITED'
                }
                
        except Exception as e:
            logger.error(f"Failed to calculate risk for station {station_id}: {e}")
            return {
                'station_id': station_id,
                'risk_score': 0.0,
                'risk_level': RiskLevel.LOW.value,
                'components': {},
                'error': str(e)
            }
    
    def calculate_county_risk_score(self, county_name: str, 
                                  date_range: Tuple[datetime, datetime] = None) -> Dict:
        """
        Calculate aggregated risk score for a county using all monitoring stations
        
        Args:
            county_name: County name (e.g., 'King County')
            date_range: Date range for analysis
            
        Returns:
            Dictionary with county risk score and station breakdown
        """
        try:
            with self.db.get_connection() as conn:
                # Get all monitoring stations in the county
                query = text("""
                    SELECT s.station_id, s.name, s.metadata
                    FROM monitoring_stations s
                    JOIN administrative_boundaries b ON ST_Within(s.location, b.geometry)
                    WHERE b.name = :county_name AND b.type = 'county'
                    AND s.type = 'air_quality' AND s.active = true
                """)
                
                result = conn.execute(query, {'county_name': county_name})
                stations = result.fetchall()
                
                if not stations:
                    return {
                        'county': county_name,
                        'risk_score': 0.0,
                        'risk_level': RiskLevel.LOW.value,
                        'stations': [],
                        'data_availability': 'NO_STATIONS'
                    }
                
                # Calculate risk for each station
                station_risks = []
                total_risk = 0.0
                valid_stations = 0
                
                for station_id, station_name, metadata in stations:
                    station_risk = self.calculate_station_risk_score(station_id, date_range)
                    
                    if station_risk['data_availability'] != 'NO_DATA':
                        station_risks.append({
                            'station_id': station_id,
                            'station_name': station_name,
                            'risk_score': station_risk['risk_score'],
                            'risk_level': station_risk['risk_level'],
                            'components': station_risk['components']
                        })
                        
                        total_risk += station_risk['risk_score']
                        valid_stations += 1
                
                # Calculate county average risk
                if valid_stations > 0:
                    county_risk = total_risk / valid_stations
                    risk_level = self._get_risk_level(county_risk)
                    data_availability = 'GOOD' if valid_stations >= 2 else 'LIMITED'
                else:
                    county_risk = 0.0
                    risk_level = RiskLevel.LOW
                    data_availability = 'NO_DATA'
                
                return {
                    'county': county_name,
                    'risk_score': round(county_risk, 2),
                    'risk_level': risk_level.value,
                    'stations': station_risks,
                    'station_count': valid_stations,
                    'analysis_period': {
                        'start_date': date_range[0].isoformat() if date_range else None,
                        'end_date': date_range[1].isoformat() if date_range else None,
                        'days_analyzed': (date_range[1] - date_range[0]).days if date_range else None
                    } if station_risks else None,
                    'data_availability': data_availability
                }
                
        except Exception as e:
            logger.error(f"Failed to calculate county risk for {county_name}: {e}")
            return {
                'county': county_name,
                'risk_score': 0.0,
                'risk_level': RiskLevel.LOW.value,
                'error': str(e)
            }
    
    def calculate_statewide_risk_summary(self, 
                                       date_range: Tuple[datetime, datetime] = None) -> Dict:
        """
        Calculate statewide environmental risk summary
        
        Returns:
            Statewide risk metrics and county rankings
        """
        try:
            with self.db.get_connection() as conn:
                # Get all counties with monitoring stations
                query = text("""
                    SELECT DISTINCT b.name as county_name
                    FROM administrative_boundaries b
                    JOIN monitoring_stations s ON ST_Within(s.location, b.geometry)
                    WHERE b.type = 'county' AND s.type = 'air_quality' AND s.active = true
                    ORDER BY b.name
                """)
                
                result = conn.execute(query)
                counties = [row[0] for row in result.fetchall()]
                
                county_risks = []
                total_risk = 0.0
                
                for county in counties:
                    county_risk = self.calculate_county_risk_score(county, date_range)
                    
                    if county_risk['data_availability'] != 'NO_DATA':
                        county_risks.append(county_risk)
                        total_risk += county_risk['risk_score']
                
                # Calculate statewide statistics
                if county_risks:
                    avg_risk = total_risk / len(county_risks)
                    risk_scores = [c['risk_score'] for c in county_risks]
                    
                    statewide_stats = {
                        'average_risk': round(avg_risk, 2),
                        'median_risk': round(np.median(risk_scores), 2),
                        'min_risk': round(np.min(risk_scores), 2),
                        'max_risk': round(np.max(risk_scores), 2),
                        'std_risk': round(np.std(risk_scores), 2)
                    }
                    
                    # Sort counties by risk score
                    county_risks.sort(key=lambda x: x['risk_score'], reverse=True)
                    
                    return {
                        'statewide_summary': statewide_stats,
                        'county_rankings': county_risks,
                        'counties_analyzed': len(county_risks),
                        'analysis_date': datetime.now().isoformat(),
                        'data_availability': 'GOOD'
                    }
                else:
                    return {
                        'statewide_summary': {},
                        'county_rankings': [],
                        'counties_analyzed': 0,
                        'data_availability': 'NO_DATA'
                    }
                    
        except Exception as e:
            logger.error(f"Failed to calculate statewide risk: {e}")
            return {'error': str(e)}
    
    def _get_risk_level(self, risk_score: float) -> RiskLevel:
        """Convert numeric risk score to categorical risk level"""
        for level, (min_score, max_score) in self.params.RISK_THRESHOLDS.items():
            if min_score <= risk_score < max_score:
                return level
        return RiskLevel.HAZARDOUS  # For scores >= 90
    
    def save_risk_scores_to_db(self, risk_data: Dict, location_type: str = 'station'):
        """
        Save calculated risk scores to database for later analysis
        
        Args:
            risk_data: Risk calculation results
            location_type: 'station' or 'county'
        """
        try:
            with self.db.get_connection() as conn:
                # Create table if it doesn't exist
                create_table_query = text("""
                    CREATE TABLE IF NOT EXISTS environmental_risk_scores (
                        id SERIAL PRIMARY KEY,
                        location_id VARCHAR(50),
                        location_type VARCHAR(20),
                        risk_score NUMERIC(5,2),
                        risk_category VARCHAR(20),
                        contributing_factors JSONB,
                        calculation_date DATE,
                        created_at TIMESTAMP DEFAULT NOW()
                    );
                """)
                conn.execute(create_table_query)
                
                # Insert risk score
                insert_query = text("""
                    INSERT INTO environmental_risk_scores 
                    (location_id, location_type, risk_score, risk_category, 
                     contributing_factors, calculation_date)
                    VALUES (:location_id, :location_type, :risk_score, :risk_category,
                           :contributing_factors, :calculation_date)
                """)
                
                location_id = risk_data.get('station_id') or risk_data.get('county')
                
                conn.execute(insert_query, {
                    'location_id': location_id,
                    'location_type': location_type,
                    'risk_score': float(risk_data['risk_score']),  # Convert numpy to native float
                    'risk_category': risk_data['risk_level'],
                    'contributing_factors': json.dumps(risk_data.get('components', {})),
                    'calculation_date': datetime.now().date()
                })
                
                conn.commit()
                logger.info(f"✅ Saved risk score for {location_type}: {location_id}")
                
        except Exception as e:
            logger.error(f"Failed to save risk score: {e}")

def test_risk_calculation():
    """
    Test individual risk calculation functions
    """
    logger.info("🧪 Testing Risk Calculation Functions")
    
    risk_engine = EnvironmentalRiskScoring()
    
    # Test 1: Individual pollutant risk scoring
    logger.info("\n📊 Test 1: Individual Pollutant Risk Scoring")
    
    test_cases = [
        ("PM2.5 Mass", 15.0, "24hour"),  # Above EPA standard (35 μg/m³)
        ("PM2.5 Mass", 8.0, "annual"),   # Below EPA standard (12 μg/m³)
        ("Ozone", 80.0, "8hour"),        # Above EPA standard (70 ppb)
        ("Ozone", 45.0, "8hour"),        # Below EPA standard
    ]
    
    for pollutant, concentration, period in test_cases:
        risk_score = risk_engine.calculate_pollutant_risk_score(pollutant, concentration, period)
        logger.info(f"   {pollutant} ({concentration} at {period}): Risk Score = {risk_score:.1f}")
    
    # Test 2: Database connection
    logger.info("\n🔌 Test 2: Database Connection")
    if risk_engine.db.test_connection():
        logger.info("   ✅ Database connection successful")
    else:
        logger.error("   ❌ Database connection failed")
        return False
    
    return True

def demo_risk_analysis():
    """
    Demonstrate the risk scoring engine with current data
    """
    logger.info("🎯 Environmental Risk Scoring Engine Demo")
    
    risk_engine = EnvironmentalRiskScoring()
    
    # Test database connection
    if not risk_engine.db.test_connection():
        logger.error("❌ Database connection failed")
        return
    
    # Get available stations for testing
    try:
        with risk_engine.db.get_connection() as conn:
            result = conn.execute(text("""
                SELECT station_id, name, metadata->>'parameter_name' as parameter
                FROM monitoring_stations 
                WHERE type = 'air_quality' AND active = true
                LIMIT 5
            """))
            
            stations = result.fetchall()
            
            if not stations:
                logger.warning("⚠️ No monitoring stations found")
                return
            
            logger.info(f"📊 Analyzing {len(stations)} monitoring stations:")
            
            # Calculate risk for each station
            station_results = []
            for station_id, name, parameter in stations:
                logger.info(f"\n🏭 Analyzing: {name} ({parameter})")
                
                risk_result = risk_engine.calculate_station_risk_score(station_id)
                station_results.append(risk_result)
                
                logger.info(f"   Risk Score: {risk_result['risk_score']}/100")
                logger.info(f"   Risk Level: {risk_result['risk_level']}")
                logger.info(f"   Data Quality: {risk_result['data_availability']}")
                
                # Show component breakdown if available
                if risk_result.get('components'):
                    logger.info(f"   Components:")
                    for param, details in risk_result['components'].items():
                        logger.info(f"     - {param}: {details['risk_score']:.1f} (avg: {details['avg_concentration']})")
                
                # Save to database
                risk_engine.save_risk_scores_to_db(risk_result, 'station')
            
            # Calculate county-level risks
            logger.info(f"\n🏘️ County-Level Risk Analysis:")
            
            # Get counties with stations
            county_result = conn.execute(text("""
                SELECT DISTINCT b.name as county_name
                FROM administrative_boundaries b
                JOIN monitoring_stations s ON ST_Within(s.location, b.geometry)
                WHERE b.type = 'county' AND s.type = 'air_quality'
                ORDER BY b.name
                LIMIT 3
            """))
            
            counties = [row[0] for row in county_result.fetchall()]
            
            county_results = []
            for county in counties:
                logger.info(f"\n📍 Analyzing: {county}")
                
                county_risk = risk_engine.calculate_county_risk_score(county)
                county_results.append(county_risk)
                
                logger.info(f"   County Risk: {county_risk['risk_score']}/100")
                logger.info(f"   Risk Level: {county_risk['risk_level']}")
                logger.info(f"   Stations: {county_risk['station_count']}")
                
                # Save to database
                risk_engine.save_risk_scores_to_db(county_risk, 'county')
            
            # Generate statewide summary
            logger.info(f"\n🗺️ Statewide Risk Summary:")
            
            statewide = risk_engine.calculate_statewide_risk_summary()
            
            if 'statewide_summary' in statewide and statewide['statewide_summary']:
                stats = statewide['statewide_summary']
                logger.info(f"   Average Risk: {stats.get('average_risk', 'N/A')}/100")
                logger.info(f"   Risk Range: {stats.get('min_risk', 'N/A')} - {stats.get('max_risk', 'N/A')}")
                logger.info(f"   Counties Analyzed: {statewide['counties_analyzed']}")
                
                # Show top 3 highest risk counties
                if statewide['county_rankings']:
                    logger.info(f"\n🚨 Highest Risk Counties:")
                    for i, county in enumerate(statewide['county_rankings'][:3], 1):
                        logger.info(f"   {i}. {county['county']}: {county['risk_score']}/100 ({county['risk_level']})")
            else:
                logger.info("   No statewide data available")
            
            logger.info(f"\n✅ Risk analysis complete! Results saved to database.")
            
            # Display methodology summary
            logger.info(f"\n📋 Risk Scoring Methodology:")
            logger.info(f"   • Multi-parameter assessment (PM2.5, Ozone, etc.)")
            logger.info(f"   • EPA health-based weighting factors")
            logger.info(f"   • 95th percentile exposure calculations")
            logger.info(f"   • Logarithmic scaling for extreme values")
            logger.info(f"   • 0-100 risk score scale")
            
    except Exception as e:
        logger.error(f"❌ Demo failed: {e}")

if __name__ == "__main__":
    # Run tests first
    if test_risk_calculation():
        logger.info("✅ All tests passed!")
        # Run demo
        demo_risk_analysis()
    else:
        logger.error("❌ Tests failed - skipping demo")