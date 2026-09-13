#!/usr/bin/env node
/* 生成应用图标:深空星轨(金色四芒星 + 蓝色轨道环),纯 Node 无依赖 PNG 编码 */
'use strict';
const { deflateSync } = require('zlib');
const fs = require('fs');
const path = require('path');

/* ── PNG 编码 ── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePNG(file, w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
  console.log('✓', file, `${(png.length / 1024).toFixed(1)}KB`);
}

/* ── 颜色工具 ── */
const hex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const VOID = hex('#080E1D'), NEBULA = hex('#1E3566'), BLUE = hex('#6FA1FF'), GOLD = hex('#FFC24B'), WHITE = hex('#F5F9FF');
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = e0 => { const t = clamp01(e0); return t * t * (3 - 2 * t); };

/* 星空背景层 */
function bgPixel(x, y, S) {
  const cx = S * 0.5, cy = S * 0.46;
  const d = Math.hypot(x - cx, y - cy) / (S * 0.62);
  let c = mix(NEBULA, VOID, smooth(d * 1.15));
  // 左上一点蓝辉、右下一点暗紫
  const g1 = Math.exp(-((x - S * 0.26) ** 2 + (y - S * 0.2) ** 2) / (2 * (S * 0.3) ** 2));
  c = mix(c, BLUE, g1 * 0.12);
  const g2 = Math.exp(-((x - S * 0.78) ** 2 + (y - S * 0.84) ** 2) / (2 * (S * 0.28) ** 2));
  c = mix(c, hex('#3A2E5C'), g2 * 0.22);
  return c;
}

/* 固定星点(在背景层上) */
const STARS = [[0.16, 0.18, 1.0], [0.84, 0.24, 0.7], [0.24, 0.86, 0.55], [0.9, 0.62, 0.8], [0.62, 0.1, 0.5], [0.08, 0.52, 0.45]];
function starGlow(x, y, S, scale) {
  let add = 0;
  for (const [sx, sy, r] of STARS) {
    const d = Math.hypot(x - sx * S, y - sy * S);
    add += r * Math.exp(-((d / (S * 0.012 * scale)) ** 2));
  }
  return clamp01(add);
}

/* 四芒星形状:d<R 在数轴上更长、对角线内凹 */
function starD(dx, dy, L) {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const p = 0.42; // 越小越尖
  const tiny = 1e-9;
  return Math.pow(Math.pow(ax + tiny, p) + Math.pow(ay + tiny, p), 1 / p) - L;
}

/* 轨道环:旋转椭圆,返回到环线的近似距离(正=在外) */
function ringD(x, y, S) {
  const a = -18 * Math.PI / 180;
  const dx = x - S * 0.5, dy = y - S * 0.5;
  const rx = dx * Math.cos(a) - dy * Math.sin(a);
  const ry = dx * Math.sin(a) + dy * Math.cos(a);
  const R = Math.hypot(rx / (S * 0.355), ry / (S * 0.145));
  // 椭圆近似距离:归一化半径与 1 的差 × 局部尺度
  return (R - 1) * S * 0.10;
}

/* 绘制一帧(mode: full | bg | fg) */
function render(S, mode) {
  const rgba = Buffer.alloc(S * S * 4);
  const L = S * (mode === 'fg' ? 0.155 : 0.185); // 四芒星臂长
  const SS = mode === 'fg' ? 3 : 2;              // 超采样
  const hasBg = mode !== 'fg';
  const hasFg = mode !== 'bg';

  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const x = px + (sx + 0.5) / SS, y = py + (sy + 0.5) / SS;
        let c = hasBg ? bgPixel(x, y, S) : [0, 0, 0];
        let alpha = hasBg ? 1 : 0;

        if (hasBg) {
          const sg = starGlow(x, y, S, 1);
          if (sg > 0.01) { c = mix(c, WHITE, sg * 0.85); }
        }

        if (hasFg) {
          const dx = x - S * 0.5, dy = y - S * 0.475;
          // 轨道环(在星后面)
          const rd = ringD(x, y, S);
          const ringA = 1 - smooth(Math.abs(rd) / (S * 0.0085));
          if (ringA > 0) {
            const rc = mix(BLUE, WHITE, 0.18 * ringA);
            c = mix(c, rc, ringA * 0.9); alpha = Math.max(alpha, ringA * 0.9);
          }
          // 环上卫星(右下,金色小点 + 辉光)
          const satAng = 24 * Math.PI / 180;
          const sa = -18 * Math.PI / 180;
          const sox = Math.cos(satAng) * S * 0.355, soy = Math.sin(satAng) * S * 0.145;
          const sxx = sox * Math.cos(sa) - soy * Math.sin(sa) + S * 0.5;
          const syy = sox * Math.sin(sa) + soy * Math.cos(sa) + S * 0.5;
          const sd = Math.hypot(x - sxx, y - syy);
          const satA = 1 - smooth(sd / (S * 0.016));
          if (satA > 0) { c = mix(c, BLUE, satA); alpha = Math.max(alpha, satA); }
          const satGlow = Math.exp(-((sd / (S * 0.05)) ** 2)) * 0.5;
          if (satGlow > 0.01) { c = mix(c, BLUE, satGlow); alpha = Math.max(alpha, Math.min(1, satGlow * 1.6)); }

          // 四芒星 + 辉光
          const d = starD(dx, dy, L);
          const starA = 1 - smooth(d / (S * 0.0035));
          if (starA > 0) {
            const core = mix(GOLD, WHITE, clamp01(-d / (L * 0.35)) * 0.9);
            c = mix(c, core, starA); alpha = Math.max(alpha, starA);
          }
          const glow = Math.exp(-((Math.max(0, d) / (L * 0.85)) ** 2));
          if (glow > 0.01) {
            c = mix(c, GOLD, glow * 0.28); alpha = Math.max(alpha, Math.min(1, glow * 0.9));
          }
        }

        r += c[0] * alpha + (hasBg ? 0 : 0);
        g += c[1] * alpha;
        b += c[2] * alpha;
        a += alpha;
      }
      const n = SS * SS;
      const A = a / n;
      let R, G, B;
      if (A > 0.004) { R = r / n / A; G = g / n / A; B = b / n / A; } else { R = G = B = 0; }
      const i = (py * S + px) * 4;
      rgba[i] = clamp01(R / 255) * 255; rgba[i + 1] = clamp01(G / 255) * 255; rgba[i + 2] = clamp01(B / 255) * 255; rgba[i + 3] = Math.round(A * 255);
      // gamma-ish lift: premultiplied color div by alpha again → 用未除版本
      if (A > 0.004) { rgba[i] = Math.min(255, R); rgba[i + 1] = Math.min(255, G); rgba[i + 2] = Math.min(255, B); }
    }
  }
  return rgba;
}

const RES = path.join(__dirname, '..', 'app', 'res');
const dpi = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

for (const [d, size] of Object.entries(dpi)) {
  writePNG(path.join(RES, `mipmap-${d}`, 'ic_launcher.png'), size, size, render(size, 'full'));
  writePNG(path.join(RES, `mipmap-${d}`, 'ic_launcher_bg.png'), size * 2, size * 2, render(size * 2, 'bg'));
  writePNG(path.join(RES, `mipmap-${d}`, 'ic_launcher_fg.png'), size * 2, size * 2, render(size * 2, 'fg'));
}
writePNG(path.join(RES, 'icon-512.png'), 512, 512, render(512, 'full'));
console.log('全部图标生成完毕');
