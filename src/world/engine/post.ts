/**
 * The cinematic end of the frame.
 *
 * A render that keeps its depth, analytic height fog integrated along each ray,
 * god rays that are occluded by real geometry, filmic bloom, tone mapping in
 * `OutputPass`, then a display-referred grade (split tone, S-curve, vignette,
 * grain, a little lens fringing) and SMAA last.
 *
 * The light shafts are gathered from the depth buffer rather than faked with a
 * screen-space flare: a monolith or a friend standing in front of the sun cuts a
 * shadow through them, which is what makes them read as light.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';

/** Draws the scene into a target with a readable depth texture, then copies on. */
export class DepthRenderPass extends Pass {
  target: THREE.WebGLRenderTarget;
  private quad: FullScreenQuad;
  constructor(public scene: THREE.Scene, public camera: THREE.Camera) {
    super();
    this.needsSwap = false;
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.target.depthTexture = new THREE.DepthTexture(1, 1);
    this.target.depthTexture.type = THREE.UnsignedIntType;
    const copy = new THREE.ShaderMaterial(CopyShader);
    copy.blending = THREE.NoBlending;
    copy.depthTest = false;
    copy.depthWrite = false;
    this.quad = new FullScreenQuad(copy);
  }
  get depthTexture() {
    return this.target.depthTexture;
  }
  setSize(width: number, height: number) {
    this.target.setSize(width, height);
  }
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    const autoClear = renderer.autoClear;
    renderer.autoClear = true;
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, this.camera);
    renderer.autoClear = autoClear;
    (this.quad.material as THREE.ShaderMaterial).uniforms.tDiffuse.value = this.target.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    this.quad.render(renderer);
  }
  dispose() {
    this.target.dispose();
    this.quad.dispose();
  }
}

const QUAD_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

const RECONSTRUCT = /* glsl */ `
  uniform sampler2D tDepth;
  uniform mat4 uProjInv;
  uniform mat4 uViewInv;
  vec3 worldAt(vec2 uv, float depth) {
    vec4 ndc = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec4 view = uProjInv * ndc;
    view /= view.w;
    return (uViewInv * view).xyz;
  }
`;

const HeightFogShader = {
  name: 'CircleHeightFog',
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uProjInv: { value: new THREE.Matrix4() },
    uViewInv: { value: new THREE.Matrix4() },
    uCamPos: { value: new THREE.Vector3() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uFogColour: { value: new THREE.Color(0x8b7860) },
    uSunGlow: { value: new THREE.Color(0xffcf8a) },
    uDensity: { value: 0.014 },
    uBase: { value: 0 },
    uFalloff: { value: 0.012 },
    uNoise: { value: 0.6 },
    uTime: { value: 0 },
    uScale: { value: 1 },
  },
  vertexShader: QUAD_VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uScale;
    uniform vec3 uCamPos;
    uniform vec3 uSunDir;
    uniform vec3 uFogColour;
    uniform vec3 uSunGlow;
    uniform float uDensity;
    uniform float uBase;
    uniform float uFalloff;
    uniform float uNoise;
    uniform float uTime;
    varying vec2 vUv;
    ${RECONSTRUCT}
    float fh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float fn(vec2 p){
      vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f);
      return mix(mix(fh(i),fh(i+vec2(1,0)),u.x),mix(fh(i+vec2(0,1)),fh(i+vec2(1,1)),u.x),u.y);
    }
    void main(){
      vec4 base = texture2D(tDiffuse, vUv);
      float depth = texture2D(tDepth, vUv).x;
      bool sky = depth >= 0.99999;
      vec3 far = worldAt(vUv, sky ? 0.9999 : depth);
      vec3 ray = far - uCamPos;
      float dist = sky ? 2400.0 : length(ray);
      vec3 rd = normalize(ray);
      float h0 = uCamPos.y - uBase;
      float b = uFalloff;
      float ry = abs(rd.y) < 1e-4 ? 1e-4 : rd.y;
      float amount = uDensity / b * exp(-h0 * b) * (1.0 - exp(-dist * ry * b)) / ry;
      amount = min(amount, uDensity * dist) * uScale;
      vec3 sampleAt = uCamPos + rd * min(dist, 220.0);
      float n = fn(sampleAt.xz * 0.011 + vec2(uTime * 0.008, uTime * 0.005)) * 0.62
              + fn(sampleAt.xz * 0.036 - vec2(uTime * 0.014, 0.0)) * 0.38;
      amount *= mix(1.0, 0.35 + n * 1.35, uNoise);
      if (sky) amount *= (1.0 - smoothstep(0.0, 0.16, rd.y)) * 0.12;
      float trans = exp(-max(amount, 0.0));
      float mu = max(dot(rd, normalize(uSunDir)), 0.0);
      vec3 light = uFogColour + uSunGlow * (pow(mu, 12.0) * 1.2 + pow(mu, 3.0) * 0.18);
      gl_FragColor = vec4(base.rgb * trans + light * (1.0 - trans), base.a);
    }
  `,
};

const GodRaysShader = {
  name: 'CircleGodRays',
  defines: { SAMPLES: 44 },
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uLight: { value: new THREE.Vector2(0.5, 0.5) },
    uAspect: { value: 1 },
    uStrength: { value: 0 },
    uDensity: { value: 0.82 },
    uDecay: { value: 0.962 },
    uWeight: { value: 0.55 },
    uColour: { value: new THREE.Color(0xffd9a0) },
  },
  vertexShader: QUAD_VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2 uLight;
    uniform float uAspect;
    uniform float uStrength;
    uniform float uDensity;
    uniform float uDecay;
    uniform float uWeight;
    uniform vec3 uColour;
    varying vec2 vUv;
    void main(){
      vec4 base = texture2D(tDiffuse, vUv);
      if (uStrength <= 0.0) { gl_FragColor = base; return; }
      vec2 delta = (vUv - uLight) * (uDensity / float(SAMPLES));
      vec2 uv = vUv;
      float illum = 1.0;
      float acc = 0.0;
      for (int i = 0; i < SAMPLES; i++) {
        uv -= delta;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
        float sky = step(0.99999, texture2D(tDepth, uv).x);
        vec2 d = (uv - uLight) * vec2(uAspect, 1.0);
        float near = exp(-dot(d, d) * 22.0);
        acc += sky * near * illum * uWeight;
        illum *= uDecay;
      }
      gl_FragColor = vec4(base.rgb + uColour * acc * uStrength / float(SAMPLES) * 7.0, base.a);
    }
  `,
};

const GradeShader = {
  name: 'CircleGrade',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uSaturation: { value: 1.1 },
    uContrast: { value: 0.34 },
    uShadowTint: { value: new THREE.Vector3(0.006, 0.012, 0.02) },
    uHighlightTint: { value: new THREE.Vector3(0.035, 0.022, 0.004) },
    uVignette: { value: 0.5 },
    uGrain: { value: 0.022 },
    uAberration: { value: 0.0025 },
  },
  vertexShader: QUAD_VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uSaturation;
    uniform float uContrast;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAberration;
    varying vec2 vUv;
    float hash(vec2 p){ p=fract(p*vec2(443.897,441.423)); p+=dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }
    void main(){
      vec2 d = vUv - 0.5;
      vec2 off = d * dot(d,d) * uAberration;
      vec3 c = vec3(
        texture2D(tDiffuse, vUv - off).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv + off).b
      );
      float l = dot(c, vec3(0.2126,0.7152,0.0722));
      c = mix(vec3(l), c, uSaturation);
      c += uShadowTint * (1.0 - smoothstep(0.0,0.45,l));
      c += uHighlightTint * smoothstep(0.55,1.0,l);
      c = clamp(c,0.0,1.0);
      c = mix(c, c*c*(3.0-2.0*c), uContrast);
      vec2 dv = d * vec2(uResolution.x/uResolution.y, 1.0);
      c *= mix(1.0, smoothstep(1.08,0.28,length(dv)), uVignette);
      float g = hash(vUv*uResolution + fract(uTime*7.31)*113.0) - 0.5;
      c += g * uGrain * (1.0 - abs(l-0.5));
      gl_FragColor = vec4(c,1.0);
    }
  `,
};

export type PostQuality = 'high' | 'balanced' | 'low';

export class PostFX {
  composer: EffectComposer;
  depthPass: DepthRenderPass;
  fogPass: ShaderPass;
  raysPass: ShaderPass;
  bloomPass: UnrealBloomPass;
  outputPass: OutputPass;
  gradePass: ShaderPass;
  smaaPass: SMAAPass;
  private width = 1;
  private height = 1;
  private quality: PostQuality = 'high';
  private sunScreen = new THREE.Vector2(0.5, 0.5);
  private tmp = new THREE.Vector3();
  private exposure = 1;

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private camera: THREE.PerspectiveCamera, quality: PostQuality) {
    this.composer = new EffectComposer(renderer);
    this.depthPass = new DepthRenderPass(scene, camera);
    this.composer.addPass(this.depthPass);

    this.fogPass = new ShaderPass(HeightFogShader);
    this.fogPass.uniforms.tDepth.value = this.depthPass.depthTexture;
    this.composer.addPass(this.fogPass);

    this.raysPass = new ShaderPass(GodRaysShader);
    this.raysPass.uniforms.tDepth.value = this.depthPass.depthTexture;
    this.composer.addPass(this.raysPass);

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.7, 0.92);
    this.composer.addPass(this.bloomPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this.gradePass = new ShaderPass(GradeShader);
    this.composer.addPass(this.gradePass);

    this.smaaPass = new SMAAPass();
    this.composer.addPass(this.smaaPass);

    this.setQuality(quality);
  }

  setQuality(quality: PostQuality) {
    this.quality = quality;
    const high = quality === 'high';
    const low = quality === 'low';
    this.bloomPass.enabled = true;
    this.bloomPass.strength = high ? 0.5 : low ? 0.3 : 0.4;
    this.bloomPass.radius = high ? 0.75 : 0.6;
    this.bloomPass.threshold = low ? 0.95 : 0.9;
    this.fogPass.enabled = !low;
    this.raysPass.enabled = !low;
    this.gradePass.enabled = true;
    this.smaaPass.enabled = quality !== 'high' ? true : true;
    this.gradePass.uniforms.uGrain.value = low ? 0.014 : 0.028;

  }

  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1 : 1.6));
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(width, height);
    this.gradePass.uniforms.uResolution.value.set(width, height);
  }

  /** The sun's place on screen, 0..1, if it is in front of the camera. */
  private updateSun(sunDir: THREE.Vector3) {
    this.tmp.copy(this.camera.position).addScaledVector(sunDir, 3000);
    this.tmp.project(this.camera);
    const onScreen = this.tmp.z < 1 && Math.abs(this.tmp.x) < 1.35 && Math.abs(this.tmp.y) < 1.35;
    this.sunScreen.set(this.tmp.x * 0.5 + 0.5, this.tmp.y * 0.5 + 0.5);
    const facing = new THREE.Vector3();
    this.camera.getWorldDirection(facing);
    const dot = facing.dot(sunDir);
    const strength = onScreen ? Math.max(0, (dot - 0.1) / 0.9) * 0.9 : 0;
    return strength;
  }

  update(time: number, sunDir: THREE.Vector3, space: number, settings: { fog: boolean; rays: boolean }) {
    const camPos = this.camera.position;
    this.camera.updateMatrixWorld();
    for (const pass of [this.fogPass, this.raysPass]) {
      const u = pass.uniforms;
      if (u.uProjInv) u.uProjInv.value.copy(this.camera.projectionMatrixInverse);
      if (u.uViewInv) u.uViewInv.value.copy(this.camera.matrixWorld);
      if (u.uCamPos) u.uCamPos.value.copy(camPos);
      if (u.uSunDir) u.uSunDir.value.copy(sunDir);
      if (u.uTime) u.uTime.value = time;
      if (u.uScale) u.uScale.value = THREE.MathUtils.smoothstep(camPos.y, -40, 30) * (1 - space);
    }
    const fog = this.fogPass.uniforms;
    fog.uDensity.value = 0.0033 * (1 - space * 0.9);
    fog.uNoise.value = 0.5;
    fog.uFogColour.value.setRGB(0.028, 0.024, 0.022);
    fog.uSunGlow.value.setRGB(0.16, 0.1, 0.045);
    fog.uBase.value = 0;
    fog.uFalloff.value = 0.024;

    const strength = settings.rays ? this.updateSun(sunDir) : 0;
    const rays = this.raysPass.uniforms;
    rays.uLight.value.copy(this.sunScreen);
    rays.uAspect.value = this.width / Math.max(1, this.height);
    rays.uStrength.value = strength * (1 - space) * 0.34;
    rays.uColour.value.setRGB(1.0, 0.78, 0.48);

    this.gradePass.uniforms.uTime.value = time;
    this.gradePass.uniforms.uVignette.value = 0.3 + space * 0.24;
    this.gradePass.uniforms.uAberration.value = 0.0025 + space * 0.002;

    this.fogPass.enabled = settings.fog && this.quality !== 'low' && space < 0.25;
    this.raysPass.enabled = settings.rays && this.quality !== 'low' && space < 0.2;
    this.fogPass.uniforms.uScale.value *= Math.max(0, 1 - space * 3);
  }

  setExposure(v: number) {
    this.exposure = v;
    this.renderer.toneMappingExposure = v;
  }

  render(dt: number) {
    this.composer.render(dt);
  }

  dispose() {
    this.composer.dispose();
  }
}
