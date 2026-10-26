/**
 * The other members, as bodies rather than dots.
 *
 * Three silhouettes, one grammar: a Cloaked traveller with a coloured hem, a
 * Luminous core in two rings, and a robed Wanderer with a staff. Each carries a
 * crest, a name tag and a ring of light at the feet — enough to recognise
 * someone in the fog without a minimap, and nothing so detailed that it competes
 * with the valley.
 */

import * as THREE from "three";
import type { Identity, RemotePlayer } from "../state";

function bodyMaterial(color: number, rough = 0.8, metal = 0.12) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: metal,
    envMapIntensity: 0.5,
  });
}

function trimMaterial(hex: string) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(hex),
    toneMapped: false,
  });
}

function softTrim(hex: string) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(hex),
    transparent: true,
    opacity: 0.26,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

function nameSprite(name: string, color: string, crest: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 144;
  const g = canvas.getContext("2d")!;
  g.clearRect(0, 0, 640, 144);
  g.font = "500 42px ui-sans-serif, system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = "rgba(0,0,0,0.75)";
  g.shadowBlur = 14;
  g.fillStyle = "rgba(7,3,18,0.62)";
  const textWidth = g.measureText(name).width;
  const w = Math.min(600, textWidth + 132);
  g.beginPath();
  g.roundRect((640 - w) / 2, 32, w, 80, 40);
  g.fill();
  g.shadowBlur = 0;
  g.strokeStyle = color;
  g.lineWidth = 2;
  g.globalAlpha = 0.7;
  g.stroke();
  g.globalAlpha = 1;
  g.fillStyle = color;
  g.font = "400 40px ui-serif, Georgia, serif";
  g.fillText(crest, 640 / 2 - textWidth / 2 - 34, 74);
  g.font = "500 42px ui-sans-serif, system-ui, sans-serif";
  g.fillStyle = "#f4f1ff";
  g.fillText(name, 640 / 2 + 16, 74);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(3.4, 0.77, 1);
  sprite.renderOrder = 20;
  return sprite;
}

type Form = "cloak" | "orb" | "wanderer";

export class MemberAvatar {
  group = new THREE.Group();
  body = new THREE.Group();
  private ring: THREE.Mesh;
  private glow: THREE.PointLight;
  private sprite: THREE.Sprite | null = null;
  private target = new THREE.Vector3();
  private targetYaw = 0;
  private walkPhase = 0;
  private moveSpeed = 0;
  private flying = false;
  private idle = Math.random() * 10;
  private form: Form;
  private parts: {
    leftLeg?: THREE.Mesh;
    rightLeg?: THREE.Mesh;
    leftArm?: THREE.Mesh;
    rightArm?: THREE.Mesh;
    core?: THREE.Mesh;
    ringA?: THREE.Mesh;
    ringB?: THREE.Mesh;
    staff?: THREE.Mesh;
    shards?: THREE.Mesh[];
  } = {};

  constructor(
    public id: string,
    name: string,
    color: string,
    form: Form = "cloak",
    crest = "\u2726",
    private self = false,
  ) {
    this.form = form;
    const tint = new THREE.Color(color);
    const cloth = bodyMaterial(0x15132a, 0.82, 0.1);
    const clothLight = bodyMaterial(0x23203c, 0.7, 0.18);
    const trim = trimMaterial(color);
    const soft = softTrim(color);

    if (form === "orb") {
      this.buildOrb(tint, trim, soft);
    } else if (form === "wanderer") {
      this.buildWanderer(cloth, clothLight, trim, soft);
    } else {
      this.buildCloak(cloth, clothLight, trim, soft);
    }

    const crestSprite = this.crestSprite(crest, color);
    crestSprite.position.y = form === "orb" ? 1.85 : 2.55;
    this.body.add(crestSprite);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.74, 48),
      new THREE.MeshBasicMaterial({
        color: tint,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.04;
    this.group.add(this.body, this.ring);

    this.glow = new THREE.PointLight(tint, self ? 0 : 2.2, 8, 2);
    this.glow.position.y = 1.4;
    this.group.add(this.glow);

    if (!self) {
      this.sprite = nameSprite(name, color, crest);
      this.sprite.position.y = 2.85;
      this.group.add(this.sprite);
    }

    this.group.position.set(0, 0, 36);
  }

  private crestSprite(glyph: string, color: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const g = canvas.getContext("2d")!;
    g.clearRect(0, 0, 128, 128);
    g.font = "400 92px ui-serif, Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.shadowColor = color;
    g.shadowBlur = 16;
    g.fillStyle = color;
    g.fillText(glyph, 64, 70);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    sprite.scale.set(0.42, 0.42, 1);
    return sprite;
  }

  private buildCloak(
    cloth: THREE.Material,
    clothLight: THREE.Material,
    trim: THREE.Material,
    soft: THREE.Material,
  ) {
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.72, 6, 12), cloth);
    torso.position.y = 1.12;
    torso.castShadow = true;
    this.body.add(torso);

    const hem = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.15, 14, 1, true), clothLight);
    hem.position.y = 0.62;
    hem.castShadow = true;
    this.body.add(hem);

    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 20), trim);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 1.02;
    this.body.add(belt);

    const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), clothLight);
    shoulders.scale.set(1.25, 0.55, 0.9);
    shoulders.position.y = 1.52;
    this.body.add(shoulders);

    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.52, 14), cloth);
    hood.position.y = 1.94;
    hood.castShadow = true;
    this.body.add(hood);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 16, 12),
      bodyMaterial(0x6b4a37, 0.6, 0.05),
    );
    head.position.y = 1.82;
    this.body.add(head);

    const eyeGeo = new THREE.SphereGeometry(0.025, 6, 6);
    const eyeMat = trimMaterial("#d4ff3f");
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0.06, 1.84, 0.17);
    this.body.add(eye);
    const eye2 = eye.clone();
    eye2.position.x = -0.06;
    this.body.add(eye2);

    this.parts.leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.58, 4, 8), cloth);
    this.parts.leftArm.position.set(0.4, 1.38, 0);
    this.parts.leftArm.rotation.z = -0.12;
    this.parts.rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.58, 4, 8), cloth);
    this.parts.rightArm.position.set(-0.4, 1.38, 0);
    this.parts.rightArm.rotation.z = 0.12;
    this.body.add(this.parts.leftArm, this.parts.rightArm);

    this.parts.leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.66, 4, 8), clothLight);
    this.parts.leftLeg.position.set(0.15, 0.42, 0);
    this.parts.rightLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.66, 4, 8), clothLight);
    this.parts.rightLeg.position.set(-0.15, 0.42, 0);
    this.body.add(this.parts.leftLeg, this.parts.rightLeg);

    const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2, 1, 4), cloth);
    cape.position.set(0, 1.15, -0.3);
    cape.rotation.x = -0.18;
    this.body.add(cape);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 1.6, 12, 1, true), soft);
    rim.position.y = 1.1;
    this.body.add(rim);
  }

  private buildOrb(tint: THREE.Color, trim: THREE.Material, soft: THREE.Material) {
    this.parts.core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.46, 1),
      new THREE.MeshStandardMaterial({
        color: tint,
        roughness: 0.18,
        metalness: 0.5,
        emissive: tint,
        emissiveIntensity: 0.9,
      }),
    );
    this.parts.core.position.y = 1.15;
    this.body.add(this.parts.core);

    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.62, 1),
      new THREE.MeshBasicMaterial({
        color: tint,
        wireframe: true,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    shell.position.y = 1.15;
    this.body.add(shell);

    this.parts.ringA = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.018, 6, 64), trim);
    this.parts.ringA.position.y = 1.15;
    this.parts.ringA.rotation.x = Math.PI / 2.4;
    this.body.add(this.parts.ringA);

    this.parts.ringB = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.012, 6, 64), soft);
    this.parts.ringB.position.y = 1.15;
    this.parts.ringB.rotation.x = Math.PI / 1.6;
    this.parts.ringB.rotation.z = 0.5;
    this.body.add(this.parts.ringB);

    this.parts.shards = [];
    for (let i = 0; i < 6; i++) {
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.06 + (i % 2) * 0.025, 0),
        trim,
      );
      shard.userData.phase = (i / 6) * Math.PI * 2;
      this.body.add(shard);
      this.parts.shards.push(shard);
    }
  }

  private buildWanderer(
    cloth: THREE.Material,
    clothLight: THREE.Material,
    trim: THREE.Material,
    soft: THREE.Material,
  ) {
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.72, 1.7, 16, 1), cloth);
    robe.position.y = 0.9;
    robe.castShadow = true;
    this.body.add(robe);

    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.03, 6, 32), trim);
    hem.rotation.x = Math.PI / 2;
    hem.position.y = 0.08;
    this.body.add(hem);

    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 6, 12), clothLight);
    chest.position.y = 1.62;
    this.body.add(chest);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 16, 12),
      bodyMaterial(0x6b4a37, 0.6, 0.05),
    );
    head.position.y = 2.02;
    this.body.add(head);

    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.66),
      cloth,
    );
    hood.position.y = 2.06;
    this.body.add(hood);

    const sash = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 6, 28), soft);
    sash.rotation.x = Math.PI / 2;
    sash.position.y = 1.4;
    this.body.add(sash);

    this.parts.leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.56, 4, 8), cloth);
    this.parts.leftArm.position.set(0.34, 1.6, 0);
    this.parts.rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.56, 4, 8), cloth);
    this.parts.rightArm.position.set(-0.34, 1.6, 0);
    this.body.add(this.parts.leftArm, this.parts.rightArm);

    this.parts.staff = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.9, 8), clothLight);
    this.parts.staff.position.set(0.52, 1.45, 0.12);
    this.parts.staff.rotation.z = -0.06;
    this.body.add(this.parts.staff);

    const staffTip = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), trim);
    staffTip.position.set(0.6, 2.92, 0.12);
    this.body.add(staffTip);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.72, 1.7, 16, 1, true), soft);
    rim.position.y = 0.9;
    this.body.add(rim);
  }

  update(player: RemotePlayer, dt: number, camera: THREE.Camera) {
    this.target.set(player.x, player.y, player.z);
    this.targetYaw = player.yaw;
    this.flying = player.mode === "fly";
    const dx = this.target.x - this.group.position.x;
    const dy = this.target.y - this.group.position.y;
    const dz = this.target.z - this.group.position.z;
    const dist = Math.hypot(dx, dy, dz);
    const lerp = 1 - Math.exp(-dt * (dist > 30 ? 12 : 16));
    this.group.position.lerp(this.target, lerp);

    const yaw = dist > 0.35 ? Math.atan2(dx, dz) : this.targetYaw + Math.PI;
    this.group.rotation.y += shortest(this.group.rotation.y, yaw) * Math.min(1, dt * 8);

    this.moveSpeed +=
      (Math.min(dist / Math.max(dt, 0.001), 30) - this.moveSpeed) * Math.min(1, dt * 5);
    this.idle += dt;

    if (this.form === "orb") {
      this.body.position.y = Math.sin(this.idle * 1.7) * 0.12 + (this.flying ? 0.2 : 0);
      if (this.parts.ringA) this.parts.ringA.rotation.z += dt * 0.9;
      if (this.parts.ringB) this.parts.ringB.rotation.y += dt * 0.7;
      this.parts.shards?.forEach((shard, i) => {
        const a = this.idle * 0.8 + (shard.userData.phase as number);
        const r = 0.9 + Math.sin(this.idle + i) * 0.08;
        shard.position.set(Math.cos(a) * r, 1.15 + Math.sin(a * 1.4 + i) * 0.4, Math.sin(a) * r);
        shard.rotation.y += dt * 1.2;
      });
      if (this.parts.core) this.parts.core.rotation.y += dt * 0.5;
      this.ring.position.y = this.flying ? -0.4 : 0.04;
      return;
    }

    if (this.flying) {
      this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, -0.42, Math.min(1, dt * 5));
      this.body.position.y = Math.sin(this.idle * 2.1) * 0.08;
      if (this.parts.leftArm) this.parts.leftArm.rotation.z = -1.15;
      if (this.parts.rightArm) this.parts.rightArm.rotation.z = 1.15;
      if (this.parts.leftLeg) this.parts.leftLeg.rotation.x = 0.32;
      if (this.parts.rightLeg) this.parts.rightLeg.rotation.x = 0.32;
      this.ring.position.y = -0.55;
    } else {
      this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, 0, Math.min(1, dt * 8));
      this.body.position.y = 0;
      this.walkPhase += dt * (2.2 + this.moveSpeed * 0.55);
      const swing = Math.min(1, this.moveSpeed / 4) * 0.6;
      if (this.parts.leftLeg) this.parts.leftLeg.rotation.x = Math.sin(this.walkPhase) * swing;
      if (this.parts.rightLeg) this.parts.rightLeg.rotation.x = -Math.sin(this.walkPhase) * swing;
      if (this.parts.leftArm) {
        this.parts.leftArm.rotation.x = -Math.sin(this.walkPhase) * swing * 0.7;
        this.parts.leftArm.rotation.z = -0.12;
      }
      if (this.parts.rightArm) {
        this.parts.rightArm.rotation.x = Math.sin(this.walkPhase) * swing * 0.7;
        this.parts.rightArm.rotation.z = 0.12;
      }
      this.ring.position.y = 0.04;
    }

    if (this.sprite) {
      const camDist = camera.position.distanceTo(this.group.position);
      const s = THREE.MathUtils.clamp(camDist / 22, 0.75, 2.4);
      this.sprite.scale.set(3.4 * s, 0.77 * s, 1);
      (this.sprite.material as THREE.SpriteMaterial).opacity = camDist > 240 ? 0 : 1;
    }
    this.ring.rotation.z += dt * 0.4;
  }

  dispose() {
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat.dispose();
      }
      if ((o as THREE.Sprite).isSprite) {
        const sp = o as THREE.Sprite;
        (sp.material as THREE.SpriteMaterial).map?.dispose();
        (sp.material as THREE.Material).dispose();
      }
    });
    this.sprite?.parent?.remove(this.sprite);
  }
}

function shortest(from: number, to: number) {
  let d = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class AvatarField {
  private avatars = new Map<string, MemberAvatar>();
  private self: MemberAvatar | null = null;
  private selfKey = "";

  constructor(private scene: THREE.Scene) {}

  update(players: RemotePlayer[], selfId: string, camera: THREE.Camera, dt: number) {
    const seen = new Set<string>();
    for (const p of players) {
      if (p.id === selfId) continue;
      seen.add(p.id);
      let a = this.avatars.get(p.id);
      if (!a) {
        a = new MemberAvatar(p.id, p.name, p.color, p.form, p.crest);
        this.avatars.set(p.id, a);
        this.scene.add(a.group);
      }
      a.update(p, dt, camera);
    }
    for (const [id, a] of this.avatars) {
      if (!seen.has(id)) {
        this.scene.remove(a.group);
        a.dispose();
        this.avatars.delete(id);
      }
    }
  }

  /** Third-person body. Rebuilt only when the appearance changes. */
  updateSelf(
    identity: Identity,
    position: THREE.Vector3,
    yaw: number,
    mode: "walk" | "fly",
    dt: number,
    camera: THREE.Camera,
    visible: boolean,
  ) {
    const key = `${identity.color}:${identity.form}:${identity.crest}`;
    if (!this.self || key !== this.selfKey) {
      if (this.self) {
        this.scene.remove(this.self.group);
        this.self.dispose();
      }
      this.self = new MemberAvatar("self", identity.name, identity.color, identity.form, identity.crest, true);
      this.selfKey = key;
      this.scene.add(this.self.group);
    }
    this.self.group.visible = visible;
    this.self.group.position.copy(position);
    this.self.group.rotation.y = yaw + Math.PI;
    const player: RemotePlayer = {
      id: "self",
      name: identity.name,
      color: identity.color,
      form: identity.form,
      crest: identity.crest,
      x: position.x,
      y: position.y,
      z: position.z,
      yaw,
      pitch: 0,
      mode,
      at: Date.now(),
    };
    this.self.update(player, dt, camera);
  }

  dispose() {
    for (const a of this.avatars.values()) {
      this.scene.remove(a.group);
      a.dispose();
    }
    this.avatars.clear();
    if (this.self) {
      this.scene.remove(this.self.group);
      this.self.dispose();
      this.self = null;
    }
  }
}
