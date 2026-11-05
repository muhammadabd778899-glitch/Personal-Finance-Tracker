// Generates the PWA raster icons from one deterministic vector description.
// Run with: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const TEAL = [31, 111, 92];
const TEAL_DARK = [23, 86, 71];
const CREAM = [246, 244, 239];

function roundRect(x, y, left, top, right, bottom, radius) {
  const cx = Math.max(left + radius, Math.min(x, right - radius));
  const cy = Math.max(top + radius, Math.min(y, bottom - radius));
  if (x < left || x > right || y < top || y > bottom) return false;
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function triangle(x, y, ax, ay, bx, by, cx, cy) {
  const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
  const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy);
  const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/** Returns [r,g,b,a] for a point in 0..1 design space. */
function sample(x, y, maskable) {
  const inset = maskable ? 0.1 : 0;
  const bg = maskable ? x >= 0 && x <= 1 && y >= 0 && y <= 1 : roundRect(x, y, 0, 0, 1, 1, 0.22);
  if (!bg) return [0, 0, 0, 0];

  const t = Math.max(0, Math.min(1, (y - inset) / (1 - inset * 2)));
  const base = TEAL.map((channel, index) =>
    Math.round(channel - (channel - TEAL_DARK[index]) * (1 - t) * 0.35),
  );

  const mx = (x - 0.5) / (1 - inset * 2) + 0.5;
  const my = (y - inset) / (1 - inset * 2);

  // Lighthouse tower.
  if (my >= 0.345 && my <= 0.705) {
    const progress = (my - 0.345) / (0.705 - 0.345);
    const halfWidth = 0.068 + progress * 0.058;
    if (Math.abs(mx - 0.5) <= halfWidth) {
      const band = (my >= 0.445 && my <= 0.485) || (my >= 0.565 && my <= 0.605) || my >= 0.688;
      return [...(band ? base : CREAM), 255];
    }
  }
  // Gallery deck.
  if (roundRect(mx, my, 0.375, 0.33, 0.625, 0.362, 0.012)) return [...CREAM, 255];
  // Lamp room.
  if (roundRect(mx, my, 0.425, 0.262, 0.575, 0.33, 0.012)) return [...CREAM, 255];
  // Roof.
  if (triangle(mx, my, 0.405, 0.262, 0.595, 0.262, 0.5, 0.2)) return [...CREAM, 255];
  // Light beam.
  if (roundRect(mx, my, 0.5, 0.286, 0.585, 0.302, 0.008)) return [...base, 255];
  // Base plinth.
  if (roundRect(mx, my, 0.29, 0.705, 0.71, 0.752, 0.018)) return [...CREAM, 255];
  // Water line.
  if (roundRect(mx, my, 0.2, 0.768, 0.8, 0.784, 0.008)) return [...CREAM, 255];

  return [...base, 255];
}

function render(size, maskable) {
  const samples = 3;
  const pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = (px + (sx + 0.5) / samples) / size;
          const y = (py + (sy + 0.5) / samples) / size;
          const [sr, sg, sb, sa] = sample(x, y, maskable);
          // Composite over the manifest background so edges stay clean.
          const alpha = sa / 255;
          r += sr * alpha + TEAL[0] * (1 - alpha);
          g += sg * alpha + TEAL[1] * (1 - alpha);
          b += sb * alpha + TEAL[2] * (1 - alpha);
          a += sa;
        }
      }
      const total = samples * samples;
      const offset = (py * size + px) * 4;
      pixels[offset] = Math.round(r / total);
      pixels[offset + 1] = Math.round(g / total);
      pixels[offset + 2] = Math.round(b / total);
      pixels[offset + 3] = Math.round(a / total);
    }
  }
  return encodePNG(size, size, pixels);
}

function crc32(buffer) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of buffer) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePNG(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync(join(outDir, 'icon-192.png'), render(192, false));
writeFileSync(join(outDir, 'icon-512.png'), render(512, false));
writeFileSync(join(outDir, 'icon-512-maskable.png'), render(512, true));
writeFileSync(join(root, 'public', 'apple-touch-icon.png'), render(180, false));
console.log('Wrote PWA icons to public/');
