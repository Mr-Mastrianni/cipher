"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * The guide's body: the optimised model, floating in a moonlit key and rim.
 *
 * The model has no skeleton and no face rig, so she does not talk with her
 * mouth or pose. She breathes, drifts, turns toward whoever is looking, and
 * leans in while she is being read aloud. That is the honest range of a static
 * mesh, and it is enough to feel attended to.
 */

const MODEL = "/models/guide/guide.glb";
const HEIGHT = 2;

function Guardian({ speaking, reduced }: { speaking: boolean; reduced: boolean }) {
  const gltf = useLoader(GLTFLoader, MODEL, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });
  const body = useRef<THREE.Group>(null);

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

  const lean = useRef(0);
  useFrame((state, dt) => {
    const group = body.current;
    if (!group) return;
    const t = state.clock.elapsedTime;
    const ease = 1 - Math.exp(-dt * 3);
    const lookX = reduced ? 0 : state.pointer.x;
    const lookY = reduced ? 0 : state.pointer.y;
    group.rotation.y += (lookX * 0.38 - group.rotation.y) * ease;
    group.rotation.x += (-lookY * 0.07 - group.rotation.x) * ease;
    lean.current += ((speaking ? 1 : 0) - lean.current) * ease;
    group.position.y = reduced ? 0 : Math.sin(t * (0.8 + lean.current * 0.5)) * 0.035;
    group.position.z = lean.current * 0.16;
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

export function GuideScene({
  speaking,
  reduced,
  onReady,
}: {
  speaking: boolean;
  reduced: boolean;
  onReady?: () => void;
}) {
  return (
    <Canvas
      aria-hidden="true"
      scene={{ environmentIntensity: 0.55 }}
      camera={{ fov: 28, position: [0, 0.38, 4.2], near: 0.1, far: 40 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: "high-performance" }}
      onCreated={({ gl, camera }) => {
        gl.setClearColor(0x000000, 0);
        // A bust: the head, the crest and the wings fill the frame.
        camera.lookAt(0, 0.32, 0);
      }}
    >
      <Environment />
      {/* A warm brass key from the front and a cool moonlit rim from behind. */}
      <directionalLight position={[2.5, 2.2, 4]} intensity={1.6} color={0xffdfae} />
      <directionalLight position={[-3, 1.5, -3]} intensity={2.4} color={0x9db8ff} />
      <Suspense fallback={null}>
        <Guardian speaking={speaking} reduced={reduced} />
        <Ready onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}

/** Rendered only once the model has loaded, so the panel can fade her in. */
function Ready({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return null;
}
