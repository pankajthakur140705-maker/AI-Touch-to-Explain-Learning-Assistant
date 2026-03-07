/**
 * Icon Generator Script
 * 
 * Creates simple PNG icons for the Chrome Extension.
 * Run: node generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Minimal PNG generator — creates a colored square with transparency support
function createPNG(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = createChunk('IHDR', (() => {
    const data = Buffer.alloc(13);
    data.writeUInt32BE(width, 0);
    data.writeUInt32BE(height, 4);
    data[8] = 8;  // bit depth
    data[9] = 2;  // color type (RGB)
    data[10] = 0; // compression
    data[11] = 0; // filter
    data[12] = 0; // interlace
    return data;
  })());

  // IDAT chunk — raw image data
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte (none)
    for (let x = 0; x < width; x++) {
      // Create a gradient effect with rounded corners look
      const cx = width / 2, cy = height / 2;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const maxDist = Math.min(width, height) / 2;
      const inCircle = dist < maxDist * 0.85;

      if (inCircle) {
        // Slight gradient for depth effect
        const factor = 1 - (dist / maxDist) * 0.15;
        rawData.push(Math.floor(r * factor));
        rawData.push(Math.floor(g * factor));
        rawData.push(Math.floor(b * factor));
      } else {
        // Background — light gray
        rawData.push(240);
        rawData.push(240);
        rawData.push(240);
      }
    }
  }

  // Simple DEFLATE compression (store blocks)
  const uncompressed = Buffer.from(rawData);
  const compressed = deflateStore(uncompressed);

  const idat = createChunk('IDAT', compressed);

  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function deflateStore(data) {
  // Zlib header + store blocks
  const blocks = [];
  blocks.push(Buffer.from([0x78, 0x01])); // Zlib header (deflate, no compression)

  const BLOCK_SIZE = 65535;
  for (let i = 0; i < data.length; i += BLOCK_SIZE) {
    const isLast = (i + BLOCK_SIZE >= data.length);
    const block = data.slice(i, i + BLOCK_SIZE);
    const header = Buffer.alloc(5);
    header[0] = isLast ? 0x01 : 0x00;
    header.writeUInt16LE(block.length, 1);
    header.writeUInt16LE(block.length ^ 0xFFFF, 3);
    blocks.push(header);
    blocks.push(block);
  }

  // Adler-32 checksum
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  const adler = Buffer.alloc(4);
  adler[0] = (b >> 8) & 0xFF;
  adler[1] = b & 0xFF;
  adler[2] = (a >> 8) & 0xFF;
  adler[3] = a & 0xFF;
  blocks.push(adler);

  return Buffer.concat(blocks);
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc >>>= 1;
      }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate icons
const iconsDir = path.join(__dirname, 'extension', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Purple/blue brand color
const R = 99, G = 102, B = 241;

const sizes = [16, 48, 128];
for (const size of sizes) {
  const png = createPNG(size, size, R, G, B);
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Created ${filePath} (${png.length} bytes)`);
}

console.log('Icons generated successfully!');
