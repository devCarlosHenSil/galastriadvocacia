/**
 * The intrinsic dimensions of the images, read from the file at build time.
 *
 * The WordPress rendered `<img width="…" height="…">`; the attributes avoid
 * the layout shift and are part of the DOM contract of the original site.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cache = new Map<string, { width: number; height: number }>();

/**
 * @param {string} buffer the first bytes of the file
 * @returns {{width: number, height: number} | null}
 */
function pngSize(buffer: Buffer) {
  if (buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/**
 * @param {Buffer} buffer the whole file
 * @returns {{width: number, height: number} | null}
 */
function jpegSize(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buffer[offset + 1];
    // SOF0…SOF15, except the DHT / JPG / DAC markers.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  return null;
}

/**
 * @param {string} content the content of an SVG file
 * @returns {{width: number, height: number} | null}
 */
function svgSize(content: string) {
  const viewBox = /viewBox\s*=\s*"([^"]+)"/.exec(content);
  if (viewBox) {
    const [, , width, height] = viewBox[1].split(/[\s,]+/).map(Number);
    if (width > 0 && height > 0) return { width: Math.round(width), height: Math.round(height) };
  }
  const width = /\bwidth\s*=\s*"(\d+(?:\.\d+)?)/.exec(content);
  const height = /\bheight\s*=\s*"(\d+(?:\.\d+)?)/.exec(content);
  if (width && height) return { width: Math.round(Number(width[1])), height: Math.round(Number(height[1])) };
  return null;
}

/**
 * The intrinsic dimensions of a public image.
 * @param {string} url the public URL of the image
 * @returns {{width: number, height: number} | null}
 */
export function imageSize(url: string): { width: number; height: number } | null {
  if (typeof url !== 'string' || !url.startsWith('/')) return null;
  const cached = cache.get(url);
  if (cached !== undefined) return cached;
  const file = join(process.cwd(), 'public', ...url.split('/').filter(Boolean));
  let size: { width: number; height: number } | null = null;
  try {
    if (url.endsWith('.svg')) {
      size = svgSize(readFileSync(file, 'utf8'));
    } else {
      const buffer = readFileSync(file);
      size = pngSize(buffer) ?? jpegSize(buffer);
    }
  } catch {
    size = null;
  }
  cache.set(url, size ?? { width: 0, height: 0 });
  return size;
}
