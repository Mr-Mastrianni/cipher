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
 * The model is rigged (a Mixamo skeleton with Walking and Running clips). She
 * stands still when docked, walks when she crosses the page and breaks into a
 * run for a long way, turning to face where she is going or what she is
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
const smooth = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Speeds on screen, in CSS pixels a second, at which she starts to walk and to run. */
const WALK_FROM = [25, 160] as const;
const RUN_FROM = [520, 900] as const;

interface Rig {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  /** (Re)start every clip: standing, with the walk and run silent until she moves. */
  start: () => void;
  /** Advance the clips a frame, blended by how fast she is crossing the screen; returns how much she is moving, 0 to 1. */
  drive: (speed: number, dt: number) => number;
}

/**
 * Builds the figure and its clips. Her standing pose is the moment in the walk
 * where her feet are closest together, held still.
 */
function buildRig(gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }): Rig {
  const root = gltf.scene;
  root.traverse((object) => {
    if ((object as THREE.SkinnedMesh).isSkinnedMesh) object.frustumCulled = false;
  });
  const find = (name: string) => gltf.animations.find((clip) => clip.name.toLowerCase().startsWith(name));
  const walkClip = find("walk") ?? gltf.animations[0];
  const runClip = find("run") ?? walkClip;

  const mixer = new THREE.AnimationMixer(root);
  const walk = mixer.clipAction(walkClip);
  const run = mixer.clipAction(runClip);
  const idle = mixer.clipAction(walkClip.clone());

  // Find the stride's still point by sampling the walk.
  let left: THREE.Object3D | undefined;
  let right: THREE.Object3D | undefined;
  root.traverse((object) => {
    if (/LeftFoot$/.test(object.name)) left = object;
    if (/RightFoot$/.test(object.name)) right = object;
  });
  let stand = 0;
  if (left && right && walkClip.duration > 0) {
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    let best = Infinity;
    walk.play();
    for (let i = 0; i < 40; i++) {
      const time = (i / 40) * walkClip.duration;
      walk.time = time;
      mixer.update(0);
      root.updateMatrixWorld(true);
      left.getWorldPosition(a);
      right.getWorldPosition(b);
      const apart = Math.hypot(a.x - b.x, a.z - b.z);
      if (apart < best) {
        best = apart;
        stand = time;
      }
    }
    walk.stop();
  }
  const start = () => {
    idle.reset();
    idle.time = stand;
    idle.timeScale = 0;
    idle.weight = 1;
    idle.play();
    walk.reset().play();
    run.reset().play();
    walk.weight = 0;
    run.weight = 0;
    mixer.update(0);
    root.updateMatrixWorld(true);
  };
  const drive = (speed: number, dt: number) => {
    const moving = smooth(WALK_FROM[0], WALK_FROM[1], speed);
    const running = smooth(RUN_FROM[0], RUN_FROM[1], speed);
    idle.weight = 1 - moving;
    walk.weight = moving * (1 - running);
    run.weight = moving * running;
    walk.timeScale = clamp(speed / 260, 0.8, 1.4);
    mixer.update(dt);
    return moving;
  };
  start();
  return { root, mixer, start, drive };
}

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

  const rig = useMemo(() => buildRig(gltf), [gltf]);
  // Strict mode runs this effect, tears it down and runs it again: start the clips each time.
  useEffect(() => {
    rig.start();
    return () => void rig.mixer.stopAllAction();
  }, [rig]);

  // Stand her upright at a fixed height, centred, whatever scale Meshy chose.
  const figure = useMemo(() => {
    const root = rig.root;
    // Measured from a clean slate, so running this twice (strict mode) gives the same result.
    root.scale.setScalar(1);
    root.position.set(0, 0, 0);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root, true);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const scale = HEIGHT / size.y;
    root.scale.setScalar(scale);
    root.position.set(-centre.x * scale, -centre.y * scale, -centre.z * scale);
    return root;
  }, [rig]);

  useFrame((state, dt) => {
    const group = body.current;
    if (!group) return;
    const { vx, vy, face } = motion.current;
    const t = state.clock.elapsedTime;
    const ease = 1 - Math.exp(-dt * 5);
    const speed = Math.hypot(vx, vy);

    lean.current += ((speaking ? 1 : 0) - lean.current) * ease;

    // Stand, walk or run.
    const moving = rig.drive(reduced ? 0 : speed, dt);

    // She turns toward where she is going; at rest, toward what she shows you.
    const heading = clamp(vx * 0.0045, -1.05, 1.05);
    const yaw = moving > 0.05 && Math.abs(vx) > Math.abs(vy) * 0.5 ? heading : clamp(face * 0.5, -0.75, 0.75);
    const pitch = reduced ? 0 : lean.current * 0.08;
    group.rotation.y += (yaw - group.rotation.y) * ease;
    group.rotation.z += (0 - group.rotation.z) * ease;
    group.rotation.x += (pitch - group.rotation.x) * ease;

    // A slow breath while she stands; the stride carries her when she moves.
    const breath = reduced ? 0 : Math.sin(t * 1.5) * 0.03 * (1 - moving);
    group.position.y = breath;
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
