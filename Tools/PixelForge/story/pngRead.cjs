'use strict';
// Synchronous PNG reader for the Blender G-buffer passes (forge builds sprites synchronously).
// Non-interlaced truecolour(+alpha) or grey, 8 or 16 bit. Returns channel values scaled to 0..1.
const fs = require('fs'), zlib = require('zlib');
function readPng(file) {
  const b = fs.readFileSync(file);
  let p = 8, w = 0, h = 0, depth = 8, ch = 4;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8];
      ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[d[9]];
      if (!ch || d[12] !== 0 || (depth !== 8 && depth !== 16)) throw new Error(`${file}: unsupported PNG (colour ${d[9]}, depth ${depth}, interlace ${d[12]})`);
    } else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = ch * depth / 8, stride = w * bpp;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[dst + x - bpp] : 0, up = y ? px[dst - stride + x] : 0, c = x >= bpp && y ? px[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const q = a + up - c, pa = Math.abs(q - a), pb = Math.abs(q - up), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      px[dst + x] = v & 255;
    }
  }
  const n = w * h * ch, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = depth === 16 ? px.readUInt16BE(i * 2) / 65535 : px[i] / 255;
  return { w, h, ch, data: out };
}
module.exports = { readPng };
