"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useRef, useState } from "react";
import type { Group } from "three";
import { projects, type Project } from "../data/projects";
import { SoftPlane } from "./SoftPlane";

// x, y, z, scale, baseRotZ — one slot per project
const SLOTS: ReadonlyArray<readonly [number, number, number, number, number]> =
  [
    [-2.6, 0.9, -0.6, 1.0, -0.04],
    [1.6, 1.5, -1.8, 0.85, 0.06],
    [-1.2, -1.3, 0.9, 0.92, -0.02],
    [2.5, -0.7, -0.5, 0.95, 0.05],
    [0.1, 0.05, 1.4, 1.15, -0.01], // featured center-front
  ];

type PlaneProps = {
  project: Project;
  slot: (typeof SLOTS)[number];
  onHover: (p: Project) => void;
  onLeave: () => void;
};

function ProjectPlane({ project, slot, onHover, onLeave }: PlaneProps) {
  const [x, y, z, scale, baseRotZ] = slot;
  const ref = useRef<Group>(null!);
  const [hovered, setHovered] = useState(false);
  const seed = project.id.charCodeAt(0) * 0.013;

  useFrame((state) => {
    const t = state.clock.elapsedTime + seed;
    const g = ref.current;
    if (!g) return;
    g.position.x = x + Math.sin(t * 0.15) * 0.18;
    g.position.y = y + Math.cos(t * 0.18) * 0.14;
    g.rotation.z = baseRotZ + Math.sin(t * 0.1) * 0.04;
    const targetZ = z + (hovered ? 0.7 : 0);
    g.position.z += (targetZ - g.position.z) * 0.08;
    const targetScale = scale * (hovered ? 1.08 : 1);
    g.scale.setScalar(g.scale.x + (targetScale - g.scale.x) * 0.08);
  });

  return (
    <group
      ref={ref}
      position={[x, y, z]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover(project);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        onLeave();
        document.body.style.cursor = "auto";
      }}
      onClick={(e) => {
        e.stopPropagation();
        window.open(project.url, "_blank", "noopener,noreferrer");
      }}
    >
      <mesh>
        <planeGeometry args={[1.6, 1.0]} />
        <SoftPlane pigment={project.pigment} feather={0.1} hovered={hovered} />
      </mesh>
    </group>
  );
}

function CameraParallax() {
  const { camera } = useThree();
  useFrame((state) => {
    const tx = state.pointer.x * 0.45;
    const ty = state.pointer.y * 0.3;
    camera.position.x += (tx - camera.position.x) * 0.04;
    camera.position.y += (ty - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

type Props = {
  onHover: (p: Project) => void;
  onLeave: () => void;
};

export default function Scene({ onHover, onLeave }: Props) {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 38 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <Suspense fallback={null}>
        <CameraParallax />
        {projects.map((p, i) => (
          <ProjectPlane
            key={p.id}
            project={p}
            slot={SLOTS[i]}
            onHover={onHover}
            onLeave={onLeave}
          />
        ))}
      </Suspense>
    </Canvas>
  );
}
