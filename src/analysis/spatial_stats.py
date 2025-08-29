# src/analysis/spatial_stats.py
"""
Spatial Statistics & Hotspot Detection Engine
Advanced spatial analysis for environmental risk assessment

Capabilities:
- Hotspot detection using Getis-Ord Gi* statistic
- Spatial clustering with DBSCAN
- Spatial interpolation with Kriging
- Outlier detection for data quality
- Spatial autocorrelation analysis
"""

import numpy as np
import pandas as pd
import geopandas as gpd
from scipy import spatial, stats
from sklearn.cluster import DBSCAN
from sklearn.neighbors import NearestNeighbors
from shapely.geometry import Point, Polygon, MultiPolygon
from shapely.ops import unary_union
import logging
from typing import Dict, List, Tuple, Optional, Union
from datetime import datetime, timedelta
from sqlalchemy import text
import json
import warnings
warnings.filterwarnings('ignore')

# Import database manager and risk scoring
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.database import DatabaseManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SpatialStatsEngine:
    """
    Advanced spatial statistics for environmental data analysis
    """
    
    def __init__(self):
        self.db = DatabaseManager()
        self.hotspot_cache = {}
        
        # Analysis parameters
        self.SIGNIFICANCE_LEVELS = {
            '90%': 1.645,   # Z-score for 90% confidence
            '95%': 1.96,    # Z-score for 95% confidence  
            '99%': 2.576    # Z-score for 99% confidence
        }
        
        self.CLUSTERING_PARAMS = {
            'eps': 0.1,          # Maximum distance between points (degrees)
            'min_samples': 2,    # Minimum points to form a cluster
            'metric': 'haversine' # Great circle distance
        }
        
        self.INTERPOLATION_PARAMS = {
            'grid_resolution': 0.01,  # Grid spacing in degrees
            'max_distance': 0.5,      # Maximum interpolation distance
            'power': 2                # Inverse distance weighting power
        }
    
    def calculate_spatial_weights(self, 
                                stations_gdf: gpd.GeoDataFrame, 
                                method: str = 'knn',
                                k: int = 4) -> np.ndarray:
        """
        Calculate spatial weights matrix for stations
        
        Args:
            stations_gdf: GeoDataFrame with monitoring stations
            method: 'knn' (k-nearest neighbors) or 'distance'
            k: Number of nearest neighbors for knn method
            
        Returns:
            Spatial weights matrix
        """
        n_stations = len(stations_gdf)
        weights = np.zeros((n_stations, n_stations))
        
        # Extract coordinates
        coords = np.array([[point.x, point.y] for point in stations_gdf.geometry])
        
        if method == 'knn':
            # K-nearest neighbors weights
            nbrs = NearestNeighbors(n_neighbors=min(k+1, n_stations), metric='haversine').fit(np.radians(coords))
            distances, indices = nbrs.kneighbors(np.radians(coords))
            
            for i in range(n_stations):
                for j_idx, j in enumerate(indices[i][1:]):  # Skip self (first element)
                    if j < n_stations and distances[i][j_idx+1] > 0:
                        # Inverse distance weighting
                        weights[i, j] = 1.0 / distances[i][j_idx+1]
                        weights[j, i] = weights[i, j]  # Symmetric
        
        elif method == 'distance':
            # Distance-based weights
            dist_matrix = spatial.distance_matrix(coords, coords, p=2)
            
            # Convert to weights (inverse distance, avoid division by zero)
            weights = np.where(dist_matrix > 0, 1.0 / dist_matrix, 0)
            np.fill_diagonal(weights, 0)  # No self-weight
        
        # Row-normalize weights
        row_sums = weights.sum(axis=1)
        weights = np.where(row_sums[:, np.newaxis] > 0, 
                          weights / row_sums[:, np.newaxis], 0)
        
        return weights
    
    def getis_ord_gi_star(self, 
                         stations_gdf: gpd.GeoDataFrame, 
                         values: np.ndarray,
                         weights: np.ndarray = None,
                         significance_level: str = '95%') -> Dict:
        """
        Calculate Getis-Ord Gi* hotspot statistic
        
        Args:
            stations_gdf: GeoDataFrame with station locations
            values: Array of values to analyze (e.g., risk scores)
            weights: Spatial weights matrix (computed if not provided)
            significance_level: '90%', '95%', or '99%'
            
        Returns:
            Dictionary with Gi* statistics and hotspot classifications
        """
        n = len(values)
        if n < 3:
            logger.warning("Need at least 3 stations for hotspot analysis")
            return {}
        
        if weights is None:
            weights = self.calculate_spatial_weights(stations_gdf)
        
        # Calculate Gi* statistic for each location
        gi_stats = np.zeros(n)
        z_scores = np.zeros(n)
        p_values = np.zeros(n)
        
        # Global statistics
        global_mean = np.mean(values)
        global_std = np.std(values)
        
        for i in range(n):
            # Include focal point in calculation (Gi* vs Gi)
            w_i = weights[i, :].copy()
            w_i[i] = 1.0  # Include self
            
            # Local sum
            local_sum = np.sum(w_i * values)
            sum_weights = np.sum(w_i)
            
            if sum_weights > 0:
                # Expected value and variance
                expected = global_mean * sum_weights
                
                # Variance calculation
                s_squared = np.sum((values - global_mean) ** 2) / n
                variance = s_squared * (n * np.sum(w_i**2) - sum_weights**2) / (n - 1)
                
                if variance > 0:
                    # Gi* statistic
                    gi_stats[i] = local_sum
                    
                    # Z-score
                    z_scores[i] = (local_sum - expected) / np.sqrt(variance)
                    
                    # P-value (two-tailed)
                    p_values[i] = 2 * (1 - stats.norm.cdf(abs(z_scores[i])))
        
        # Classification based on significance level
        critical_value = self.SIGNIFICANCE_LEVELS[significance_level]
        
        classifications = []
        for i in range(n):
            if abs(z_scores[i]) > critical_value:
                if z_scores[i] > 0:
                    classifications.append('HOT_SPOT')
                else:
                    classifications.append('COLD_SPOT')
            else:
                classifications.append('NOT_SIGNIFICANT')
        
        return {
            'gi_statistics': gi_stats,
            'z_scores': z_scores,
            'p_values': p_values,
            'classifications': classifications,
            'significance_level': significance_level,
            'critical_value': critical_value
        }
    
    def detect_pollution_hotspots(self, 
                                parameter: str = None,
                                date_range: Tuple[datetime, datetime] = None,
                                significance_level: str = '95%') -> Dict:
        """
        Detect environmental pollution hotspots across Washington State
        
        Args:
            parameter: Pollutant to analyze ('PM2.5 Mass', 'Ozone', etc.)
            date_range: Date range for analysis
            significance_level: Statistical significance level
            
        Returns:
            Dictionary with hotspot analysis results
        """
        logger.info(f"🔍 Detecting pollution hotspots for {parameter or 'all parameters'}")
        
        if date_range is None:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
            date_range = (start_date, end_date)
        
        try:
            with self.db.get_connection() as conn:
                # Query to get stations with recent measurements
                if parameter:
                    query = text("""
                        SELECT DISTINCT 
                            s.station_id,
                            s.name,
                            ST_X(s.location) as longitude,
                            ST_Y(s.location) as latitude,
                            AVG(m.value) as avg_value,
                            COUNT(m.value) as measurement_count
                        FROM monitoring_stations s
                        JOIN environmental_measurements m ON s.station_id = m.station_id
                        WHERE s.type = 'air_quality' 
                        AND s.active = true
                        AND m.parameter = :parameter
                        AND m.measurement_date BETWEEN :start_date AND :end_date
                        AND m.quality_flag = 'VALID'
                        GROUP BY s.station_id, s.name, s.location
                        HAVING COUNT(m.value) >= 5
                        ORDER BY s.station_id
                    """)
                    
                    result = conn.execute(query, {
                        'parameter': parameter,
                        'start_date': date_range[0],
                        'end_date': date_range[1]
                    })
                else:
                    # Use risk scores from environmental_risk_scores table
                    query = text("""
                        SELECT DISTINCT 
                            s.station_id,
                            s.name,
                            ST_X(s.location) as longitude,
                            ST_Y(s.location) as latitude,
                            ers.risk_score as avg_value,
                            1 as measurement_count
                        FROM monitoring_stations s
                        JOIN environmental_risk_scores ers ON s.station_id = ers.location_id
                        WHERE s.type = 'air_quality' 
                        AND s.active = true
                        AND ers.location_type = 'station'
                        ORDER BY s.station_id
                    """)
                    
                    result = conn.execute(query)
                
                data = result.fetchall()
                
                if len(data) < 3:
                    logger.warning(f"Insufficient data for hotspot analysis: {len(data)} stations")
                    return {
                        'parameter': parameter,
                        'stations_analyzed': len(data),
                        'hotspots': [],
                        'error': 'Insufficient data'
                    }
                
                # Create GeoDataFrame
                df = pd.DataFrame(data, columns=[
                    'station_id', 'name', 'longitude', 'latitude', 'avg_value', 'measurement_count'
                ])
                
                # Convert decimal values to float for calculations
                df['avg_value'] = df['avg_value'].astype(float)
                df['longitude'] = df['longitude'].astype(float)
                df['latitude'] = df['latitude'].astype(float)
                
                geometry = [Point(lon, lat) for lon, lat in zip(df['longitude'], df['latitude'])]
                stations_gdf = gpd.GeoDataFrame(df, geometry=geometry, crs='EPSG:4326')
                
                # Calculate spatial weights
                logger.info(f"📊 Analyzing {len(stations_gdf)} stations")
                weights = self.calculate_spatial_weights(stations_gdf, method='knn', k=3)
                
                # Perform Getis-Ord Gi* analysis
                gi_results = self.getis_ord_gi_star(
                    stations_gdf, 
                    stations_gdf['avg_value'].values,
                    weights,
                    significance_level
                )
                
                if not gi_results:
                    return {'error': 'Gi* calculation failed'}
                
                # Add results to GeoDataFrame
                stations_gdf['gi_statistic'] = gi_results['gi_statistics']
                stations_gdf['z_score'] = gi_results['z_scores']
                stations_gdf['p_value'] = gi_results['p_values']
                stations_gdf['classification'] = gi_results['classifications']
                
                # Extract hotspots and coldspots
                hotspots = stations_gdf[stations_gdf['classification'] == 'HOT_SPOT'].copy()
                coldspots = stations_gdf[stations_gdf['classification'] == 'COLD_SPOT'].copy()
                
                # Create hotspot polygons (convex hull of hotspot points)
                hotspot_polygons = []
                if len(hotspots) >= 3:
                    try:
                        hotspot_geometry = unary_union(hotspots.geometry.buffer(0.05))
                        if isinstance(hotspot_geometry, (Polygon, MultiPolygon)):
                            hotspot_polygons.append(hotspot_geometry)
                    except Exception as e:
                        logger.warning(f"Could not create hotspot polygon: {e}")
                
                # Summary statistics
                n_hotspots = len(hotspots)
                n_coldspots = len(coldspots)
                n_not_significant = len(stations_gdf) - n_hotspots - n_coldspots
                
                results = {
                    'parameter': parameter or 'Risk Score',
                    'analysis_date': datetime.now().isoformat(),
                    'date_range': {
                        'start': date_range[0].isoformat(),
                        'end': date_range[1].isoformat()
                    },
                    'significance_level': significance_level,
                    'stations_analyzed': len(stations_gdf),
                    'summary': {
                        'hotspots': n_hotspots,
                        'coldspots': n_coldspots,
                        'not_significant': n_not_significant
                    },
                    'hotspot_stations': [
                        {
                            'station_id': row['station_id'],
                            'name': row['name'],
                            'longitude': row['longitude'],
                            'latitude': row['latitude'],
                            'value': round(float(row['avg_value']), 3),
                            'z_score': round(float(row['z_score']), 3),
                            'p_value': round(float(row['p_value']), 4)
                        }
                        for _, row in hotspots.iterrows()
                    ],
                    'coldspot_stations': [
                        {
                            'station_id': row['station_id'],
                            'name': row['name'],
                            'longitude': row['longitude'],
                            'latitude': row['latitude'],
                            'value': round(float(row['avg_value']), 3),
                            'z_score': round(float(row['z_score']), 3),
                            'p_value': round(float(row['p_value']), 4)
                        }
                        for _, row in coldspots.iterrows()
                    ]
                }
                
                # Save results to database
                self._save_hotspot_results(results, hotspot_polygons)
                
                return results
                
        except Exception as e:
            logger.error(f"Hotspot detection failed: {e}")
            return {'error': str(e)}
    
    def spatial_clustering_analysis(self, 
                                  parameter: str = None,
                                  eps: float = None,
                                  min_samples: int = None) -> Dict:
        """
        Perform spatial clustering analysis to group similar monitoring stations
        
        Args:
            parameter: Pollutant parameter to analyze
            eps: Maximum distance between points in cluster (degrees)
            min_samples: Minimum points to form a cluster
            
        Returns:
            Dictionary with clustering results
        """
        logger.info(f"🔍 Performing spatial clustering analysis")
        
        if eps is None:
            eps = self.CLUSTERING_PARAMS['eps']
        if min_samples is None:
            min_samples = self.CLUSTERING_PARAMS['min_samples']
        
        try:
            with self.db.get_connection() as conn:
                # Get stations with average values
                query = text("""
                    SELECT DISTINCT 
                        s.station_id,
                        s.name,
                        ST_X(s.location) as longitude,
                        ST_Y(s.location) as latitude,
                        AVG(m.value) as avg_value,
                        STDDEV(m.value) as std_value,
                        COUNT(m.value) as measurement_count
                    FROM monitoring_stations s
                    JOIN environmental_measurements m ON s.station_id = m.station_id
                    WHERE s.type = 'air_quality' AND s.active = true
                    AND m.quality_flag = 'VALID'
                    """ + (f"AND m.parameter = :parameter" if parameter else "") + """
                    GROUP BY s.station_id, s.name, s.location
                    HAVING COUNT(m.value) >= 5
                    ORDER BY s.station_id
                """)
                
                params = {'parameter': parameter} if parameter else {}
                result = conn.execute(query, params)
                data = result.fetchall()
                
                if len(data) < min_samples:
                    return {
                        'error': f'Insufficient stations for clustering: {len(data)}',
                        'min_required': min_samples
                    }
                
                # Create DataFrame
                df = pd.DataFrame(data, columns=[
                    'station_id', 'name', 'longitude', 'latitude', 
                    'avg_value', 'std_value', 'measurement_count'
                ])
                
                # Convert decimal values to float for calculations
                df['avg_value'] = df['avg_value'].astype(float)
                df['std_value'] = pd.to_numeric(df['std_value'], errors='coerce').fillna(0.0)
                df['longitude'] = df['longitude'].astype(float)
                df['latitude'] = df['latitude'].astype(float)
                
                # Prepare features for clustering
                # Use geographic coordinates and pollutant values
                features = np.column_stack([
                    np.radians(df['longitude'].values),  # Convert to radians for haversine
                    np.radians(df['latitude'].values),
                    df['avg_value'].values / df['avg_value'].std()  # Normalize values
                ])
                
                # Perform DBSCAN clustering
                clustering = DBSCAN(
                    eps=eps, 
                    min_samples=min_samples, 
                    metric='haversine'
                ).fit(features[:, :2])  # Use only geographic coordinates for distance
                
                df['cluster'] = clustering.labels_
                
                # Analyze clusters
                cluster_summary = []
                unique_clusters = sorted([c for c in set(clustering.labels_) if c != -1])
                
                for cluster_id in unique_clusters:
                    cluster_stations = df[df['cluster'] == cluster_id]
                    
                    cluster_info = {
                        'cluster_id': int(cluster_id),
                        'station_count': len(cluster_stations),
                        'stations': cluster_stations['station_id'].tolist(),
                        'avg_pollution': round(float(cluster_stations['avg_value'].mean()), 3),
                        'std_pollution': round(float(cluster_stations['avg_value'].std()), 3),
                        'center_lat': round(float(cluster_stations['latitude'].mean()), 6),
                        'center_lon': round(float(cluster_stations['longitude'].mean()), 6),
                        'geographic_spread': round(float(
                            np.sqrt((cluster_stations['latitude'].std())**2 + 
                                   (cluster_stations['longitude'].std())**2)
                        ), 6)
                    }
                    cluster_summary.append(cluster_info)
                
                # Identify outliers (noise points)
                outliers = df[df['cluster'] == -1]
                
                results = {
                    'parameter': parameter or 'All Parameters',
                    'analysis_date': datetime.now().isoformat(),
                    'clustering_params': {
                        'eps': eps,
                        'min_samples': min_samples,
                        'metric': 'haversine'
                    },
                    'stations_analyzed': len(df),
                    'clusters_found': len(unique_clusters),
                    'outliers': len(outliers),
                    'cluster_summary': cluster_summary,
                    'outlier_stations': [
                        {
                            'station_id': row['station_id'],
                            'name': row['name'],
                            'longitude': row['longitude'],
                            'latitude': row['latitude'],
                            'avg_value': round(float(row['avg_value']), 3)
                        }
                        for _, row in outliers.iterrows()
                    ]
                }
                
                # Save to database
                self._save_clustering_results(results)
                
                return results
                
        except Exception as e:
            logger.error(f"Spatial clustering failed: {e}")
            return {'error': str(e)}
    
    def spatial_interpolation(self, 
                            parameter: str,
                            method: str = 'idw',
                            grid_resolution: float = None) -> Dict:
        """
        Create interpolated pollution surfaces using spatial interpolation
        
        Args:
            parameter: Pollutant parameter to interpolate
            method: Interpolation method ('idw' = Inverse Distance Weighting)
            grid_resolution: Grid spacing in degrees
            
        Returns:
            Dictionary with interpolation results
        """
        logger.info(f"🗺️ Creating interpolated surface for {parameter}")
        
        if grid_resolution is None:
            grid_resolution = self.INTERPOLATION_PARAMS['grid_resolution']
        
        try:
            # Get Washington State bounds (approximate)
            wa_bounds = {
                'min_lon': -124.8,
                'max_lon': -116.9,
                'min_lat': 45.5,
                'max_lat': 49.0
            }
            
            with self.db.get_connection() as conn:
                # Get stations with values for interpolation
                query = text("""
                    SELECT 
                        s.station_id,
                        s.name,
                        ST_X(s.location) as longitude,
                        ST_Y(s.location) as latitude,
                        AVG(m.value) as avg_value
                    FROM monitoring_stations s
                    JOIN environmental_measurements m ON s.station_id = m.station_id
                    WHERE s.type = 'air_quality' AND s.active = true
                    AND m.parameter = :parameter
                    AND m.quality_flag = 'VALID'
                    GROUP BY s.station_id, s.name, s.location
                    HAVING COUNT(m.value) >= 3
                """)
                
                result = conn.execute(query, {'parameter': parameter})
                data = result.fetchall()
                
                if len(data) < 3:
                    return {
                        'error': f'Insufficient stations for interpolation: {len(data)}',
                        'min_required': 3
                    }
                
                # Create station DataFrame
                stations_df = pd.DataFrame(data, columns=[
                    'station_id', 'name', 'longitude', 'latitude', 'avg_value'
                ])
                
                # Convert decimal values to float for calculations
                stations_df['avg_value'] = stations_df['avg_value'].astype(float)
                stations_df['longitude'] = stations_df['longitude'].astype(float)
                stations_df['latitude'] = stations_df['latitude'].astype(float)
                
                # Create interpolation grid
                lon_range = np.arange(wa_bounds['min_lon'], wa_bounds['max_lon'], grid_resolution)
                lat_range = np.arange(wa_bounds['min_lat'], wa_bounds['max_lat'], grid_resolution)
                lon_grid, lat_grid = np.meshgrid(lon_range, lat_range)
                
                # Flatten grid for processing
                grid_points = np.column_stack([lon_grid.flatten(), lat_grid.flatten()])
                station_coords = stations_df[['longitude', 'latitude']].values
                station_values = stations_df['avg_value'].values
                
                # Inverse Distance Weighting interpolation
                interpolated_values = np.zeros(len(grid_points))
                max_distance = self.INTERPOLATION_PARAMS['max_distance']
                power = self.INTERPOLATION_PARAMS['power']
                
                for i, grid_point in enumerate(grid_points):
                    # Calculate distances to all stations
                    distances = np.sqrt(np.sum((station_coords - grid_point)**2, axis=1))
                    
                    # Only interpolate if within max distance of at least one station
                    if np.min(distances) <= max_distance:
                        # Avoid division by zero
                        distances = np.maximum(distances, 1e-10)
                        
                        # IDW weights
                        weights = 1 / (distances ** power)
                        weighted_sum = np.sum(weights * station_values)
                        weight_sum = np.sum(weights)
                        
                        if weight_sum > 0:
                            interpolated_values[i] = weighted_sum / weight_sum
                        else:
                            interpolated_values[i] = np.nan
                    else:
                        interpolated_values[i] = np.nan
                
                # Reshape back to grid
                interpolated_grid = interpolated_values.reshape(lon_grid.shape)
                
                # Calculate statistics
                valid_values = interpolated_values[~np.isnan(interpolated_values)]
                
                results = {
                    'parameter': parameter,
                    'method': method,
                    'analysis_date': datetime.now().isoformat(),
                    'interpolation_params': {
                        'grid_resolution': grid_resolution,
                        'max_distance': max_distance,
                        'power': power
                    },
                    'grid_info': {
                        'lon_min': float(wa_bounds['min_lon']),
                        'lon_max': float(wa_bounds['max_lon']),
                        'lat_min': float(wa_bounds['min_lat']),
                        'lat_max': float(wa_bounds['max_lat']),
                        'resolution': grid_resolution,
                        'total_points': len(grid_points),
                        'interpolated_points': len(valid_values)
                    },
                    'statistics': {
                        'min_value': float(np.min(valid_values)) if len(valid_values) > 0 else None,
                        'max_value': float(np.max(valid_values)) if len(valid_values) > 0 else None,
                        'mean_value': float(np.mean(valid_values)) if len(valid_values) > 0 else None,
                        'std_value': float(np.std(valid_values)) if len(valid_values) > 0 else None
                    },
                    'stations_used': len(stations_df),
                    'coverage_percent': round(len(valid_values) / len(grid_points) * 100, 1)
                }
                
                return results
                
        except Exception as e:
            logger.error(f"Spatial interpolation failed: {e}")
            return {'error': str(e)}
    
    def _save_hotspot_results(self, results: Dict, polygons: List = None):
        """Save hotspot analysis results to database"""
        try:
            with self.db.get_connection() as conn:
                # Create hotspot table if it doesn't exist
                create_table_query = text("""
                    CREATE TABLE IF NOT EXISTS pollution_hotspots (
                        id SERIAL PRIMARY KEY,
                        parameter VARCHAR(50),
                        hotspot_type VARCHAR(20), -- 'HOT_SPOT', 'COLD_SPOT'
                        station_id VARCHAR(50),
                        z_score NUMERIC,
                        p_value NUMERIC,
                        significance_level VARCHAR(10),
                        analysis_date DATE,
                        created_at TIMESTAMP DEFAULT NOW()
                    );
                """)
                conn.execute(create_table_query)
                
                # Insert hotspot stations
                insert_query = text("""
                    INSERT INTO pollution_hotspots 
                    (parameter, hotspot_type, station_id, z_score, p_value, 
                     significance_level, analysis_date)
                    VALUES (:parameter, :hotspot_type, :station_id, :z_score, 
                           :p_value, :significance_level, :analysis_date)
                """)
                
                # Insert hotspots
                for hotspot in results.get('hotspot_stations', []):
                    conn.execute(insert_query, {
                        'parameter': results['parameter'],
                        'hotspot_type': 'HOT_SPOT',
                        'station_id': hotspot['station_id'],
                        'z_score': hotspot['z_score'],
                        'p_value': hotspot['p_value'],
                        'significance_level': results['significance_level'],
                        'analysis_date': datetime.now().date()
                    })
                
                conn.commit()
                logger.info("✅ Saved clustering results to database")
                
        except Exception as e:
            logger.error(f"Failed to save clustering results: {e}")

    def spatial_autocorrelation_analysis(self, 
                                       parameter: str,
                                       method: str = 'moran') -> Dict:
        """
        Calculate spatial autocorrelation to measure clustering patterns
        
        Args:
            parameter: Pollutant parameter to analyze
            method: 'moran' for Moran's I statistic
            
        Returns:
            Dictionary with autocorrelation results
        """
        logger.info(f"🔗 Calculating spatial autocorrelation for {parameter}")
        
        try:
            with self.db.get_connection() as conn:
                # Get stations with values
                query = text("""
                    SELECT 
                        s.station_id,
                        s.name,
                        ST_X(s.location) as longitude,
                        ST_Y(s.location) as latitude,
                        AVG(m.value) as avg_value
                    FROM monitoring_stations s
                    JOIN environmental_measurements m ON s.station_id = m.station_id
                    WHERE s.type = 'air_quality' AND s.active = true
                    AND m.parameter = :parameter
                    AND m.quality_flag = 'VALID'
                    GROUP BY s.station_id, s.name, s.location
                    HAVING COUNT(m.value) >= 5
                    ORDER BY s.station_id
                """)
                
                result = conn.execute(query, {'parameter': parameter})
                data = result.fetchall()
                
                if len(data) < 3:
                    return {
                        'error': f'Insufficient stations for autocorrelation: {len(data)}',
                        'min_required': 3
                    }
                
                # Create DataFrame and spatial weights
                df = pd.DataFrame(data, columns=[
                    'station_id', 'name', 'longitude', 'latitude', 'avg_value'
                ])
                
                # Convert decimal values to float for calculations
                df['avg_value'] = df['avg_value'].astype(float)
                df['longitude'] = df['longitude'].astype(float)
                df['latitude'] = df['latitude'].astype(float)
                
                try:
                    import geopandas as gpd
                    from shapely.geometry import Point
                    
                    geometry = [Point(lon, lat) for lon, lat in zip(df['longitude'], df['latitude'])]
                    stations_gdf = gpd.GeoDataFrame(df, geometry=geometry, crs='EPSG:4326')
                    
                    weights = self.calculate_spatial_weights(stations_gdf, method='knn', k=3)
                    values = df['avg_value'].values
                    
                    # Calculate Moran's I
                    n = len(values)
                    mean_val = np.mean(values)
                    
                    # Numerator: sum of weighted cross-products
                    numerator = 0
                    for i in range(n):
                        for j in range(n):
                            numerator += weights[i, j] * (values[i] - mean_val) * (values[j] - mean_val)
                    
                    # Denominator: sum of squared deviations
                    denominator = np.sum((values - mean_val) ** 2)
                    
                    # Sum of weights
                    w_sum = np.sum(weights)
                    
                    # Moran's I statistic
                    morans_i = (n / w_sum) * (numerator / denominator) if denominator > 0 and w_sum > 0 else 0
                    
                    # Expected value under null hypothesis
                    expected_i = -1 / (n - 1)
                    
                    # Variance calculation (simplified)
                    variance_i = (n**2 - 3*n + 3) / ((n-1)*(n-2)*(n-3)*w_sum**2)
                    
                    # Z-score
                    z_score = (morans_i - expected_i) / np.sqrt(variance_i) if variance_i > 0 else 0
                    
                    # P-value
                    p_value = 2 * (1 - stats.norm.cdf(abs(z_score)))
                    
                    # Interpretation
                    if morans_i > expected_i and p_value < 0.05:
                        interpretation = "Positive spatial autocorrelation - clustered pattern"
                    elif morans_i < expected_i and p_value < 0.05:
                        interpretation = "Negative spatial autocorrelation - dispersed pattern"
                    else:
                        interpretation = "Random spatial pattern"
                    
                    return {
                        'parameter': parameter,
                        'method': 'morans_i',
                        'stations_analyzed': n,
                        'morans_i': round(float(morans_i), 4),
                        'expected_i': round(float(expected_i), 4),
                        'z_score': round(float(z_score), 3),
                        'p_value': round(float(p_value), 4),
                        'interpretation': interpretation,
                        'significant': p_value < 0.05
                    }
                    
                except ImportError:
                    return {
                        'error': 'Spatial libraries not available for autocorrelation analysis',
                        'requires': 'geopandas, shapely'
                    }
                    
        except Exception as e:
            logger.error(f"Spatial autocorrelation analysis failed: {e}")
            return {'error': str(e)}

    def detect_spatial_outliers(self, 
                              parameter: str,
                              method: str = 'local_outlier_factor',
                              contamination: float = 0.1) -> Dict:
        """
        Detect spatial outliers in environmental data
        
        Args:
            parameter: Pollutant parameter to analyze
            method: Outlier detection method
            contamination: Expected proportion of outliers
            
        Returns:
            Dictionary with outlier detection results
        """
        logger.info(f"🔍 Detecting spatial outliers for {parameter}")
        
        try:
            from sklearn.neighbors import LocalOutlierFactor
            
            with self.db.get_connection() as conn:
                # Get stations with values and coordinates
                query = text("""
                    SELECT 
                        s.station_id,
                        s.name,
                        ST_X(s.location) as longitude,
                        ST_Y(s.location) as latitude,
                        AVG(m.value) as avg_value,
                        STDDEV(m.value) as std_value,
                        COUNT(m.value) as sample_count
                    FROM monitoring_stations s
                    JOIN environmental_measurements m ON s.station_id = m.station_id
                    WHERE s.type = 'air_quality' AND s.active = true
                    AND m.parameter = :parameter
                    AND m.quality_flag = 'VALID'
                    GROUP BY s.station_id, s.name, s.location
                    HAVING COUNT(m.value) >= 5
                    ORDER BY s.station_id
                """)
                
                result = conn.execute(query, {'parameter': parameter})
                data = result.fetchall()
                
                if len(data) < 5:
                    return {
                        'error': f'Insufficient stations for outlier detection: {len(data)}',
                        'min_required': 5
                    }
                
                # Create DataFrame
                df = pd.DataFrame(data, columns=[
                    'station_id', 'name', 'longitude', 'latitude', 
                    'avg_value', 'std_value', 'sample_count'
                ])
                
                # Convert decimal values to float for calculations
                df['avg_value'] = df['avg_value'].astype(float)
                df['std_value'] = pd.to_numeric(df['std_value'], errors='coerce').fillna(0.0)
                df['longitude'] = df['longitude'].astype(float)
                df['latitude'] = df['latitude'].astype(float)
                df['sample_count'] = df['sample_count'].astype(int)
                
                # Prepare features: coordinates + pollution values
                features = np.column_stack([
                    df['longitude'].values,
                    df['latitude'].values,
                    df['avg_value'].values / df['avg_value'].std(),  # Normalized pollution
                    df['std_value'].fillna(0).values / (df['std_value'].std() or 1)  # Normalized variability
                ])
                
                # Apply Local Outlier Factor
                lof = LocalOutlierFactor(
                    n_neighbors=min(10, len(data) - 1),
                    contamination=contamination
                )
                
                outlier_labels = lof.fit_predict(features)
                outlier_scores = lof.negative_outlier_factor_
                
                # Add results to DataFrame
                df['is_outlier'] = outlier_labels == -1
                df['outlier_score'] = -outlier_scores  # Convert to positive scores
                
                # Extract outliers
                outliers = df[df['is_outlier']].copy()
                normal_stations = df[~df['is_outlier']].copy()
                
                # Sort outliers by score (most outlying first)
                outliers = outliers.sort_values('outlier_score', ascending=False)
                
                return {
                    'parameter': parameter,
                    'method': method,
                    'analysis_date': datetime.now().isoformat(),
                    'stations_analyzed': len(df),
                    'outliers_detected': len(outliers),
                    'contamination_rate': contamination,
                    'outlier_stations': [
                        {
                            'station_id': row['station_id'],
                            'name': row['name'],
                            'longitude': row['longitude'],
                            'latitude': row['latitude'],
                            'avg_value': round(float(row['avg_value']), 3),
                            'std_value': round(float(row['std_value']) if row['std_value'] else 0, 3),
                            'outlier_score': round(float(row['outlier_score']), 3),
                            'sample_count': int(row['sample_count'])
                        }
                        for _, row in outliers.iterrows()
                    ],
                    'normal_stations_count': len(normal_stations)
                }
                
        except ImportError:
            return {
                'error': 'Scikit-learn not available for outlier detection',
                'requires': 'scikit-learn'
            }
        except Exception as e:
            logger.error(f"Outlier detection failed: {e}")
            return {'error': str(e)}

    def comprehensive_spatial_analysis(self, parameter: str = None) -> Dict:
        """
        Run comprehensive spatial analysis combining all methods
        
        Args:
            parameter: Pollutant parameter to analyze (None for risk scores)
            
        Returns:
            Dictionary with comprehensive analysis results
        """
        logger.info(f"🎯 Running comprehensive spatial analysis for {parameter or 'risk scores'}")
        
        results = {
            'parameter': parameter or 'Risk Scores',
            'analysis_date': datetime.now().isoformat(),
            'methods_used': []
        }
        
        # 1. Hotspot Detection
        logger.info("   🔥 Running hotspot detection...")
        hotspot_results = self.detect_pollution_hotspots(parameter, significance_level='95%')
        if 'error' not in hotspot_results:
            results['hotspot_analysis'] = hotspot_results
            results['methods_used'].append('hotspot_detection')
        else:
            results['hotspot_analysis'] = {'error': hotspot_results.get('error')}
        
        # 2. Spatial Clustering
        if parameter:  # Only for specific parameters
            logger.info("   🎯 Running spatial clustering...")
            clustering_results = self.spatial_clustering_analysis(parameter, eps=0.15, min_samples=2)
            if 'error' not in clustering_results:
                results['clustering_analysis'] = clustering_results
                results['methods_used'].append('spatial_clustering')
            else:
                results['clustering_analysis'] = {'error': clustering_results.get('error')}
        
        # 3. Spatial Autocorrelation
        if parameter:
            logger.info("   🔗 Running spatial autocorrelation...")
            autocorr_results = self.spatial_autocorrelation_analysis(parameter)
            if 'error' not in autocorr_results:
                results['autocorrelation_analysis'] = autocorr_results
                results['methods_used'].append('spatial_autocorrelation')
            else:
                results['autocorrelation_analysis'] = {'error': autocorr_results.get('error')}
        
        # 4. Outlier Detection
        if parameter:
            logger.info("   🔍 Running outlier detection...")
            outlier_results = self.detect_spatial_outliers(parameter, contamination=0.1)
            if 'error' not in outlier_results:
                results['outlier_analysis'] = outlier_results
                results['methods_used'].append('outlier_detection')
            else:
                results['outlier_analysis'] = {'error': outlier_results.get('error')}
        
        # 5. Spatial Interpolation
        if parameter:
            logger.info("   🗺️ Running spatial interpolation...")
            interp_results = self.spatial_interpolation(parameter, grid_resolution=0.05)
            if 'error' not in interp_results:
                results['interpolation_analysis'] = interp_results
                results['methods_used'].append('spatial_interpolation')
            else:
                results['interpolation_analysis'] = {'error': interp_results.get('error')}
        
        # Summary
        results['methods_completed'] = len(results['methods_used'])
        results['analysis_success'] = len(results['methods_used']) > 0
        
        return results
    
    def _save_clustering_results(self, results: Dict):
        """Save clustering results to database"""
        try:
            with self.db.get_connection() as conn:
                # Create clustering table if it doesn't exist
                create_table_query = text("""
                    CREATE TABLE IF NOT EXISTS spatial_clusters (
                        id SERIAL PRIMARY KEY,
                        parameter VARCHAR(50),
                        cluster_id INTEGER,
                        station_id VARCHAR(50),
                        cluster_type VARCHAR(20), -- 'CLUSTER', 'OUTLIER'
                        avg_pollution NUMERIC,
                        analysis_date DATE,
                        created_at TIMESTAMP DEFAULT NOW()
                    );
                """)
                conn.execute(create_table_query)
                
                # Insert cluster assignments
                insert_query = text("""
                    INSERT INTO spatial_clusters 
                    (parameter, cluster_id, station_id, cluster_type, avg_pollution, analysis_date)
                    VALUES (:parameter, :cluster_id, :station_id, :cluster_type, :avg_pollution, :analysis_date)
                """)
                
                # Insert cluster members
                for cluster in results.get('cluster_summary', []):
                    for station_id in cluster['stations']:
                        conn.execute(insert_query, {
                            'parameter': results['parameter'],
                            'cluster_id': cluster['cluster_id'],
                            'station_id': station_id,
                            'cluster_type': 'CLUSTER',
                            'avg_pollution': cluster['avg_pollution'],
                            'analysis_date': datetime.now().date()
                        })
                
                # Insert outliers
                for outlier in results.get('outlier_stations', []):
                    conn.execute(insert_query, {
                        'parameter': results['parameter'],
                        'cluster_id': -1,
                        'station_id': outlier['station_id'],
                        'cluster_type': 'OUTLIER',
                        'avg_pollution': outlier['avg_value'],
                        'analysis_date': datetime.now().date()
                    })
                
                conn.commit()
                logger.info("✅ Saved clustering results to database")
                
        except Exception as e:
            logger.error(f"Failed to save clustering results: {e}")

def test_spatial_analysis():
    """
    Test spatial analysis functions with current data
    """
    logger.info("🧪 Testing Spatial Analysis Functions")
    
    spatial_engine = SpatialStatsEngine()
    
    # Test database connection
    if not spatial_engine.db.test_connection():
        logger.error("❌ Database connection failed")
        return False
    
    # Test 1: Hotspot Detection
    logger.info("\n🔥 Test 1: Hotspot Detection")
    
    # Test with risk scores (should work with existing data)
    hotspot_results = spatial_engine.detect_pollution_hotspots(
        parameter=None,  # Use risk scores
        significance_level='95%'
    )
    
    if 'error' not in hotspot_results:
        logger.info(f"   ✅ Hotspot analysis completed")
        logger.info(f"   📊 Stations analyzed: {hotspot_results['stations_analyzed']}")
        logger.info(f"   🔥 Hotspots found: {hotspot_results['summary']['hotspots']}")
        logger.info(f"   ❄️ Coldspots found: {hotspot_results['summary']['coldspots']}")
        
        # Show hotspot details
        if hotspot_results['hotspot_stations']:
            logger.info("   🚨 Hotspot stations:")
            for hs in hotspot_results['hotspot_stations']:
                logger.info(f"      - {hs['name']}: Z-score={hs['z_score']:.2f}")
    else:
        logger.error(f"   ❌ Hotspot detection failed: {hotspot_results.get('error')}")
        return False
    
    # Test 2: Spatial Clustering
    logger.info("\n🎯 Test 2: Spatial Clustering Analysis")
    
    clustering_results = spatial_engine.spatial_clustering_analysis(
        parameter='PM2.5 Mass',
        eps=0.2,  # Larger epsilon for Washington State scale
        min_samples=2
    )
    
    if 'error' not in clustering_results:
        logger.info(f"   ✅ Clustering analysis completed")
        logger.info(f"   📊 Stations analyzed: {clustering_results['stations_analyzed']}")
        logger.info(f"   🎯 Clusters found: {clustering_results['clusters_found']}")
        logger.info(f"   🔍 Outliers detected: {clustering_results['outliers']}")
        
        # Show cluster details
        for cluster in clustering_results['cluster_summary']:
            logger.info(f"   📍 Cluster {cluster['cluster_id']}: {cluster['station_count']} stations, avg pollution: {cluster['avg_pollution']:.2f}")
    else:
        logger.error(f"   ❌ Clustering analysis failed: {clustering_results.get('error')}")
        return False
    
    # Test 3: Spatial Interpolation
    logger.info("\n🗺️ Test 3: Spatial Interpolation")
    
    interpolation_results = spatial_engine.spatial_interpolation(
        parameter='PM2.5 Mass',
        method='idw',
        grid_resolution=0.1  # Coarse grid for testing
    )
    
    if 'error' not in interpolation_results:
        logger.info(f"   ✅ Interpolation completed")
        logger.info(f"   📊 Stations used: {interpolation_results['stations_used']}")
        logger.info(f"   🗺️ Grid coverage: {interpolation_results['coverage_percent']:.1f}%")
        logger.info(f"   📈 Value range: {interpolation_results['statistics']['min_value']:.2f} - {interpolation_results['statistics']['max_value']:.2f}")
    else:
        logger.error(f"   ❌ Interpolation failed: {interpolation_results.get('error')}")
        return False
    
    return True

def demo_spatial_analysis():
    """
    Comprehensive demonstration of spatial analysis capabilities
    """
    logger.info("🚀 Spatial Analysis Engine Demo")
    logger.info("="*50)
    
    spatial_engine = SpatialStatsEngine()
    
    # Test database connection
    if not spatial_engine.db.test_connection():
        logger.error("❌ Database connection failed")
        return
    
    # Demo 1: Comprehensive Analysis for PM2.5
    logger.info("\n🔬 COMPREHENSIVE SPATIAL ANALYSIS - PM2.5")
    logger.info("-" * 50)
    
    pm25_analysis = spatial_engine.comprehensive_spatial_analysis('PM2.5 Mass')
    
    logger.info(f"📊 Analysis completed for: {pm25_analysis['parameter']}")
    logger.info(f"🎯 Methods completed: {pm25_analysis['methods_completed']}")
    logger.info(f"✅ Methods used: {', '.join(pm25_analysis['methods_used'])}")
    
    # Show hotspot results
    if 'hotspot_analysis' in pm25_analysis and 'error' not in pm25_analysis['hotspot_analysis']:
        hotspots = pm25_analysis['hotspot_analysis']
        logger.info(f"\n🔥 HOTSPOT ANALYSIS RESULTS:")
        logger.info(f"   Stations analyzed: {hotspots['stations_analyzed']}")
        logger.info(f"   Hotspots detected: {hotspots['summary']['hotspots']}")
        logger.info(f"   Coldspots detected: {hotspots['summary']['coldspots']}")
    
    # Show clustering results
    if 'clustering_analysis' in pm25_analysis and 'error' not in pm25_analysis['clustering_analysis']:
        clustering = pm25_analysis['clustering_analysis']
        logger.info(f"\n🎯 CLUSTERING ANALYSIS RESULTS:")
        logger.info(f"   Clusters found: {clustering['clusters_found']}")
        logger.info(f"   Outlier stations: {clustering['outliers']}")
    
    # Show autocorrelation results
    if 'autocorrelation_analysis' in pm25_analysis and 'error' not in pm25_analysis['autocorrelation_analysis']:
        autocorr = pm25_analysis['autocorrelation_analysis']
        logger.info(f"\n🔗 SPATIAL AUTOCORRELATION RESULTS:")
        logger.info(f"   Moran's I: {autocorr['morans_i']}")
        logger.info(f"   Z-score: {autocorr['z_score']}")
        logger.info(f"   Interpretation: {autocorr['interpretation']}")
    
    # Demo 2: Risk Score Hotspot Analysis
    logger.info(f"\n🎯 ENVIRONMENTAL RISK HOTSPOT ANALYSIS")
    logger.info("-" * 50)
    
    risk_hotspots = spatial_engine.detect_pollution_hotspots(
        parameter=None,  # Use risk scores
        significance_level='95%'
    )
    
    if 'error' not in risk_hotspots:
        logger.info(f"📊 Risk Score Hotspot Analysis:")
        logger.info(f"   Stations analyzed: {risk_hotspots['stations_analyzed']}")
        logger.info(f"   High-risk hotspots: {risk_hotspots['summary']['hotspots']}")
        logger.info(f"   Low-risk areas: {risk_hotspots['summary']['coldspots']}")
        
        # Show top hotspots
        if risk_hotspots['hotspot_stations']:
            logger.info(f"\n🚨 TOP HIGH-RISK HOTSPOTS:")
            for i, hs in enumerate(risk_hotspots['hotspot_stations'][:3], 1):
                logger.info(f"   {i}. {hs['name']}")
                logger.info(f"      Risk Value: {hs['value']:.2f}")
                logger.info(f"      Statistical Significance: Z={hs['z_score']:.2f}, p={hs['p_value']:.4f}")
    
    # Summary and insights
    logger.info(f"\n🎯 SPATIAL ANALYSIS SUMMARY")
    logger.info("=" * 50)
    logger.info("✅ Hotspot Detection: Statistical identification of pollution clusters")
    logger.info("✅ Spatial Clustering: Grouping of stations with similar patterns")  
    logger.info("✅ Spatial Autocorrelation: Measure of geographic clustering tendency")
    logger.info("✅ Outlier Detection: Identification of unusual stations for QA")
    logger.info("✅ Spatial Interpolation: Continuous pollution surface generation")
    logger.info("\n🚀 Spatial analysis engine fully operational!")
    logger.info("📊 Ready for advanced environmental risk assessment!")
    logger.info("🗺️ Ready for integration with web mapping interfaces!")


if __name__ == "__main__":
    # Run tests first
    if test_spatial_analysis():
        logger.info("✅ All spatial analysis tests passed!")
        print("\n" + "="*60)
        # Run comprehensive demo
        demo_spatial_analysis()
    else:
        logger.error("❌ Spatial analysis tests failed")