"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The 3D world — Phase 2.
 *
 * A globe with the member's real astrocartography lines, the 27-nakshatra belt,
 * and the nine grahas placed on that belt by their sidereal longitude. Clicking
 * a graha (in the scene or the HUD) swings it to the front and holds it.
 *
 * Everything data-bearing comes from `lib/kp` and `lib/astrocartography`; the
 * stars are decoration. Interaction is hand-rolled rather than pulling in
 * OrbitControls, and auto-orbit respects reduced motion.
 */

export interface WorldLine {
  graha: string;
  angle: string;
  /** [longitude, latitude] polylines, already split at the antimeridian. */
  segments: Array<Array<[number, number]>>;
}

export interface WorldPlanet {
  graha: string;
  /** Unicode graha glyph, e.g. ☉ for the Sun. */
  glyph: string;
  /** Sidereal longitude at the birth instant, 0–360. */
  longitude: number;
  /** Nakshatra the graha occupies. */
  nakshatra: string;
}

interface WorldProps {
  lines: WorldLine[];
  nakshatras: readonly string[];
  planets: WorldPlanet[];
  selected: string | null;
  onSelect: (graha: string | null) => void;
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
const BELT_R = 2.05;
const ARC = 360 / 27;

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

/** A point on the belt plane at a celestial longitude. */
function beltPosition(longitude: number, r: number): [number, number, number] {
  const a = longitude * (Math.PI / 180);
  return [-Math.sin(a) * r, 0, -Math.cos(a) * r];
}

/**
 * The yaw that brings a belt longitude to the front of the camera.
 *
 * The belt places a graha at (-sin L, 0, -cos L); rotating the rig by π − L
 * lands that point at +Z, where the camera is.
 */
export function focusYawFor(longitude: number): number {
  return Math.PI - longitude * (Math.PI / 180);
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
      <mesh scale={1.002}>
        <sphereGeometry args={[GLOBE_R, 36, 24]} />
        <meshBasicMaterial color="#3b5f8f" wireframe transparent opacity={0.14} />
      </mesh>
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
  planets,
  selected,
  onSelect,
}: {
  nakshatras: readonly string[];
  moonLongitude?: number;
  planets: WorldPlanet[];
  selected: string | null;
  onSelect: (graha: string | null) => void;
}) {
  const activeIndex =
    typeof moonLongitude === "number"
      ? Math.floor((((moonLongitude % 360) + 360) % 360) / ARC)
      : -1;

  return (
    <group rotation={[Math.PI / 2.6, 0, 0]}>
      <mesh>
        <torusGeometry args={[BELT_R, 0.004, 8, 240]} />
        <meshBasicMaterial color="#d4ff3f" transparent opacity={0.35} />
      </mesh>

      {nakshatras.map((name, index) => (
        <mesh key={name} position={beltPosition(index * ARC, BELT_R)}>
          <sphereGeometry args={[index === activeIndex ? 0.035 : 0.016, 12, 12]} />
          <meshBasicMaterial color={index === activeIndex ? "#d4ff3f" : "#8f7bd6"} />
        </mesh>
      ))}

      {/* The nine grahas, on the same belt, by sidereal longitude. */}
      {planets.map((planet) => {
        const isSelected = selected === planet.graha;
        const color = GRAHA_COLOR[planet.graha] ?? "#d4ff3f";
        return (
          <group key={planet.graha} position={beltPosition(planet.longitude, BELT_R)}>
            <mesh
              onClick={(event) => {
                event.stopPropagation();
                onSelect(planet.graha);
              }}
              onPointerOver={(event) => {
                event.stopPropagation();
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "";
              }}
            >
              <sphereGeometry args={[isSelected ? 0.085 : 0.055, 20, 20]} />
              <meshBasicMaterial color={color} />
            </mesh>

            <mesh scale={isSelected ? 2.6 : 1.7}>
              <sphereGeometry args={[0.055, 16, 16]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={isSelected ? 0.28 : 0.12}
              />
            </mesh>

            {isSelected ? (
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.16, 0.006, 8, 48]} />
                <meshBasicMaterial color={color} transparent opacity={0.8} />
              </mesh>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

function Starfield({ count = 2400 }: { count?: number }) {
  const positions = useMemo(() => {
    const array = new Float32Array(count * 3);
    // Deterministic pseudo-random: a hash of the index, so the field is stable
    // across renders and the same sky returns after a remount.
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
const GROUND_Y = -2.2;

/**
 * First person.
 *
 * Click to lock the pointer, mouse to look, WASD to move, Shift to run, Space
 * and C to rise and fall. There is no collision yet — the ground plane is a
 * floor, not an obstacle — so this is a fly-cam that happens to start at eye
 * height, which is enough to make the world navigable while the structures are
 * still to come.
 *
 * Pointer lock is requested on a click rather than on mount: browsers require a
 * gesture, and a page that hijacks the cursor on load is hostile.
 */
function FirstPersonRig({ children }: { children: React.ReactNode }) {
  const { gl, camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const look = useRef({ yaw: 0, pitch: -0.06 });
  const position = useRef(new THREE.Vector3(0, 0.7, 7));

  useEffect(() => {
    const element = gl.domElement;

    const requestLock = () => {
      void element.requestPointerLock?.();
    };
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== element) return;
      look.current.yaw -= event.movementX * 0.0022;
      look.current.pitch = Math.max(
        -1.2,
        Math.min(1.2, look.current.pitch - event.movementY * 0.0022),
      );
    };
    const onKeyDown = (event: KeyboardEvent) => {
      keys.current[event.code] = true;
      if (event.code === "Space") event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keys.current[event.code] = false;
    };

    element.addEventListener("pointerdown", requestLock);
    document.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      element.removeEventListener("pointerdown", requestLock);
      document.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [gl]);

  // A three.js camera is a mutable object and this is its render loop; the
  // compiler's immutability rule does not apply to it.
  /* eslint-disable react-hooks/immutability */
  useFrame((_, delta) => {
    // Clamp the step so a background tab cannot teleport the camera.
    const step = Math.min(delta, 0.05) * (keys.current.ShiftLeft ? 9 : 4.5);
    const forward = new THREE.Vector3(
      -Math.sin(look.current.yaw),
      0,
      -Math.cos(look.current.yaw),
    );
    const right = new THREE.Vector3(
      Math.cos(look.current.yaw),
      0,
      -Math.sin(look.current.yaw),
    );

    const p = position.current;
    if (keys.current.KeyW) p.addScaledVector(forward, step);
    if (keys.current.KeyS) p.addScaledVector(forward, -step);
    if (keys.current.KeyD) p.addScaledVector(right, step);
    if (keys.current.KeyA) p.addScaledVector(right, -step);
    if (keys.current.Space) p.y += step;
    if (keys.current.KeyC) p.y -= step;
    p.y = Math.max(GROUND_Y + 1.1, Math.min(40, p.y));

    camera.position.copy(p);
    camera.rotation.order = "YXZ";
    camera.rotation.set(look.current.pitch, look.current.yaw, 0);
  });
  /* eslint-enable react-hooks/immutability */

  return <group>{children}</group>;
}

export function WorldScene({
  lines,
  nakshatras,
  planets,
  selected,
  onSelect,
  moonLongitude,
}: WorldProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.6, 3.4], fov: 45 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      className="touch-none"
    >
      <color attach="background" args={["#05020c"]} />
      <fog attach="fog" args={["#05020c", 16, 80]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 2, 4]} intensity={1.6} color="#fff4d6" />
      <Starfield />
      {/* The floor: a dark plane with a faint grid, so there is a horizon. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, 0]}>
        <planeGeometry args={[240, 240]} />
        <meshBasicMaterial color="#05020c" />
      </mesh>
      <gridHelper
        args={[240, 80, "#241a45", "#120a24" as unknown as string]}
        position={[0, GROUND_Y + 0.01, 0]}
      />
      <FirstPersonRig>
        <Globe />
        <CartoArcs lines={lines} />
        <NakshatraBelt
          nakshatras={nakshatras}
          moonLongitude={moonLongitude}
          planets={planets}
          selected={selected}
          onSelect={onSelect}
        />
      </FirstPersonRig>
    </Canvas>
  );
}
