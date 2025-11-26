/// <reference types="@react-three/fiber" />
import React, { useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { MOCK_PV_STATIONS, EARTH_RADIUS } from '../constants';

interface SolarPanelsProps {
  scaleMultiplier: number;
  color: string;
}

const SolarPanels: React.FC<SolarPanelsProps> = ({ scaleMultiplier, color }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = new THREE.Object3D();

  useLayoutEffect(() => {
    if (!meshRef.current) return;

    MOCK_PV_STATIONS.forEach((station, i) => {
      // Convert Lat/Lon to Vector3
      const phi = (90 - station.lat) * (Math.PI / 180);
      const theta = (station.lon + 180) * (Math.PI / 180);

      const r = EARTH_RADIUS + 0.05; // Slightly above ground
      
      dummy.position.x = -(r * Math.sin(phi) * Math.cos(theta));
      dummy.position.z = (r * Math.sin(phi) * Math.sin(theta));
      dummy.position.y = (r * Math.cos(phi));

      dummy.lookAt(0, 0, 0); // Face center
      
      // Orient correctly on surface (tangent)
      const up = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(up, dummy.position.clone().normalize());
      dummy.quaternion.copy(quaternion);
      
      // Scale based on station size
      const size = station.type === 'Large' ? 0.3 : station.type === 'Medium' ? 0.2 : 0.1;
      dummy.scale.set(size, size, size);

      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame(() => {
     if (meshRef.current) {
        // Dynamic scaling based on gesture
        const currentScale = meshRef.current.scale;
        const targetScale = 1 + scaleMultiplier * 2;
        currentScale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
     }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MOCK_PV_STATIONS.length]}>
      <boxGeometry args={[1, 0.1, 1]} />
      <meshStandardMaterial 
        color={color} 
        roughness={0.2} 
        metalness={0.8}
        emissive={color}
        emissiveIntensity={0.2}
      />
    </instancedMesh>
  );
};

export default SolarPanels;