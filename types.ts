import { Vector3 } from 'three';

export interface LatLon {
  lat: number;
  lon: number;
}

export interface CameraPosition {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export enum ViewMode {
  GLOBAL = 'Global',
  CHINA = 'China',
  HOBQ = 'Hobq Desert',
  PV_FOCUS = 'PV Stations'
}

export interface PVStationData {
  id: string;
  lat: number;
  lon: number;
  area: number; // km2
  type: 'Small' | 'Medium' | 'Large';
}

export interface HandGestureState {
  isPalmOpen: boolean;
  isFist: boolean;
  isPinching: boolean;
  pinchDistance: number;
  handPosition: { x: number; y: number }; // Normalized 0-1
}

export interface AppState {
  viewMode: ViewMode;
  demStrength: number;
  aodOpacity: number;
  pvScale: number;
  autoRotate: boolean;
  highlightColor: string;
  particlesEnabled: boolean;
}