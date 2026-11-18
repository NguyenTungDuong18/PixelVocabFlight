'use strict';
// node Tools/PixelForge/cinema/film.cjs [options]
// Renders the title cinematic (shots.cjs) frame by frame on all cores and packs it for the game:
//   Game/Assets/_Project/Art/Resources/Cinema/title_intro.bytes   (format WWC2, played by Unity/Menu/TitleScene)
// Options: --frames a-b   only these frames (no pack)        --step n     every n-th frame
//          --sheet dir    contact sheets (3 x 4 frames, 1:1)  --png dir    single frames at 2x
//          --jobs n       worker threads (default: cores - 2)
// WWC2, little-endian: 'WWC2', u16 width, height, fps, frameCount, loopStart, paletteCount, cueCount;
// palette (3 bytes each); cues, 6 bytes each, sorted by frame, all before loopStart:
//   u8 kind (shots.cjs KIND), u16 frame, i8 pan (-100 left edge .. +100 right edge), u8 level (0-200, 100 = normal), u8 dur (frames, 0 = default of the kind);
// (frameCount + 1) u32 offsets into the data block; data: per frame raw DEFLATE of width x height palette indices, rows top to bottom.
// (WWC1 was the same with 3-byte cues: u8 kind, u16 frame.)
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const C = require('./core.cjs'), S = require('./sky.cjs'), Mo = require('./models.cjs'), Me = require('./mesh.cjs'), Fx = require('./fx.cjs'), Po = require('./post.cjs'), Shots = require('./shots.cjs'), Cl = require('./clouds.cjs');
const { W, H } = C;
const OUT = path.join(__dirname, '../../../Game/Assets/_Project/Art/Resources/Cinema/title_intro.bytes');

function renderScene(fr, sc) {
  let c = sc.cam;
  if (sc.shake) {                                                  // camera shake: the aim wanders by `shake` pixels, with a little roll
    const k = C.makeCam(c), D = 100, a = sc.shake * D / k.f, t = sc.t;
    const tg = C.mad(C.mad(C.mad(c.pos, k.F, D), k.R, a * C.wob(t * 17, 1)), k.U, a * C.wob(t * 19, 2));
    c = { ...c, target: tg, roll: (c.roll || 0) + sc.shake * .0035 * C.wob(t * 13, 3) };
  }
  if (sc.kicks && sc.kicks.length && sc.t < Shots.LOOP_START / C.FPS) {   // blasts: a jolt away from the blast, then a spring (never in the menu loop)
    const k = C.makeCam(c); let x = 0, y = 0, roll = 0, zoom = 1;
    for (const q of sc.kicks) { const r = Fx.kickAt(q, k); if (r) { x += r.x; y += r.y; roll += r.roll; zoom *= r.zoom; } }
    const D = 100, tg = C.mad(C.mad(C.mad(c.pos, k.F, D), k.R, -x * D / k.f), k.U, y * D / k.f);
    c = { ...c, target: tg, roll: (c.roll || 0) + roll, fov: (c.fov || 50) * zoom };
  }
  const cam = C.makeCam(c);
  S.drawSky(fr, cam, sc.deck);
  Cl.drawClouds(fr, cam, sc.clouds, sc.deck.off);
  sc.insts.forEach((it, i) => Me.drawMesh(fr, cam, it, i));
  Me.shade(fr, cam, sc.insts, sc.lights);
  Me.extras(fr, cam, sc.insts);
  Fx.draw(fr, cam, sc.fx);
  return Po.finish(fr, sc.post, new Uint8Array(W * H));
}

if (!isMainThread) {
  Mo.meshes();
  const fr = S.newFrame();
  for (const f of workerData.frames) { const idx = renderScene(fr, Shots.sceneAt(f)); parentPort.postMessage({ f, idx }, [idx.buffer]); }
} else {
  const arg = k => { const i = process.argv.indexOf('--' + k); return i < 0 ? null : process.argv[i + 1]; };
  const range = arg('frames'), step = +(arg('step') || 1), sheet = arg('sheet'), png = arg('png');
  let frames = [];
  if (range) for (const part of range.split(',')) { const [a, b] = part.split('-').map(Number); for (let f = a; f <= (b === undefined ? a : b); f += step) frames.push(f); }
  else for (let f = 0; f < Shots.FRAMES; f += step) frames.push(f);
  const full = !range && step === 1, jobs = Math.max(1, Math.min(+(arg('jobs') || os.cpus().length - 2), frames.length));
  const t0 = Date.now();
  Mo.meshes(undefined, m => console.log('mesh ' + m));
  const done = new Map();
  const rgb = idx => { const b = Buffer.alloc(W * H * 3); for (let i = 0; i < idx.length; i++) { const p = C.PALETTE[idx[i]]; b[i * 3] = Math.round(p[0] * 255); b[i * 3 + 1] = Math.round(p[1] * 255); b[i * 3 + 2] = Math.round(p[2] * 255); } return b; };
  let left = jobs;
  for (let j = 0; j < jobs; j++) {
    const w = new Worker(__filename, { workerData: { frames: frames.filter((_, i) => i % jobs === j) } });
    w.on('message', m => { done.set(m.f, m.idx); if (done.size % 30 === 0) console.log(done.size + ' / ' + frames.length + '  ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s'); });
    w.on('error', e => { console.error(e); process.exit(1); });
    w.on('exit', async () => { if (--left === 0) await finish(); });
  }
  async function finish() {
    console.log('rendered ' + done.size + ' frames in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
    const { sharp } = require('../lib.cjs');
    if (png) { fs.mkdirSync(png, { recursive: true }); for (const f of frames) await sharp(rgb(done.get(f)), { raw: { width: W, height: H, channels: 3 } }).resize(W * 2, H * 2, { kernel: 'nearest' }).png().toFile(path.join(png, 'f' + String(f).padStart(3, '0') + '.png')); }
    if (sheet) {
      fs.mkdirSync(sheet, { recursive: true });
      for (let s = 0; s < frames.length; s += 12) {
        const part = frames.slice(s, s + 12), rows = Math.ceil(part.length / 3);
        await sharp({ create: { width: W * 3 + 8, height: (H + 4) * rows, channels: 3, background: '#000' } })
          .composite(part.map((f, i) => ({ input: rgb(done.get(f)), raw: { width: W, height: H, channels: 3 }, left: (i % 3) * (W + 4), top: Math.floor(i / 3) * (H + 4) }))).png().toFile(path.join(sheet, 'sheet_' + String(part[0]).padStart(3, '0') + '.png'));
      }
    }
    if (!full) return;
    const packed = [], offs = new Uint32Array(Shots.FRAMES + 1); let o = 0;
    for (let f = 0; f < Shots.FRAMES; f++) { const z = zlib.deflateRawSync(Buffer.from(done.get(f)), { level: 9 }); packed.push(z); offs[f] = o; o += z.length; }
    offs[Shots.FRAMES] = o;
    const head = Buffer.alloc(18); head.write('WWC2', 0, 'latin1');
    [W, H, C.FPS, Shots.FRAMES, Shots.LOOP_START, C.PALETTE.length, Shots.CUES.length].forEach((v, i) => head.writeUInt16LE(v, 4 + i * 2));
    const pal = Buffer.from(C.PALETTE.flatMap(p => p.map(v => Math.round(v * 255))));
    const cues = Buffer.alloc(Shots.CUES.length * 6);
    Shots.CUES.forEach((c, i) => { cues.writeUInt8(c.k, i * 6); cues.writeUInt16LE(c.f, i * 6 + 1); cues.writeInt8(c.pan, i * 6 + 3); cues.writeUInt8(c.level, i * 6 + 4); cues.writeUInt8(c.dur, i * 6 + 5); });
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, Buffer.concat([head, pal, cues, Buffer.from(offs.buffer), ...packed]));
    console.log('wrote ' + OUT + '  ' + (fs.statSync(OUT).size / 1048576).toFixed(2) + ' MB, ' + Shots.FRAMES + ' frames, ' + Shots.CUES.length + ' cues');
  }
}
