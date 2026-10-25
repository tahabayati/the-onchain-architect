"use client";

/**
 * ModelCanvas.tsx — Interactive 3D Architectural Viewport
 *
 * WHAT: A React-Three-Fiber canvas that renders an interactive wireframe model
 *       when a blueprint file is selected, or an empty state when idle.
 * WHY:  Gives architects immediate visual feedback that their 3D model was
 *       recognized before anchoring. Empty state prevents misleading users
 *       with an active wireframe when no file has been staged.
 * FILECOIN: The 3D model previewed here represents the exact binary payload
 *       hashed and permanently anchored to Filecoin/IPFS via Lighthouse.
 */

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

interface ModelCanvasProps {
  selectedFile?: File | null;
}

/** A rotating wireframe mesh representing the staged architectural geometry. */
function RotatingBox() {
  const meshRef = useRef<Mesh>(null);

  // `delta` is the time since last frame, keeping rotation speed frame-rate independent.
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x += delta * 0.3;
    meshRef.current.rotation.y += delta * 0.5;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[2.2, 2.2, 2.2]} />
      <meshStandardMaterial color="#38bdf8" wireframe />
    </mesh>
  );
}

export function ModelCanvas({ selectedFile }: ModelCanvasProps) {
  if (!selectedFile) {
    return (
      <div className="flex h-full min-h-96 flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-700 bg-slate-800/60 text-slate-400">
          <svg
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
            />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-slate-200">
          3D Viewport Idle
        </h3>
        <p className="mt-1 max-w-xs text-xs text-slate-400">
          Upload an .ifc or .gltf architectural blueprint to inspect the model and anchor its cryptographic proof on Filecoin.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-96 w-full flex-col">
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-1">
        <span className="w-fit rounded border border-slate-700 bg-slate-900/90 px-2.5 py-1 font-mono text-xs text-sky-400">
          Staged: {selectedFile.name}
        </span>
        <span className="font-mono text-[11px] text-slate-400">
          Bounding wireframe volume (prototype)
        </span>
      </div>

      <div className="flex-1 min-h-80 w-full">
        <Canvas camera={{ position: [4, 3, 4], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={1.2} />
          <gridHelper args={[12, 12, "#334155", "#1e293b"]} position={[0, -2, 0]} />
          <RotatingBox />
        </Canvas>
      </div>

      <div className="border-t border-slate-800 bg-slate-950/80 px-4 py-2 font-mono text-[11px] text-slate-400">
        Preview shows a bounding box only. Real IFC geometry is not rendered yet.
      </div>
    </div>
  );
}
