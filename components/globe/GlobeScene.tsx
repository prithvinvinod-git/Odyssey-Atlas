"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { useStore } from "@/lib/store";

function Globe() {
  const { selectedSiteIds, sites } = useStore();
  const selectedSites = sites.filter((s) => selectedSiteIds.includes(s.id));

  return (
    <group>
      <Stars radius={100} />
      <Stars radius={100} />
      <ambientLight intensity={0.1} />
      <directionalLight
        position={[100, 100, 50]}
        intensity={2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <mesh>
        <sphereGeometry args={[10, 64, 64]} />
        <meshStandardMaterial
          color="#888888"
          roughness={0.9}
          metalness={0.05}
        />
      </mesh>
      {selectedSites.map((site) => (
        <mesh key={site.id} position={[
          10.1 * Math.cos(site.lat * Math.PI / 180) * Math.cos(site.lon * Math.PI / 180),
          10.1 * Math.sin(site.lat * Math.PI / 180),
          10.1 * Math.cos(site.lat * Math.PI / 180) * Math.sin(site.lon * Math.PI / 180),
        ]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshBasicMaterial color={site.color} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export function GlobeScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 30], fov: 40 }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
      className="h-full w-full"
    >
      <Globe />
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={15}
        maxDistance={100}
        dampingFactor={0.05}
      />
    </Canvas>
  );
}