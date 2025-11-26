import { LatLon, PVStationData, ViewMode, CameraPosition } from './types';

export const EARTH_RADIUS = 50;

// Hobq Desert Center: approx 40.2°N, 108.5°E
export const HOBQ_CENTER: LatLon = { lat: 40.2, lon: 108.5 };

export const CAMERA_POSITIONS: Record<ViewMode, CameraPosition> = {
  [ViewMode.GLOBAL]: { position: [0, 40, 150], target: [0, 0, 0], fov: 45 },
  [ViewMode.CHINA]: { position: [-40, 50, 60], target: [-30, 40, 0], fov: 35 },
  // Focused view on Hobq
  [ViewMode.HOBQ]: { position: [-35, 55, 10], target: [-42, 45, 0], fov: 20 },
  [ViewMode.PV_FOCUS]: { position: [-38, 52, 5], target: [-42, 45, 0], fov: 15 },
};

// Generate Mock PV Stations along the desert belt
export const MOCK_PV_STATIONS: PVStationData[] = Array.from({ length: 50 }).map((_, i) => ({
  id: `pv-${i}`,
  lat: 40.0 + (Math.random() - 0.5) * 0.8,
  lon: 107.5 + (Math.random() - 0.5) * 2.5,
  area: 0.5 + Math.random() * 5,
  type: Math.random() > 0.8 ? 'Large' : Math.random() > 0.5 ? 'Medium' : 'Small'
}));

export const COLORS = {
  atmosphere: '#193c78',
  pvPanel: '#0066cc',
  pvFrame: '#888888',
  glow: '#44aaff',
  // Matching the PDF color ramp: Green (Low) -> Yellow -> Red (High)
  aodGradient: ['#4d9221', '#a1d99b', '#f7f7f7', '#fde0ef', '#c51b7d'] 
};

// High-Res Earth Textures (Reliable Sources)
export const TEXTURES = {
  color: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
  normal: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg',
  specular: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg',
  clouds: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png'
};