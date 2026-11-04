"use client";

import { Suspense, useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * The guide's body: the optimised model, lit by a warm brass key and a cool
 * moonlit rim, drawn in a small transparent canvas that the page moves about.
 *
 * The model has no skeleton, so she cannot walk or move her mouth. What she
 * can do is what a winged figure does: glide. She banks into a turn, tips
 * toward where she is going, bobs as she travels, turns to face what she is
 * showing you, and leans in while she is read aloud.
 */

const MODEL = "/models/guide/guide.glb";
const HEIGHT = 2;

/** What the page tells the figure each frame about how she is moving. */
export interface GuideMotion {
  /** Velocity on screen, in CSS pixels a second. */
  vx: number;
  vy: number;
  /** Which way to face, in [-1, 1]: positive toward the right of the screen. */
  face: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function Guardian({
  motion,
  speaking,
  reduced,
}: {
  motion: RefObject<GuideMotion>;
  speaking: boolean;
  reduced: boolean;
}) {
  const gltf = useLoader(GLTFLoader, MODEL, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });
  const body = useRef<THREE.Group>(null);
  const lean = useRef(0);

  // Stand her upright at a fixed height, centred, whatever scale Meshy chose.
  const figure = useMemo(() => {
    const root = gltf.scene;
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const scale = HEIGHT / size.y;
    root.scale.setScalar(scale);
    root.position.set(-centre.x * scale, -centre.y * scale, -centre.z * scale);
    return root;
  }, [gltf]);

  useFrame((state, dt) => {
    const group = body.current;
    if (!group) return;
    const { vx, vy, face } = motion.current;
    const t = state.clock.elapsedTime;
    const ease = 1 - Math.exp(-dt * 5);
    const speed = Math.hypot(vx, vy);

    lean.current += ((speaking ? 1 : 0) - lean.current) * ease;
    const yaw = clamp(face * 0.5 + vx * 0.0005, -0.75, 0.75);
    const roll = reduced ? 0 : clamp(-vx * 0.0011, -0.4, 0.4);
    const pitch = reduced ? 0 : clamp(vy * 0.0005, -0.3, 0.3) + lean.current * 0.08;
    group.rotation.y += (yaw - group.rotation.y) * ease;
    group.rotation.z += (roll - group.rotation.z) * ease;
    group.rotation.x += (pitch - group.rotation.x) * ease;

    // A hover, and a livelier bounce while she is travelling.
    const hover = reduced ? 0 : Math.sin(t * 1.5) * 0.05;
    const travel = reduced ? 0 : Math.abs(Math.sin(t * 8)) * 0.035 * Math.min(1, speed / 350);
    group.position.y = hover + travel;
    group.position.z = lean.current * 0.12;
  });

  return (
    <group ref={body}>
      <primitive object={figure} />
    </group>
  );
}

/** Reflections for the metal in her textures: without them it renders black. */
function Environment() {
  const gl = useThree((state) => state.gl);
  const texture = useMemo(() => {
    const generator = new THREE.PMREMGenerator(gl);
    const target = generator.fromScene(new RoomEnvironment(), 0.04);
    generator.dispose();
    return target.texture;
  }, [gl]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <primitive object={texture} attach="environment" />;
}

/** Rendered only once the model has loaded, so the page can fade her in. */
function Ready({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return null;
}

export function GuideScene({
  motion,
  speaking,
  reduced,
  onReady,
}: {
  motion: RefObject<GuideMotion>;
  speaking: boolean;
  reduced: boolean;
  onReady?: () => void;
}) {
  return (
    <Canvas
      aria-hidden="true"
      scene={{ environmentIntensity: 0.55 }}
      camera={{ fov: 30, position: [0, 0, 4.7], near: 0.1, far: 40 }}
      dpr={[1, 1.5]}
      style={{ pointerEvents: "none" }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: "high-performance" }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <Environment />
      {/* A warm brass key from the front and a cool moonlit rim from behind. */}
      <directionalLight position={[2.5, 2.2, 4]} intensity={1.6} color={0xffdfae} />
      <directionalLight position={[-3, 1.5, -3]} intensity={2.4} color={0x9db8ff} />
      <Suspense fallback={null}>
        <Guardian motion={motion} speaking={speaking} reduced={reduced} />
        <Ready onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
