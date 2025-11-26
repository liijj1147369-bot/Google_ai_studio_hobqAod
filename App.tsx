/// <reference types="@react-three/fiber" />
import React, { useState, Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { Leva, useControls, button } from 'leva';
import Earth from './components/Earth';
import HandController from './components/HandController';
import { ViewMode, HandGestureState } from './types';
import { CAMERA_POSITIONS } from './constants';
import * as THREE from 'three';

// Simple Error Boundary Component
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: string}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: error.toString() };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 text-red-500 font-mono p-10 z-[100]">
          <div>
            <h1 className="text-xl font-bold mb-4">Rendering Error</h1>
            <pre className="bg-black p-4 rounded text-xs whitespace-pre-wrap">{this.state.error}</pre>
            <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500" onClick={() => window.location.reload()}>
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  // Gesture State
  const [gestureState, setGestureState] = useState<HandGestureState>({
    isPalmOpen: false,
    isFist: false,
    isPinching: false,
    pinchDistance: 0,
    handPosition: { x: 0.5, y: 0.5 }
  });

  // UI Controls (Leva)
  const [controls, setControls] = useControls(() => ({
    viewMode: {
      options: Object.values(ViewMode),
      value: ViewMode.CHINA, // Default to China view
      label: 'Region Focus'
    },
    activeLayer: {
      options: ['Mean', 'Slope'],
      value: 'Mean',
      label: 'AOD Data Layer'
    },
    'Visual Settings': {
      value: '',
      editable: false
    },
    autoRotate: { value: true, label: 'Auto Rotate' },
    demStrength: { value: 1.5, min: 0, max: 5, label: 'Terrain Exaggeration' },
    pvScale: { value: 0.1, min: 0, max: 1, label: 'PV Height' },
    particlesEnabled: { value: true, label: 'Show AOD Overlay' },
    'Colors': {
      value: '',
      editable: false
    },
    highlightColor: { value: '#00ffcc', label: 'Highlight' },
    pvColor: { value: '#0066cc', label: 'PV Panels' },
    'Data Upload': {
      value: '',
      editable: false
    },
    'Upload AOD Mean': button(() => document.getElementById('file-aod-mean')?.click()),
    'Upload GeoJSON': button(() => document.getElementById('file-geojson')?.click()),
  }));

  const controlsRef = useRef<any>(null);
  const controlsValuesRef = useRef(controls);
  controlsValuesRef.current = controls;

  // Gesture Logic
  useEffect(() => {
    const currentControls = controlsValuesRef.current;
    
    // 1. Rotation Control
    if (gestureState.isPalmOpen) {
       if (!currentControls.autoRotate) {
           setControls({ autoRotate: true });
       }
    } else if (gestureState.isFist) {
       if (currentControls.autoRotate) {
           setControls({ autoRotate: false });
       }
    }

    // 2. Pinch to Scale PV
    if (gestureState.isPinching) {
        const newScale = Math.min(1, Math.max(0, currentControls.pvScale + 0.02));
        if (Math.abs(newScale - currentControls.pvScale) > 0.01) {
          setControls({ pvScale: newScale });
        }
    }
  }, [gestureState, setControls]);

  // Camera Transition Logic
  useEffect(() => {
    const targetConfig = CAMERA_POSITIONS[controls.viewMode as ViewMode];
    if (controlsRef.current && controlsRef.current.object && targetConfig) {
        controlsRef.current.object.position.set(...targetConfig.position);
        controlsRef.current.target.set(...targetConfig.target);
        controlsRef.current.update();
    }
  }, [controls.viewMode]);

  const handleFileUpload = (type: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      alert(`Loaded ${file.name}. The visualizer is currently using the demo 'Mean20' style. In a production build, this would replace the overlay texture.`);
    }
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <input type="file" id="file-aod-mean" className="hidden" accept="image/*" onChange={handleFileUpload('AOD')} />
      <input type="file" id="file-geojson" className="hidden" accept=".json,.geojson" onChange={handleFileUpload('GEO')} />

      <Canvas 
        shadows 
        dpr={[1, 2]} 
        gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }} 
        camera={{ position: [0, 40, 150], fov: 45 }}
        onCreated={({ gl }) => { gl.setClearColor(new THREE.Color('#000000')) }}
      >
        <ambientLight intensity={0.4} />
        {/* Sun Light */}
        <directionalLight position={[100, 20, 50]} intensity={3} castShadow />
        {/* Backlight for atmosphere */}
        <spotLight position={[-50, 50, -50]} intensity={1} color="#4444ff" />

        <Suspense fallback={<Html center><div className="text-white font-mono text-lg animate-pulse">Loading High-Res Earth...</div></Html>}>
          <Earth 
            viewMode={controls.viewMode as ViewMode}
            autoRotate={controls.autoRotate}
            highlightColor={controls.highlightColor}
            demStrength={controls.demStrength}
            pvScale={controls.pvScale}
            pvColor={controls.pvColor}
            particlesEnabled={controls.particlesEnabled}
            activeLayer={controls.activeLayer as 'Mean' | 'Slope'}
          />
        </Suspense>

        <OrbitControls 
          ref={controlsRef}
          enablePan={false} 
          enableZoom={true} 
          minDistance={15} 
          maxDistance={300}
          autoRotate={controls.autoRotate && controls.viewMode === ViewMode.GLOBAL}
          autoRotateSpeed={0.5}
          makeDefault
        />
      </Canvas>

      {/* Hand Tracking Overlay - Bottom Right */}
      <HandController onGestureUpdate={setGestureState} />

      {/* Status UI - Top Left */}
      <div className="absolute top-4 left-4 z-40 p-4 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white font-mono text-sm pointer-events-none select-none">
        <h3 className="text-blue-400 font-bold mb-2 uppercase tracking-widest text-xs">Gesture Control</h3>
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex justify-between w-40">
            <span>Palm (Rotate):</span>
            <span className={gestureState.isPalmOpen ? "text-green-400 font-bold" : "text-gray-500"}>{gestureState.isPalmOpen ? "ACTIVE" : "OFF"}</span>
          </div>
          <div className="flex justify-between w-40">
            <span>Fist (Stop):</span>
            <span className={gestureState.isFist ? "text-red-400 font-bold" : "text-gray-500"}>{gestureState.isFist ? "ACTIVE" : "OFF"}</span>
          </div>
          <div className="flex justify-between w-40">
            <span>Pinch (Extrude):</span>
            <span className={gestureState.isPinching ? "text-yellow-400 font-bold" : "text-gray-500"}>{gestureState.isPinching ? "ACTIVE" : "OFF"}</span>
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-50">
         <Leva fill flat />
      </div>
      
      {/* Upload Instructions - Bottom Left */}
      <div className="absolute bottom-4 left-4 z-40 text-left text-gray-500 text-[10px] pointer-events-none">
        <p>AOD Mean/Slope Data: Visualized on Hobq (40°N, 108°E)</p>
        <p>Terrain: 4x Exaggerated DEM</p>
      </div>
    </div>
  );
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;