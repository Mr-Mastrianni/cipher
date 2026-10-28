"use client";

import { Suspense, useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The planet under the landing, rendered for real.
 *
 * One sphere carries the surface in a single shader: the day map lit by a
 * low sun, the night map's city lights showing only where it is dark, ocean
 * glint from the specular map, relief from the normal map, and the shadow of
 * the cloud layer above. A second, slightly larger sphere is the cloud deck,
 * and a third, seen from inside, is the atmosphere's rim.
 *
 * Framing is computed, not eyeballed: the disc is sized and placed by the same
 * numbers the CSS placeholder uses (diameter as a share of the viewport width,
 * top edge as a share of its height), so the two coincide and the crossfade
 * between them is invisible. Scroll pushes in exactly as the old CSS scale
 * did — around the centre of the screen — plus a slow drift upward.
 *
 * Textures: Solar System Scope, CC BY 4.0 (see public/textures/earth).
 */

/** The page-scroll distance over which the camera finishes pushing in. */
const PUSH_PX = 2600;
/** How far the push goes: the disc grows to this multiple of its size. */
const PUSH_SCALE = 1.8;
/** The upward drift over the push, as a share of the viewport height. */
const PUSH_DRIFT = 0.05;
/** Degrees the surface turns per pixel scrolled: travel, not a spin. */
const SPIN_PER_PX = 0.006;

/** Disc diameter (× viewport width) and top edge (× viewport height). */
export const FRAMING = {
  mobile: { diameter: 1.7, top: 0.54 },
  desktop: { diameter: 1.15, top: 0.52 },
} as const;
const DESKTOP_MIN_PX = 1024;

const CAMERA_Z = 30;
const FOV = 10;
const HALF_HEIGHT = CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));

/** The sun, from the right and a touch behind: dusk falls over West Africa. */
const SUN = new THREE.Vector3(0.9, 0.38, -0.05).normalize();

/**
 * Africa toward the viewer. The camera sees the cap of a sphere whose centre
 * is below the screen; tipping the north pole away (a negative tilt) lifts the
 * equator into that cap, north still up.
 */
const FACING_LON = 18;
const TILT = -0.5;

/** How thick the glow above the limb reads, as a share of the radius. */
const AIR_SCALE = 0.011;

const SURFACE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec3 vEast;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    // A sphere's tangent frame is analytic: east at every point.
    vEast = normalize(mat3(modelMatrix) * vec3(normal.z, 0.0, -normal.x) + vec3(1e-5));
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const SURFACE_FRAGMENT = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D cloudMap;
  uniform sampler2D specMap;
  uniform sampler2D normalMap;
  uniform vec3 sunDir;
  uniform float cloudShift;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec3 vEast;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 nGeo = normalize(vWorldNormal);

    vec3 east = normalize(vEast);
    vec3 north = cross(nGeo, east);
    vec3 tn = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
    tn.xy *= 1.6;
    vec3 nSurf = normalize(east * tn.x + north * tn.y + nGeo * tn.z);

    float sunGeo = dot(nGeo, sunDir);
    float daylight = smoothstep(-0.18, 0.28, sunGeo);
    float lambert = max(dot(nSurf, sunDir), 0.0);

    vec3 day = texture2D(dayMap, vUv).rgb;
    float cloud = pow(texture2D(cloudMap, vec2(vUv.x - cloudShift, vUv.y)).r, 1.4);
    day *= 1.0 - cloud * 0.42 * daylight;

    // The terminator: light that has crossed more air arrives warmer.
    float dusk = smoothstep(0.0, 0.18, sunGeo) * (1.0 - smoothstep(0.18, 0.55, sunGeo));
    vec3 sunColor = mix(vec3(1.0, 0.97, 0.92), vec3(1.0, 0.62, 0.36), dusk * 0.85);
    vec3 color = day * sunColor * (lambert + 0.012);

    // Oceans glint; land does not.
    float water = texture2D(specMap, vUv).r;
    vec3 halfway = normalize(sunDir + viewDir);
    float glint = pow(max(dot(nGeo, halfway), 0.0), 90.0) * 1.1 + pow(max(dot(nGeo, halfway), 0.0), 12.0) * 0.12;
    color += sunColor * glint * water * daylight;

    // City lights, only where it is dark, warmed toward gold.
    vec3 night = texture2D(nightMap, vUv).rgb;
    vec3 lights = pow(night, vec3(1.8)) * vec3(2.6, 2.0, 1.25);
    color += lights * (1.0 - daylight) * (1.0 - cloud * 0.6);

    // Air seen edge-on: a blue haze over the lit limb.
    float rim = pow(1.0 - max(dot(nGeo, viewDir), 0.0), 4.0);
    color += vec3(0.32, 0.58, 1.0) * rim * (daylight * 0.55 + 0.04);

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const CLOUD_FRAGMENT = /* glsl */ `
  uniform sampler2D cloudMap;
  uniform vec3 sunDir;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 n = normalize(vWorldNormal);
    float c = pow(texture2D(cloudMap, vUv).r, 1.4);
    float sunGeo = dot(n, sunDir);
    float lit = smoothstep(-0.12, 0.35, sunGeo);
    float dusk = smoothstep(0.0, 0.2, sunGeo) * (1.0 - smoothstep(0.2, 0.5, sunGeo));
    vec3 tint = mix(vec3(1.0), vec3(1.0, 0.7, 0.5), dusk * 0.8);
    gl_FragColor = vec4(tint * (lit * 0.95 + 0.03), c * (0.25 + 0.75 * lit) * 0.72);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 sunDir;
  uniform vec3 centre;
  uniform float radius;
  uniform float airScale;
  varying vec3 vWorldPos;
  void main() {
    // How high above the surface this ray passes, as a share of the radius:
    // the glow falls off exponentially with it, as air density does.
    vec3 ray = normalize(vWorldPos - cameraPosition);
    vec3 closest = cameraPosition + ray * dot(centre - cameraPosition, ray);
    vec3 up = closest - centre;
    float height = max(0.0, length(up) - radius) / radius;
    float glow = exp(-height / airScale) * smoothstep(0.06, 0.0, height);
    float lit = smoothstep(-0.3, 0.5, dot(normalize(up), sunDir));
    vec3 color = vec3(0.2 + 0.25 * lit, 0.42 + 0.3 * lit, 1.0);
    gl_FragColor = vec4(color * glow * (lit * 1.6 + 0.06), 1.0);
  }
`;

function texturePaths(large: boolean) {
  const size = large ? "4k" : "2k";
  return [
    `/textures/earth/${size}_earth_day.jpg`,
    `/textures/earth/${size}_earth_night.jpg`,
    `/textures/earth/${size}_earth_clouds.jpg`,
    "/textures/earth/2k_earth_specular.jpg",
    "/textures/earth/2k_earth_normal.jpg",
  ];
}

interface PlanetProps {
  scroll: RefObject<number>;
  reduced: boolean;
  large: boolean;
  onReady: () => void;
}

function Planet({ scroll, reduced, large, onReady }: PlanetProps) {
  const [day, night, clouds, spec, normal] = useLoader(
    THREE.TextureLoader,
    texturePaths(large),
  );
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);

  useMemo(() => {
    const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    for (const texture of [day, night]) texture.colorSpace = THREE.SRGBColorSpace;
    for (const texture of [day, night, clouds, spec, normal]) {
      texture.anisotropy = anisotropy;
      texture.wrapS = THREE.RepeatWrapping;
    }
  }, [day, night, clouds, spec, normal, gl]);

  const surface = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERTEX,
        fragmentShader: SURFACE_FRAGMENT,
        uniforms: {
          dayMap: { value: day },
          nightMap: { value: night },
          cloudMap: { value: clouds },
          specMap: { value: spec },
          normalMap: { value: normal },
          sunDir: { value: SUN },
          cloudShift: { value: 0 },
        },
      }),
    [day, night, clouds, spec, normal],
  );
  const cloudDeck = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERTEX,
        fragmentShader: CLOUD_FRAGMENT,
        uniforms: { cloudMap: { value: clouds }, sunDir: { value: SUN } },
        transparent: true,
        depthWrite: false,
      }),
    [clouds],
  );
  const atmosphere = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERTEX,
        fragmentShader: ATMOSPHERE_FRAGMENT,
        uniforms: {
          sunDir: { value: SUN },
          centre: { value: new THREE.Vector3() },
          radius: { value: 1 },
          airScale: { value: AIR_SCALE },
        },
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  useEffect(
    () => () => {
      surface.dispose();
      cloudDeck.dispose();
      atmosphere.dispose();
    },
    [surface, cloudDeck, atmosphere],
  );

  const frame = useRef<THREE.Group>(null);
  const globe = useRef<THREE.Group>(null);
  const cloudShell = useRef<THREE.Mesh>(null);
  const ground = useRef<THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>>(null);
  const air = useRef<THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>>(null);
  const idle = useRef(0);
  const cloudDrift = useRef(0);

  useEffect(onReady, [onReady]);

  useFrame((_, delta) => {
    if (!frame.current || !globe.current || !cloudShell.current || !ground.current || !air.current) return;
    const step = Math.min(delta, 0.1);
    const scrolled = reduced ? 0 : scroll.current ?? 0;
    const push = Math.min(1, Math.max(0, scrolled / PUSH_PX));
    if (!reduced) {
      idle.current += step * 0.006;
      cloudDrift.current += step * 0.0035;
    }

    // Size and place the disc exactly where the CSS placeholder sits.
    const { diameter, top } =
      size.width >= DESKTOP_MIN_PX ? FRAMING.desktop : FRAMING.mobile;
    const aspect = size.width / size.height;
    const scale = 1 + (PUSH_SCALE - 1) * push;
    const discShare = diameter * aspect; // diameter as a share of the height
    const centre = top + discShare / 2;
    const centreNow = 0.5 + (centre - 0.5) * scale - PUSH_DRIFT * push;
    const radius = discShare * scale * HALF_HEIGHT;
    frame.current.scale.setScalar(radius);
    frame.current.position.y = HALF_HEIGHT - 2 * HALF_HEIGHT * centreNow;
    air.current.material.uniforms.centre.value.copy(frame.current.position);
    air.current.material.uniforms.radius.value = radius;

    const spin = THREE.MathUtils.degToRad(scrolled * SPIN_PER_PX);
    globe.current.rotation.y =
      -THREE.MathUtils.degToRad(FACING_LON + 90) - idle.current - spin;
    cloudShell.current.rotation.y = -cloudDrift.current;
    // The cloud shadows sit under the deck: a ground point at longitude u
    // sees the cloud texel at u + (ground turn − deck turn) / 2π.
    ground.current.material.uniforms.cloudShift.value =
      (cloudShell.current.rotation.y - globe.current.rotation.y) / (Math.PI * 2);
  });

  return (
    <group ref={frame}>
      <group rotation={[TILT, 0, 0.12]}>
        <group ref={globe}>
          <mesh ref={ground} material={surface}>
            <sphereGeometry args={[1, 160, 96]} />
          </mesh>
        </group>
        <mesh ref={cloudShell} material={cloudDeck} scale={1.006}>
          <sphereGeometry args={[1, 128, 64]} />
        </mesh>
      </group>
      <mesh ref={air} material={atmosphere} scale={1.07}>
        <sphereGeometry args={[1, 96, 48]} />
      </mesh>
    </group>
  );
}

export function EarthScene({
  scroll,
  reduced,
  onReady,
  onLost,
}: {
  scroll: RefObject<number>;
  reduced: boolean;
  onReady: () => void;
  /** The GPU dropped the context (mobile Safari does): hand back. */
  onLost: () => void;
}) {
  // Phones and small screens get 2k maps; the surface is never larger than
  // the screen there, and the download is a third of the size.
  const large = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.innerWidth * Math.min(window.devicePixelRatio, 2) >= 1600,
    [],
  );

  return (
    <Canvas
      dpr={[1, large ? 1.75 : 1.5]}
      camera={{ fov: FOV, position: [0, 0, CAMERA_Z], near: 1, far: 100 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.domElement.addEventListener("webglcontextlost", onLost, { once: true });
        // A driver that rejects a shader would leave an empty sky; hand back.
        gl.debug.onShaderError = (context, program) => {
          console.warn("Earth shader failed; using the dotted globe.", context.getProgramInfoLog(program));
          onLost();
        };
      }}
      style={{ pointerEvents: "none" }}
    >
      <Suspense fallback={null}>
        <Planet scroll={scroll} reduced={reduced} large={large} onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
