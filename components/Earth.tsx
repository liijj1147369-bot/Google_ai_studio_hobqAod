/// <reference types="@react-three/fiber" />
import React, { useRef, useMemo, Suspense, useEffect, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, Vector3, DoubleSide, AdditiveBlending, CanvasTexture, Color } from 'three';
import * as THREE from 'three';
import { Sphere, Stars } from '@react-three/drei';
import SolarPanels from './SolarPanels';
import { EARTH_RADIUS, HOBQ_CENTER, TEXTURES } from '../constants';
import { ViewMode } from '../types';

interface EarthProps {
  viewMode: ViewMode;
  autoRotate: boolean;
  highlightColor: string;
  demStrength: number;
  pvScale: number;
  pvColor: string;
  particlesEnabled: boolean;
  activeLayer: 'Mean' | 'Slope';
}

// 1. Realistic Earth Surface with DEM
const RealisticSurface: React.FC<{ demStrength: number }> = ({ demStrength }) => {
  const [colorMap, normalMap, specularMap] = useLoader(TextureLoader, [
    TEXTURES.color,
    TEXTURES.normal,
    TEXTURES.specular
  ]);

  return (
    <meshStandardMaterial 
        map={colorMap} 
        normalMap={normalMap}
        normalScale={new THREE.Vector2(1, 1)}
        roughnessMap={specularMap}
        roughness={0.8}
        metalness={0.1}
        displacementMap={normalMap} // Using topology as height map
        displacementScale={demStrength * 2} // Exaggerate terrain
    />
  );
};

// 2. Clouds Layer
const Clouds: React.FC = () => {
    const cloudMap = useLoader(TextureLoader, TEXTURES.clouds);
    const meshRef = useRef<THREE.Mesh>(null);
    
    useFrame(() => {
        if(meshRef.current) meshRef.current.rotation.y += 0.0001;
    });

    return (
        <mesh ref={meshRef}>
            <sphereGeometry args={[EARTH_RADIUS + 0.2, 64, 64]} />
            <meshStandardMaterial 
                map={cloudMap} 
                transparent 
                opacity={0.8} 
                blending={AdditiveBlending} 
                side={DoubleSide}
                depthWrite={false}
            />
        </mesh>
    )
}

// 3. Procedural AOD Data Overlay (Simulating the User's Map)
const HobqDataOverlay: React.FC<{ activeLayer: 'Mean' | 'Slope', opacity: number }> = ({ activeLayer, opacity }) => {
    const texture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Create a gradient that matches the PDF screenshots
            // Mean: Green -> Yellow -> Red
            // Slope: Diverging Green -> Grey -> Red
            const grad = ctx.createLinearGradient(0, 0, 512, 0);
            
            if (activeLayer === 'Mean') {
                grad.addColorStop(0, '#558b2f'); // Dark Green (Low AOD)
                grad.addColorStop(0.3, '#d4e157'); // Light Green
                grad.addColorStop(0.6, '#ffee58'); // Yellow
                grad.addColorStop(0.8, '#ff7043'); // Orange
                grad.addColorStop(1, '#8d6e63'); // Brown/Red (High AOD)
            } else {
                // Slope Trend
                grad.addColorStop(0, '#1b5e20'); // Significant Decrease
                grad.addColorStop(0.4, '#a5d6a7'); // Slight Decrease
                grad.addColorStop(0.5, '#eeeeee'); // No Change
                grad.addColorStop(0.6, '#ffccbc'); // Slight Increase
                grad.addColorStop(1, '#b71c1c'); // Significant Increase
            }

            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 512, 256);

            // Add some "noise" to simulate the irregular desert shape
            ctx.globalCompositeOperation = 'destination-in';
            const noise = ctx.createRadialGradient(256, 128, 20, 256, 128, 200);
            noise.addColorStop(0, 'rgba(0,0,0,1)');
            noise.addColorStop(0.8, 'rgba(0,0,0,0.8)');
            noise.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = noise;
            ctx.fillRect(0,0, 512, 256);
        }
        return new CanvasTexture(canvas);
    }, [activeLayer]);

    // Position this overlay exactly over Hobq (40.2N, 108.5E)
    const position = useMemo(() => {
        const phi = (90 - HOBQ_CENTER.lat) * (Math.PI / 180);
        const theta = (HOBQ_CENTER.lon + 180) * (Math.PI / 180);
        const r = EARTH_RADIUS + 0.3; // Slightly above terrain
        return new Vector3(
            -(r * Math.sin(phi) * Math.cos(theta)),
            (r * Math.cos(phi)),
            (r * Math.sin(phi) * Math.sin(theta))
        );
    }, []);

    // Rotate to align with the surface
    const quaternion = useMemo(() => {
        const up = new Vector3(0, 1, 0);
        const target = position.clone().normalize();
        return new THREE.Quaternion().setFromUnitVectors(up, target);
    }, [position]);

    return (
        <mesh position={position} quaternion={quaternion}>
            {/* A curved plane segment representing the region */}
            <planeGeometry args={[6, 3, 64, 64]} /> 
            <meshStandardMaterial 
                map={texture} 
                transparent 
                opacity={opacity} 
                side={DoubleSide}
                displacementMap={texture} // Use the data color intensity as height too!
                displacementScale={1.5}
                emissiveMap={texture}
                emissiveIntensity={0.5}
                emissive={new Color(0xffffff)}
            />
        </mesh>
    );
};

const Earth: React.FC<EarthProps> = ({ 
  viewMode, autoRotate, highlightColor, demStrength, pvScale, pvColor, particlesEnabled, activeLayer
}) => {
  const earthRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (earthRef.current && autoRotate && viewMode === ViewMode.GLOBAL) {
      earthRef.current.rotation.y += 0.0005;
    }
  });

  return (
    <group ref={groupRef}>
      {/* 1. Base Earth with DEM */}
      <Sphere ref={earthRef} args={[EARTH_RADIUS, 128, 128]} rotation={[0, -Math.PI / 2, 0]}>
        <Suspense fallback={<meshStandardMaterial color="#1e3a8a" />}>
            <RealisticSurface demStrength={demStrength} />
        </Suspense>
      </Sphere>

      {/* 2. Clouds Layer */}
      <Suspense fallback={null}>
         <Clouds />
      </Suspense>

      {/* 3. Atmosphere Glow */}
      <Sphere args={[EARTH_RADIUS + 2, 64, 64]}>
         <meshPhongMaterial
            color={0x4488ff}
            transparent
            opacity={0.1}
            side={DoubleSide}
            blending={AdditiveBlending}
            depthWrite={false}
         />
      </Sphere>

      <Stars radius={300} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      {/* 4. AOD Data Visualization Overlay */}
      <HobqDataOverlay activeLayer={activeLayer} opacity={particlesEnabled ? 0.9 : 0} />

      {/* 5. PV Stations */}
      <SolarPanels scaleMultiplier={pvScale} color={pvColor} />
    </group>
  );
};

export default Earth;