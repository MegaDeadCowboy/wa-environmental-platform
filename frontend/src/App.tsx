// src/App.tsx
import React, { useState } from 'react';
import AirQualityDashboard from './components/airquality/AirQualityDashboard';
import WaterQualityDashboard from './components/waterquality/WaterQualityDashboard';
import './App.css';

type DashboardType = 'air-quality' | 'water-quality';

function App() {
  const [currentDashboard, setCurrentDashboard] = useState<DashboardType>('air-quality');

  return (
    <div style={{ height: '100vh' }}>
      {/* Simple navigation bar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1001,
        background: '#1f2937',
        padding: '0.5rem 1rem',
        display: 'flex',
        gap: '1rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <button
          onClick={() => setCurrentDashboard('air-quality')}
          style={{
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '4px',
            background: currentDashboard === 'air-quality' ? '#3b82f6' : '#374151',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}
        >
          Air Quality
        </button>
        <button
          onClick={() => setCurrentDashboard('water-quality')}
          style={{
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '4px',
            background: currentDashboard === 'water-quality' ? '#3b82f6' : '#374151',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}
        >
          Water Quality
        </button>
      </div>

      {/* Dashboard content */}
      <div style={{ paddingTop: '3rem', height: '100%' }}>
        {currentDashboard === 'air-quality' && <AirQualityDashboard />}
        {currentDashboard === 'water-quality' && <WaterQualityDashboard />}
      </div>
    </div>
  );
}

export default App;