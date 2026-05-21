"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 pigment;
  uniform float feather;
  uniform float time;
  uniform float hover;
  uniform vec3 rim;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 c = vUv - 0.5;
    float f = mix(feather, feather * 1.9, hover);
    float dx = smoothstep(0.5, 0.5 - f, abs(c.x));
    float dy = smoothstep(0.5, 0.5 - f, abs(c.y));
    float a = dx * dy;

    // inner radial falloff so the pigment isn't flat
    float r = length(c * vec2(1.0, 1.6));
    vec3 base = pigment * (1.0 - r * 0.42);

    // tungsten rim glow concentrated at the feather band
    float edgeBand = (1.0 - dx * dy) * (dx * dy) * 6.0;
    edgeBand = clamp(edgeBand, 0.0, 1.0);
    base += rim * edgeBand * (0.22 + hover * 0.55);

    // print grain
    float g = hash(vUv * 820.0 + time * 0.04) - 0.5;
    base += g * 0.035;

    gl_FragColor = vec4(base, a);
  }
`;

type Props = {
  pigment: [number, number, number];
  feather?: number;
  hovered: boolean;
};

export function SoftPlane({ pigment, feather = 0.09, hovered }: Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null!);
  const hoverLerp = useRef(0);

  const uniforms = useMemo(
    () => ({
      pigment: { value: new THREE.Vector3(...pigment) },
      feather: { value: feather },
      time: { value: 0 },
      hover: { value: 0 },
      rim: { value: new THREE.Vector3(1.0, 0.62, 0.32) },
    }),
    [pigment, feather],
  );

  useFrame((_, delta) => {
    const target = hovered ? 1 : 0;
    hoverLerp.current += (target - hoverLerp.current) * Math.min(1, delta * 6);
    const m = matRef.current;
    if (!m) return;
    m.uniforms.hover.value = hoverLerp.current;
    m.uniforms.time.value += delta;
  });

  return (
    <shaderMaterial
      ref={matRef}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      uniforms={uniforms}
      transparent
      depthWrite={false}
      side={THREE.DoubleSide}
    />
  );
}
