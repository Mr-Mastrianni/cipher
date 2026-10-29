import * as THREE from "three";

/**
 * The Earth: one sphere carries the surface in a single shader — the day map
 * lit by the Sun, the night map's city lights where it is dark, ocean glint
 * from the specular map, relief from the normal map, and the shadow of the
 * cloud deck above. A second sphere is the cloud deck, and a third, seen from
 * inside, is the atmosphere, whose glow falls off with height.
 *
 * At night the cities resolve into a woven gold lattice: the civilisation's
 * own street plan, laid over the real distribution of light.
 *
 * Textures: Solar System Scope, CC BY 4.0, after NASA (public/textures/earth).
 */

/** Africa toward +z before any turn. */
export const FACING_LON = 18;
/** The Earth's axial tilt to the ecliptic, about the line toward the viewer. */
const AXIAL_TILT = THREE.MathUtils.degToRad(23.44);
/** How thick the glow above the limb reads, as a share of the radius. */
const AIR_SCALE = 0.011;

export const SURFACE_VERTEX = /* glsl */ `
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
    float nh = max(dot(nGeo, halfway), 0.0);
    color += sunColor * (pow(nh, 90.0) * 1.1 + pow(nh, 12.0) * 0.12) * water * daylight;

    // City lights, only where it is dark, warmed toward gold.
    float night = 1.0 - daylight;
    vec3 lights = pow(texture2D(nightMap, vUv).rgb, vec3(1.8)) * vec3(2.6, 2.0, 1.25);

    // Where the lights gather, the city's plan shows: a lattice of diamonds
    // on 1.5° cells with an avenue down every other column.
    float urban = smoothstep(0.03, 0.14, dot(texture2D(nightMap, vUv, 3.0).rgb, vec3(0.3333)));
    vec2 cell = vUv * vec2(240.0, 120.0);
    vec2 local = fract(cell) - 0.5;
    float diamond = abs(abs(local.x) + abs(local.y) - 0.34);
    float lattice = 1.0 - smoothstep(0.0, fwidth(diamond) * 1.4 + 0.015, diamond);
    float column = mod(floor(cell.x), 2.0);
    float avenue = (1.0 - smoothstep(0.0, fwidth(local.x) * 1.4 + 0.01, abs(local.x))) * column;
    vec3 plan = vec3(1.0, 0.72, 0.36) * urban * (lattice * 0.55 + avenue * 0.35);

    color += (lights + plan) * night * (1.0 - cloud * 0.6) * (1.0 - water * 0.9);

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

export interface EarthTextures {
  day: THREE.Texture;
  night: THREE.Texture;
  clouds: THREE.Texture;
  specular: THREE.Texture;
  normal: THREE.Texture;
}

export function earthTexturePaths(large: boolean) {
  const size = large ? "4k" : "2k";
  return {
    day: `/textures/earth/${size}_earth_day.jpg`,
    night: `/textures/earth/${size}_earth_night.jpg`,
    clouds: `/textures/earth/${size}_earth_clouds.jpg`,
    specular: "/textures/earth/2k_earth_specular.jpg",
    normal: "/textures/earth/2k_earth_normal.jpg",
  };
}

export interface Earth {
  /** Scaled to the radius and placed at the centre; everything rides in it. */
  frame: THREE.Group;
  /** Turns with the planet: anything fixed to the ground belongs here. */
  globe: THREE.Group;
  /** The planet's tilt, without its turn: for things in equatorial orbit. */
  tilt: THREE.Group;
  update(sunDir: THREE.Vector3, turn: number, cloudTurn: number): void;
  dispose(): void;
}

export function createEarth(textures: EarthTextures, anisotropy: number): Earth {
  for (const texture of [textures.day, textures.night]) texture.colorSpace = THREE.SRGBColorSpace;
  for (const texture of Object.values(textures)) {
    texture.anisotropy = anisotropy;
    texture.wrapS = THREE.RepeatWrapping;
  }

  const sunDir = new THREE.Vector3(1, 0, 0);
  const surface = new THREE.ShaderMaterial({
    vertexShader: SURFACE_VERTEX,
    fragmentShader: SURFACE_FRAGMENT,
    uniforms: {
      dayMap: { value: textures.day },
      nightMap: { value: textures.night },
      cloudMap: { value: textures.clouds },
      specMap: { value: textures.specular },
      normalMap: { value: textures.normal },
      sunDir: { value: sunDir },
      cloudShift: { value: 0 },
    },
  });
  const cloudDeck = new THREE.ShaderMaterial({
    vertexShader: SURFACE_VERTEX,
    fragmentShader: CLOUD_FRAGMENT,
    uniforms: { cloudMap: { value: textures.clouds }, sunDir: { value: sunDir } },
    transparent: true,
    depthWrite: false,
  });
  const atmosphere = new THREE.ShaderMaterial({
    vertexShader: SURFACE_VERTEX,
    fragmentShader: ATMOSPHERE_FRAGMENT,
    uniforms: {
      sunDir: { value: sunDir },
      centre: { value: new THREE.Vector3() },
      radius: { value: 1 },
      airScale: { value: AIR_SCALE },
    },
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });

  const geometries = [
    new THREE.SphereGeometry(1, 160, 96),
    new THREE.SphereGeometry(1, 128, 64),
    new THREE.SphereGeometry(1, 96, 48),
  ];

  const frame = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.rotation.set(0, 0, AXIAL_TILT);
  const globe = new THREE.Group();
  globe.add(new THREE.Mesh(geometries[0], surface));
  const clouds = new THREE.Mesh(geometries[1], cloudDeck);
  clouds.scale.setScalar(1.006);
  tilt.add(globe, clouds);
  const air = new THREE.Mesh(geometries[2], atmosphere);
  air.scale.setScalar(1.07);
  frame.add(tilt, air);

  return {
    frame,
    globe,
    tilt,
    update(sun, turn, cloudTurn) {
      sunDir.copy(sun);
      globe.rotation.y = -THREE.MathUtils.degToRad(FACING_LON + 90) - turn;
      clouds.rotation.y = -cloudTurn;
      // A ground point at longitude u sees the cloud texel at
      // u + (ground turn − deck turn) / 2π: the shadows sit under the deck.
      surface.uniforms.cloudShift.value = (clouds.rotation.y - globe.rotation.y) / (Math.PI * 2);
      atmosphere.uniforms.centre.value.copy(frame.position);
      atmosphere.uniforms.radius.value = frame.scale.x;
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of [surface, cloudDeck, atmosphere]) material.dispose();
      for (const texture of Object.values(textures)) texture.dispose();
    },
  };
}
