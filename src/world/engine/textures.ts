/**
 * The material library. CC0 Poly Haven surfaces, loaded once, cloned per use.
 *
 * The terrain is the one place where a plain `MeshStandardMaterial` is not
 * enough: one texture repeated over 1.7 km reads as wallpaper. The map fragment
 * is replaced with a three-way blend — grass in the flats, rock on the slopes and
 * high ground, wet sand at the waterline — sampled at two scales so the tiling
 * breaks up. The normal, roughness and lighting stay PBR.
 */
import * as THREE from 'three';

export interface Surface {
  map: THREE.Texture;
  normal: THREE.Texture;
  rough: THREE.Texture;
  ao?: THREE.Texture;
}

export interface Assets {
  grass: Surface;
  rock: Surface;
  sand: Surface;
  metal: Surface;
  boulder: Surface;
  waterNormal: THREE.Texture;
}

const loader = new THREE.TextureLoader();

function tex(url: string, srgb: boolean, repeat = 1, anisotropy = 8): THREE.Texture {
  const t = loader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

function cloneRepeat(src: THREE.Texture, repeat: number): THREE.Texture {
  const t = src.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.needsUpdate = true;
  return t;
}

async function loadSurface(name: string, hasAo = false): Promise<Surface> {
  const base = `/textures/${name}`;
  return {
    map: tex(`${base}_albedo.jpg`, true),
    normal: tex(`${base}_normalMap.jpg`, false),
    rough: tex(`${base}_roughnessMap.jpg`, false),
    ao: hasAo ? tex(`${base}_aoMap.jpg`, false) : undefined,
  };
}

export async function loadAssets(renderer: THREE.WebGLRenderer, onProgress?: (p: number) => void): Promise<Assets> {
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  let done = 0;
  const total = 14;
  const tick = () => onProgress?.(++done / total);

  const grass = await loadSurface('grass', true).then((s) => { tick(); tick(); tick(); tick(); return s; });
  const rock = await loadSurface('rock').then((s) => { tick(); tick(); tick(); return s; });
  const sand = await loadSurface('sand').then((s) => { tick(); tick(); tick(); return s; });
  const boulder = await loadSurface('boulder').then((s) => { tick(); tick(); tick(); return s; });

  const metalMap = tex('/textures/metal_albedo.jpg', true);
  const metalNormal = tex('/textures/metal_normalMap.jpg', false);
  const metalArm = tex('/textures/metal_arm.jpg', false);
  const metal: Surface = { map: metalMap, normal: metalNormal, rough: metalArm, ao: metalArm };

  const waterNormal = tex('/textures/water_normals.jpg', false, 1, anisotropy);
  waterNormal.wrapS = waterNormal.wrapT = THREE.RepeatWrapping;
  waterNormal.repeat.set(12, 12);
  tick();

  for (const s of [grass, rock, sand, boulder, metal]) {
    for (const t of [s.map, s.normal, s.rough, s.ao]) {
      if (t) t.anisotropy = anisotropy;
    }
  }

  return {
    grass, rock, sand, metal, boulder, waterNormal,
  };
}

/** Shared material cache: a thousand stones should compile one program. */
const cache = new Map<string, THREE.Material>();

export function sandMaterial(repeat = 3): THREE.MeshStandardMaterial {
  return material(`sand-${repeat}`, () => {
    const m = new THREE.MeshStandardMaterial({
      map: cloneRepeat(assetsRef.sand.map, repeat),
      normalMap: cloneRepeat(assetsRef.sand.normal, repeat),
      roughnessMap: cloneRepeat(assetsRef.sand.rough, repeat),
      color: 0xb7a284,
      roughness: 0.9,
      metalness: 0.02,
      envMapIntensity: 0.7,
    });
    m.normalScale.set(0.7, 0.7);
    return m;
  }) as THREE.MeshStandardMaterial;
}

export function rockMaterial(repeat = 2): THREE.MeshStandardMaterial {
  return material(`rock-${repeat}`, () => {
    const m = new THREE.MeshStandardMaterial({
      map: cloneRepeat(assetsRef.rock.map, repeat),
      normalMap: cloneRepeat(assetsRef.rock.normal, repeat),
      roughnessMap: cloneRepeat(assetsRef.rock.rough, repeat),
      color: 0xbcb4aa,
      roughness: 0.96,
      metalness: 0.01,
      envMapIntensity: 0.55,
    });
    m.normalScale.set(0.9, 0.9);
    return m;
  }) as THREE.MeshStandardMaterial;
}

export function boulderMaterial(repeat = 1): THREE.MeshStandardMaterial {
  return material(`boulder-${repeat}`, () => {
    const m = new THREE.MeshStandardMaterial({
      map: cloneRepeat(assetsRef.boulder.map, repeat),
      normalMap: cloneRepeat(assetsRef.boulder.normal, repeat),
      roughnessMap: cloneRepeat(assetsRef.boulder.rough, repeat),
      color: 0xbab0a2,
      roughness: 0.95,
      metalness: 0.02,
    });
    m.normalScale.set(1.0, 1.0);
    return m;
  }) as THREE.MeshStandardMaterial;
}

export function metalMaterial(repeat = 2, tint = 0x2b2b2b): THREE.MeshStandardMaterial {
  return material(`metal-${repeat}-${tint}`, () => {
    const m = new THREE.MeshStandardMaterial({
      map: cloneRepeat(assetsRef.metal.map, repeat),
      normalMap: cloneRepeat(assetsRef.metal.normal, repeat),
      roughnessMap: cloneRepeat(assetsRef.metal.rough, repeat),
      color: tint,
      roughness: 0.55,
      metalness: 0.85,
      envMapIntensity: 1.1,
    });
    m.normalScale.set(0.8, 0.8);
    return m;
  }) as THREE.MeshStandardMaterial;
}

export function goldMaterial(): THREE.MeshStandardMaterial {
  return material('gold', () => new THREE.MeshStandardMaterial({
    color: 0xd4b25e,
    roughness: 0.24,
    metalness: 1,
    envMapIntensity: 1.3,
    emissive: 0x2a1f08,
    emissiveIntensity: 0.3,
  })) as THREE.MeshStandardMaterial;
}

export function emissiveMaterial(color: number, intensity = 2, opacity = 1): THREE.MeshBasicMaterial {
  return material(`emissive-${color}-${intensity}-${opacity}`, () => new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })) as THREE.MeshBasicMaterial;
}

export interface TerrainTint {
  grass: [number, number, number];
  rock: [number, number, number];
  sand: [number, number, number];
}

/**
 * The Cipher's ground is the same PBR set as any valley, tinted cold: a moss
 * grass, dusty violet rock, and near-black wet sand. The tints are uniforms so
 * the whole terrain can be re-graded without rebuilding the shader.
 */
export function makeTerrainMaterial(
  grass: Surface,
  rock: Surface,
  sand: Surface,
  tint: TerrainTint = {
    grass: [0.62, 0.82, 0.66],
    rock: [0.74, 0.7, 0.85],
    sand: [0.62, 0.6, 0.7],
  },
): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    map: grass.map,
    normalMap: grass.normal,
    roughnessMap: grass.rough,
    aoMap: grass.ao,
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0.0,
    envMapIntensity: 0.7,
  });
  m.normalScale.set(0.9, 0.9);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRockMap = { value: rock.map };
    shader.uniforms.uRockNormal = { value: rock.normal };
    shader.uniforms.uRockRough = { value: rock.rough };
    shader.uniforms.uSandMap = { value: sand.map };
    shader.uniforms.uSandNormal = { value: sand.normal };
    shader.uniforms.uWaterLine = { value: 8.0 };
    shader.uniforms.uGrassTint = { value: new THREE.Color(...tint.grass) };
    shader.uniforms.uRockTint = { value: new THREE.Color(...tint.rock) };
    shader.uniforms.uSandTint = { value: new THREE.Color(...tint.sand) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNormal;
        varying vec3 vViewWorld;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWNormal = normalize(mat3(modelMatrix) * objectNormal);
        vViewWorld = normalize(cameraPosition - vWPos);`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNormal;
        varying vec3 vViewWorld;
        uniform sampler2D uRockMap;
        uniform sampler2D uRockNormal;
        uniform sampler2D uRockRough;
        uniform sampler2D uSandMap;
        uniform sampler2D uSandNormal;
        uniform float uWaterLine;
        uniform vec3 uGrassTint;
        uniform vec3 uRockTint;
        uniform vec3 uSandTint;
        float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
        float vnoise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(hash21(i),hash21(i+vec2(1.0,0.0)),u.x),mix(hash21(i+vec2(0.0,1.0)),hash21(i+vec2(1.0,1.0)),u.x),u.y); }`)
      .replace('#include <map_fragment>', `
        float slope = 1.0 - clamp(vWNormal.y, 0.0, 1.0);
        float alt = smoothstep(48.0, 190.0, vWPos.y);
        float macro = vnoise(vWPos.xz * 0.0035) * 0.6 + vnoise(vWPos.xz * 0.011) * 0.4;
        // A slow, low-frequency mineral shift so the basin is not one flat
        // colour; it reads as lichen and dust rather than as a texture repeat.
        float mineral = vnoise(vWPos.xz * 0.0021 + 17.0);
        float rockMix = clamp(smoothstep(0.28, 0.66, slope) + alt * (0.35 + macro * 0.35), 0.0, 1.0);
        float shore = (1.0 - smoothstep(uWaterLine + 0.6, uWaterLine + 4.5, vWPos.y)) * (1.0 - smoothstep(0.7, 1.2, slope));
        vec2 uvA = vWPos.xz * 0.13;
        vec2 uvB = vWPos.xz * 0.019;
        vec3 grassA = texture2D(map, uvA).rgb;
        vec3 grassB = texture2D(map, uvB).rgb;
        vec3 grassCol = grassA * grassB * (0.72 + macro * 0.75);
        grassCol *= uGrassTint * (0.82 + mineral * 0.4);
        vec3 rockCol = texture2D(uRockMap, vWPos.xz * 0.085 + vWPos.y * 0.014).rgb;
        rockCol *= uRockTint * (0.7 + 0.45 * vnoise(vWPos.xz * 0.04));
        vec3 sandCol = texture2D(uSandMap, vWPos.xz * 0.12).rgb * uSandTint;
        diffuseColor.rgb *= mix(grassCol * 1.1, rockCol, rockMix);
        diffuseColor.rgb = mix(diffuseColor.rgb, sandCol * 1.05, shore * (1.0 - rockMix * 0.6));
      `)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = roughness;
        #ifdef USE_ROUGHNESSMAP
          vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
          roughnessFactor *= texelRoughness.g;
        #endif
        float roughSlope = 1.0 - clamp(vWNormal.y, 0.0, 1.0);
        roughnessFactor = mix(roughnessFactor, 0.97, smoothstep(0.25, 0.7, roughSlope));
      `)
      .replace('#include <normal_fragment_maps>', `
        #ifdef USE_NORMALMAP
          vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
          mapN.xy *= normalScale;
          // Add a second, world-space rock normal on the steep parts, so a cliff
          // is not grass detail stretched vertically.
          float rockSlope = smoothstep(0.3, 0.72, 1.0 - clamp(vWNormal.y, 0.0, 1.0));
          vec3 rockN = texture2D( uRockNormal, vWPos.xz * 0.06 + vWPos.y * 0.02 ).xyz * 2.0 - 1.0;
          mapN = normalize(mix(mapN, normalize(vec3(mapN.xy + rockN.xy * 0.55, mapN.z)), rockSlope));
          normal = normalize( tbn * mapN );
        #endif
      `);
    m.userData.shader = shader;
  };
  m.customProgramCacheKey = () => 'cipher-terrain-v1';
  return m;
}

export function waterMaterial(normalMap: THREE.Texture): THREE.MeshStandardMaterial {
  const map = normalMap.clone();
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(18, 18);
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    color: 0x070d24,
    roughness: 0.06,
    metalness: 0.45,
    normalMap: map,
    normalScale: new THREE.Vector2(0.55, 0.55),
    transparent: true,
    opacity: 0.82,
    envMapIntensity: 1.5,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

/** Set once in `loadWorld` so the material factories above stay free of globals. */
export let assetsRef: Assets;
export function installAssets(a: Assets) {
  assetsRef = a;
}

function material<T extends THREE.Material>(key: string, make: () => T): T {
  const hit = cache.get(key);
  if (hit) return hit as T;
  const m = make();
  cache.set(key, m);
  return m;
}

export function disposeMaterials() {
  for (const m of cache.values()) m.dispose();
  cache.clear();
}
