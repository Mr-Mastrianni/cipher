"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The 3D world — Phase 1.
 *
 * A globe with the member's real astrocartography lines and the 27-nakshatra
 * belt. It is deliberately *data-true*: the arcs come from
 * `lib/astrocartography` (spherical astronomy, not decoration), and the belt is
 * the 13°20′ ecliptic division. The decoration sits behind them.
 *
 * Interaction is hand-rolled rather than pulling in OrbitControls: drag to
 * rotate, wheel to zoom, a slow auto-orbit when idle. That keeps the bundle to
 * `three` + `@react-three/fiber` and avoids a second dependency for 40 lines of
 * pointer maths.
 */

export interface WorldLine {
  graha: string;
  angle: string;
  /** [longitude, latitude] polylines, already split at the antimeridian. */
  segments: Array<Array<[number, number]>>;
}

interface WorldProps {
  lines: WorldLine[];
  nakshatras: readonly string[];
  /** Sidereal longitude of the Moon, to mark the current nakshatra. */
  moonLongitude?: number;
}

const GRAHA_COLOR: Record<string, string> = {
  sun: "#ffb347",
  moon: "#d9d3ff",
  mars: "#ff5c5c",
  mercury: "#5ce1e6",
  jupiter: "#e0b84f",
  venus: "#ff8fd1",
  saturn: "#8f9bb3",
  rahu: "#9b7cff",
  ketu: "#c0a86b",
};

const GLOBE_R = 1;

/** [lon, lat] in degrees → a point on a sphere of radius r. */
function toVector(lon: number, lat: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function Globe() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[GLOBE_R, 64, 48]} />
        <meshStandardMaterial
          color="#0e1c33"
          roughness={0.92}
          metalness={0.12}
          emissive="#0a1730"
          emissiveIntensity={0.55}
        />
      </mesh>
      {/* A faint graticule so the sphere reads as a chart, not a marble. */}
      <mesh scale={1.002}>
        <sphereGeometry args={[GLOBE_R, 36, 24]} />
        <meshBasicMaterial color="#3b5f8f" wireframe transparent opacity={0.14} />
      </mesh>
      {/* Atmosphere */}
      <mesh scale={1.045}>
        <sphereGeometry args={[GLOBE_R, 48, 32]} />
        <meshBasicMaterial color="#5ce1e6" transparent opacity={0.055} />
      </mesh>
    </group>
  );
}

function CartoArcs({ lines }: { lines: WorldLine[] }) {
  const objects = useMemo(() => {
    const built: Array<THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>> = [];
    for (const line of lines) {
      for (const segment of line.segments) {
        if (segment.length < 2) continue;
        const points = segment.map(([lon, lat]) =>
          toVector(lon, lat, GLOBE_R * 1.012),
        );
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
          color: GRAHA_COLOR[line.graha] ?? "#d4ff3f",
          transparent: true,
          opacity: line.angle === "tenth" ? 0.95 : 0.55,
        });
        built.push(new THREE.Line(geometry, material));
      }
    }
    return built;
  }, [lines]);

  // Dispose GPU buffers when the chart changes or the page unmounts.
  useEffect(() => {
    return () => {
      for (const line of objects) {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }
    };
  }, [objects]);

  return (
    <group>
      {objects.map((line, index) => (
        <primitive key={index} object={line} />
      ))}
    </group>
  );
}

function NakshatraBelt({
  nakshatras,
  moonLongitude,
}: {
  nakshatras: readonly string[];
  moonLongitude?: number;
}) {
  const ARC = 360 / 27;
  const activeIndex =
    typeof moonLongitude === "number"
      ? Math.floor((((moonLongitude % 360) + 360) % 360) / ARC)
      : -1;

  return (
    <group rotation={[Math.PI / 2.6, 0, 0]}>
      <mesh>
        <torusGeometry args={[2.05, 0.004, 8, 240]} />
        <meshBasicMaterial color="#d4ff3f" transparent opacity={0.35} />
      </mesh>
      {nakshatras.map((name, index) => {
        const angle = (index * ARC) * (Math.PI / 180);
        const r = 2.05;
        const active = index === activeIndex;
        return (
          <mesh
            key={name}
            position={[-Math.sin(angle) * r, 0, -Math.cos(angle) * r]}
          >
            <sphereGeometry args={[active ? 0.035 : 0.016, 12, 12]} />
            <meshBasicMaterial color={active ? "#d4ff3f" : "#8f7bd6"} />
          </mesh>
        );
      })}
    </group>
  );
}

function Starfield({ count = 2400 }: { count?: number }) {
  const positions = useMemo(() => {
    const array = new Float32Array(count * 3);
    // Deterministic pseudo-random: a hash of the index, so the field is stable
    // across renders (React treats Math.random() in render as impure) and the
    // same sky comes back after a remount.
    const rand = (n: number) => {
      const x = Math.sin(n * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < count; i += 1) {
      const u = rand(i + 0.5) * 2 - 1;
      const theta = rand(i + 17.3) * Math.PI * 2;
      const r = 26 + rand(i + 41.7) * 26;
      const s = Math.sqrt(1 - u * u);
      array[i * 3] = r * s * Math.cos(theta);
      array[i * 3 + 1] = r * u;
      array[i * 3 + 2] = r * s * Math.sin(theta);
    }
    return array;
  }, [count]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.12} sizeAttenuation color="#cfd8ff" transparent opacity={0.85} />
    </points>
  );
}

/** Drag to rotate, wheel to zoom, slow auto-orbit when untouched. */
function OrbitRig({
  children,
  autoRotate,
}: {
  children: React.ReactNode;
  autoRotate: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const { gl, camera } = useThree();
  const state = useRef({
    dragging: false,
    lastX: 0,
    lastY: 0,
    rotX: 0.32,
    rotY: 0,
    targetRotX: 0.32,
    targetRotY: 0,
    zoom: 1,
  });

  useEffect(() => {
    const element = gl.domElement;
    const onPointerDown = (event: PointerEvent) => {
      state.current.dragging = true;
      state.current.lastX = event.clientX;
      state.current.lastY = event.clientY;
      element.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!state.current.dragging) return;
      const dx = event.clientX - state.current.lastX;
      const dy = event.clientY - state.current.lastY;
      state.current.lastX = event.clientX;
      state.current.lastY = event.clientY;
      state.current.targetRotY += dx * 0.005;
      state.current.targetRotX = Math.max(
        -1.15,
        Math.min(1.15, state.current.targetRotX + dy * 0.005),
      );
    };
    const onPointerUp = () => {
      state.current.dragging = false;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      state.current.zoom = Math.max(
        0.72,
        Math.min(2.4, state.current.zoom * (1 + event.deltaY * 0.0012)),
      );
    };

    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointerleave", onPointerUp);
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointerleave", onPointerUp);
      element.removeEventListener("wheel", onWheel);
    };
  }, [gl]);

  useFrame(() => {
    const s = state.current;
    if (autoRotate && !s.dragging) s.targetRotY += 0.0012;
    s.rotX += (s.targetRotX - s.rotX) * 0.08;
    s.rotY += (s.targetRotY - s.rotY) * 0.08;
    if (group.current) {
      group.current.rotation.x = s.rotX;
      group.current.rotation.y = s.rotY;
      group.current.scale.setScalar(s.zoom);
    }
    camera.lookAt(0, 0, 0);
  });

  return <group ref={group}>{children}</group>;
}

export function WorldScene({ lines, nakshatras, moonLongitude }: WorldProps) {
  // Respect the OS preference: no idle motion, but the globe is still draggable.
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.6, 3.4], fov: 45 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      className="touch-none"
    >
      <color attach="background" args={["#05020c"]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 2, 4]} intensity={1.6} color="#fff4d6" />
      <Starfield />
      <OrbitRig autoRotate={!reduced}>
        <Globe />
        <CartoArcs lines={lines} />
        <NakshatraBelt nakshatras={nakshatras} moonLongitude={moonLongitude} />
      </OrbitRig>
    </Canvas>
  );
}
