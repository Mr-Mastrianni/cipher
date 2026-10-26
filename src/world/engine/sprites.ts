/**
 * Text and glow in the world, drawn on canvases and billboarded.
 *
 * Canvas text keeps the realm free of a texture atlas and lets the labels use the
 * Syne / Space Mono pairing as the interface. Every sprite here is created once
 * and shared; nothing is redrawn per frame.
 */
import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();

/**
 * Resolve the app's display face for canvas text.
 *
 * next/font exposes the family through a CSS variable on <html>; canvas cannot
 * read a CSS variable directly, but it can read the computed value, which is the
 * real family list. The fallback keeps headless and pre-hydration captures sane.
 */
function displayFont(): string {
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-cinzel")
      .trim();
    if (value) return `${value}, 'Syne', Georgia, serif`;
  } catch {
    /* not in a browser context */
  }
  return "'Syne', Georgia, serif";
}

function italicFont(): string {
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-cinzel")
      .trim();
    if (value) return `${value}, 'Syne', Georgia, serif`;
  } catch {
    /* not in a browser context */
  }
  return "'Syne', Georgia, serif";
}

function canvasTexture(key: string, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, w = 512, h = 256): THREE.Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

export function textSprite(
  text: string,
  opts: { color?: string; sub?: string; size?: number; scale?: number; font?: string; align?: 'center' | 'left'; overlay?: boolean } = {},
): THREE.Sprite {
  const color = opts.color ?? '#f2e7cf';
  const size = opts.size ?? 54;
  const scale = opts.scale ?? 1;
  const font = opts.font ?? displayFont();
  const key = `text:${text}:${color}:${opts.sub ?? ''}:${size}:${font}:${opts.align ?? 'center'}`;
  const width = 1024;
  const height = opts.sub ? 260 : 160;
  const tex = canvasTexture(key, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.textAlign = opts.align ?? 'center';
    const x = opts.align === 'left' ? 40 : w / 2;
    g.font = `600 ${size}px ${font}`;
    g.shadowColor = 'rgba(0,0,0,0.8)';
    g.shadowBlur = 16;
    g.fillStyle = color;
    g.fillText(text, x, opts.sub ? 105 : 100);
    if (opts.sub) {
      g.shadowBlur = 8;
      g.font = `400 ${Math.round(size * 0.55)}px ${italicFont()}`;
      g.fillStyle = 'rgba(236,226,204,0.72)';
      g.fillText(opts.sub, x, 175);
    }
  }, width, height);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: !opts.overlay, toneMapped: false });
  const sprite = new THREE.Sprite(mat);
  const aspect = width / height;
  sprite.scale.set(8 * scale, (8 / aspect) * scale, 1);
  return sprite;
}

export function glyphSprite(glyph: string, color: string, scale = 1): THREE.Sprite {
  const key = `glyph:${glyph}:${color}`;
  const tex = canvasTexture(key, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '400 190px ' + italicFont();
    g.shadowColor = color;
    g.shadowBlur = 8;
    g.fillStyle = color;
    g.fillText(glyph, w / 2, h / 2 + 6);
  }, 256, 256);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(5 * scale, 5 * scale, 1);
  return sprite;
}

function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }
  const rgb = hex.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgb) return `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${alpha})`;
  return `rgba(255,220,160,${alpha})`;
}

export function glowSprite(color: string, scale = 1, opacity = 0.8): THREE.Sprite {
  const key = `glow:${color}`;
  const tex = canvasTexture(key, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.18, withAlpha(color, 1));
    grad.addColorStop(0.5, withAlpha(color, 0.36));
    grad.addColorStop(1, withAlpha(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  }, 256, 256);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

export function fireTexture(): THREE.Texture {
  return canvasTexture('fire', (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const grad = g.createRadialGradient(w / 2, h * 0.62, 2, w / 2, h * 0.62, w * 0.46);
    grad.addColorStop(0, 'rgba(255,246,210,0.95)');
    grad.addColorStop(0.22, 'rgba(255,190,90,0.9)');
    grad.addColorStop(0.55, 'rgba(255,110,40,0.5)');
    grad.addColorStop(0.8, 'rgba(120,30,10,0.16)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(w * 0.5, h * 0.08);
    g.bezierCurveTo(w * 0.76, h * 0.36, w * 0.86, h * 0.62, w * 0.5, h * 0.9);
    g.bezierCurveTo(w * 0.14, h * 0.62, w * 0.24, h * 0.36, w * 0.5, h * 0.08);
    g.fill();
  }, 256, 256);
}

export function cloudTexture(): THREE.Texture {
  return canvasTexture('cloud', (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = w * (0.15 + Math.random() * 0.7);
      const y = h * (0.35 + Math.random() * 0.3);
      const r = w * (0.08 + Math.random() * 0.16);
      const grad = g.createRadialGradient(x, y, 1, x, y, r);
      const a = 0.06 + Math.random() * 0.1;
      grad.addColorStop(0, `rgba(255,250,242,${a})`);
      grad.addColorStop(0.6, `rgba(238,232,224,${a * 0.5})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }, 512, 256);
}

export function starTexture(): THREE.Texture {
  return canvasTexture('star', (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(210,226,255,0.65)');
    grad.addColorStop(1, 'rgba(120,150,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  }, 64, 64);
}

export function screenTexture(lines: string[], accent = '#8fe3ff'): THREE.Texture {
  return canvasTexture(`screen:${lines.join('|')}:${accent}`, (g, w, h) => {
    g.fillStyle = 'rgba(4,10,14,0.94)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = accent;
    g.globalAlpha = 0.25;
    g.lineWidth = 2;
    g.strokeRect(12, 12, w - 24, h - 24);
    g.globalAlpha = 1;
    g.font = '400 34px ui-monospace, monospace';
    g.fillStyle = accent;
    lines.forEach((line, i) => {
      g.globalAlpha = i === 0 ? 1 : 0.66;
      g.fillText(line, 34, 74 + i * 48);
    });
    g.globalAlpha = 0.08;
    for (let y = 0; y < h; y += 4) {
      g.fillStyle = '#8fe3ff';
      g.fillRect(0, y, w, 1);
    }
  }, 768, 512);
}
