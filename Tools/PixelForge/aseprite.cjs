'use strict';
// Hand-drawn overrides through LibreSprite/Aseprite.
// SourceAssets/Aseprite/**/<sprite name>.ase replaces the code-drawn frames of that sprite when forge runs
// (same name, folder and manifest entry; frame size must match the code version so anchors stay valid).
//
//   node Tools/PixelForge/aseprite.cjs export <sprite name|regex>...   seed .ase files from the current PNGs
//   node Tools/PixelForge/aseprite.cjs list                            show the overrides forge will use
//
// Editor exe: env LIBRESPRITE, else the usual install folders below.
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');
const { Canvas, sharp } = require('./lib.cjs');

const ROOT = path.resolve(__dirname, '../..');
const ASE_DIR = path.join(ROOT, 'SourceAssets/Aseprite');
const OUT = path.join(ROOT, 'Game/Assets/_Project/Art/Resources/Pixel');

function editorExe() {
  const tries = [process.env.LIBRESPRITE, path.join(os.homedir(), 'Downloads/LibreSprite/libresprite.exe'),
    'C:/Program Files/LibreSprite/libresprite.exe', 'C:/Program Files/Aseprite/Aseprite.exe',
    'C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe'].filter(Boolean);
  const exe = tries.find(f => fs.existsSync(f));
  if (!exe) throw new Error('LibreSprite/Aseprite not found. Set LIBRESPRITE=<path to libresprite.exe>. Tried: ' + tries.join(', '));
  return exe;
}

// name -> .ase path, from every file under SourceAssets/Aseprite (any sub-folder layout).
function overrides() {
  const map = new Map();
  (function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, d.name);
      if (d.isDirectory()) walk(full);
      else if (/\.(ase|aseprite)$/i.test(d.name)) {
        const name = d.name.replace(/\.(ase|aseprite)$/i, '');
        if (map.has(name)) throw new Error('Two Aseprite files for ' + name + ': ' + map.get(name) + ', ' + full);
        map.set(name, full);
      }
    }
  })(ASE_DIR);
  return map;
}

// Flattens the visible layers with the editor's CLI, then slices the horizontal sheet back into frames.
async function readAse(file) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ww-ase-'));
  try {
    const sheet = path.join(tmp, 'sheet.png'), data = path.join(tmp, 'sheet.json');
    execFileSync(editorExe(), ['-b', file, '--sheet', sheet, '--sheet-type', 'horizontal', '--data', data, '--format', 'json-array'], { stdio: 'pipe' });
    const meta = JSON.parse(fs.readFileSync(data, 'utf8'));
    const { data: buf, info } = await sharp(sheet).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const frames = meta.frames.map(f => {
      const c = new Canvas(f.frame.w, f.frame.h);
      for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
        const i = ((f.frame.y + y) * info.width + f.frame.x + x) * 4;
        if (buf[i + 3]) c.px[y * c.w + x] = [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]];
      }
      return c;
    });
    const avg = meta.frames.reduce((a, f) => a + f.duration, 0) / meta.frames.length;
    return { frames, fps: Math.max(1, Math.round(1000 / avg)) };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// Minimal .ase writer (one RGBA layer, compressed cels), spec: github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md
function writeAse(file, frames, fps) {
  const { w, h } = frames[0], ms = Math.round(1000 / fps);
  const chunk = (type, body) => { const head = Buffer.alloc(6); head.writeUInt32LE(6 + body.length, 0); head.writeUInt16LE(type, 4); return Buffer.concat([head, body]); };
  const layerName = Buffer.from('art');
  const layer = Buffer.alloc(18 + layerName.length);
  layer.writeUInt16LE(3, 0);   // visible | editable
  layer.writeUInt8(255, 12);   // opacity
  layer.writeUInt16LE(layerName.length, 16); layerName.copy(layer, 18);
  const body = frames.map((f, i) => {
    const pixels = zlib.deflateSync(f.raw());
    const cel = Buffer.alloc(20); // layer 0, x 0, y 0, opacity, type 2 (compressed image), reserved, size
    cel.writeUInt8(255, 6); cel.writeUInt16LE(2, 7); cel.writeUInt16LE(w, 16); cel.writeUInt16LE(h, 18);
    const chunks = [...(i === 0 ? [chunk(0x2004, layer)] : []), chunk(0x2005, Buffer.concat([cel, pixels]))];
    const head = Buffer.alloc(16), size = 16 + chunks.reduce((a, c) => a + c.length, 0);
    head.writeUInt32LE(size, 0); head.writeUInt16LE(0xF1FA, 4); head.writeUInt16LE(chunks.length, 6);
    head.writeUInt16LE(ms, 8); head.writeUInt32LE(chunks.length, 12);
    return Buffer.concat([head, ...chunks]);
  });
  const header = Buffer.alloc(128), total = 128 + body.reduce((a, b) => a + b.length, 0);
  header.writeUInt32LE(total, 0); header.writeUInt16LE(0xA5E0, 4); header.writeUInt16LE(frames.length, 6);
  header.writeUInt16LE(w, 8); header.writeUInt16LE(h, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(1, 14);
  header.writeUInt16LE(ms, 18); header.writeUInt8(1, 34); header.writeUInt8(1, 35); // pixel ratio 1:1
  header.writeUInt16LE(16, 40); header.writeUInt16LE(16, 42); // 16 px grid = one base tile
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([header, ...body]));
}

async function loadPng(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const c = new Canvas(info.width, info.height);
  for (let i = 0; i < c.w * c.h; i++) if (data[i * 4 + 3]) c.px[i] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];
  return c;
}

// Seeds SourceAssets/Aseprite/<sprite folder>/<name>.ase from the generated PNGs; never overwrites hand art.
async function exportSprites(patterns) {
  const { sprites } = JSON.parse(fs.readFileSync(path.join(OUT, 'pixel-manifest.json'), 'utf8'));
  const res = patterns.map(p => new RegExp('^(' + p + ')$'));
  const picked = sprites.filter(s => res.some(r => r.test(s.name)));
  if (!picked.length) throw new Error('No sprite matches ' + patterns.join(' '));
  const existing = overrides();
  for (const s of picked) {
    if (existing.has(s.name)) { console.log('skip (already hand-drawn): ' + path.relative(ROOT, existing.get(s.name))); continue; }
    const frames = [];
    for (let i = 0; i < s.frames; i++) frames.push(await loadPng(path.join(OUT, s.path + '_' + i + '.png')));
    const file = path.join(ASE_DIR, s.path + '.ase');
    writeAse(file, frames, s.fps);
    console.log(`${path.relative(ROOT, file)}  (${s.frames} frames, ${s.width}x${s.height}, ${s.fps} fps)`);
  }
}

module.exports = { overrides, readAse, writeAse, editorExe };

if (require.main === module) {
  const [cmd, ...args] = process.argv.slice(2);
  const run = cmd === 'export' && args.length ? exportSprites(args)
    : cmd === 'list' ? Promise.resolve([...overrides()].forEach(([n, f]) => console.log(n.padEnd(36), path.relative(ROOT, f))))
    : Promise.reject(new Error('Usage: node Tools/PixelForge/aseprite.cjs export <name|regex>... | list'));
  run.catch(e => { console.error(e.message); process.exit(1); });
}
