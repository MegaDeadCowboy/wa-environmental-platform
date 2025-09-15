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
        # Check for production DATABASE_URL first, then fall back to local
        database_url = os.getenv('DATABASE_URL')
        
        if database_url:
            # Production database (Render)
            # Fix postgres:// to postgresql:// if needed
            if database_url.startswith("postgres://"):
                database_url = database_url.replace("postgres://", "postgresql://", 1)
            self.db_url = database_url
        else:
            # Local development database
            self.db_url = 'postgresql:///wa_environmental_platform'
            
        self.engine = create_engine(self.db_url)
        self.Session = sessionmaker(bind=self.engine)
    
    def get_connection(self):
        """Get database connection"""
        return self.engine.connect()
    
    def get_session(self):
        """Get database session"""
        return self.Session()
    
    def execute_query(self, query, params=None):
        """Execute a query and return results"""
        with self.get_connection() as conn:
            if params:
                result = conn.execute(text(query), params)
            else:
                result = conn.execute(text(query))
            return result.fetchall()
    
    def test_connection(self):
        """Test database connection"""
        try:
            with self.get_connection() as conn:
                result = conn.execute(text("SELECT 1"))
                return result.fetchone()[0] == 1
        except Exception as e:
            print(f"Database connection failed: {e}")
            return False