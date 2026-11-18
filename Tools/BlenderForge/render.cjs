// node Tools/BlenderForge/render.cjs [preview part:i,...]
// Renders the opening's hands with Blender into SourceAssets/Blender/OpeningHands (read by the forge,
// see story/blenderHands.cjs). Run it after changing openingHands.cjs or hand.cjs, then run the forge.
// Blender: env BLENDER, else the first %USERPROFILE%/Tools/blender/*/blender.exe (portable 4.2 LTS).
// preview: lit 3x renders of the listed frames into Tools/BlenderForge/preview/ (not used by the game).
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const BH = require('../PixelForge/story/blenderHands.cjs');

function blender() {
  if (process.env.BLENDER) return process.env.BLENDER;
  const base = path.join(os.homedir(), 'Tools', 'blender');
  for (const d of fs.existsSync(base) ? fs.readdirSync(base) : []) {
    const exe = path.join(base, d, 'blender.exe');
    if (fs.existsSync(exe)) return exe;
  }
  throw new Error('Blender not found: set BLENDER to blender.exe');
}

// The mesh is posed in story/handRig.cjs; Blender gets the posed vertices of every frame.
// verts: only build the mesh and write every frame's vertices (read back from Blender) to
// <tmp>/wordwing-opening-verts/verts.json (seconds, no render), for Tools/BlenderForge/handChecks.cjs.
const mode = process.argv[2] === 'preview' ? 'preview' : process.argv[2] === 'verts' ? 'verts' : 'gbuffer', preview = mode === 'preview';
const out = preview ? path.join(__dirname, 'preview') : mode === 'verts' ? path.join(os.tmpdir(), 'wordwing-opening-verts') : BH.DIR;
fs.mkdirSync(out, { recursive: true });
if (mode === 'gbuffer') for (const f of fs.readdirSync(out)) if (/\.(png|json)$/.test(f)) fs.rmSync(path.join(out, f));
const poses = BH.exportPoses(), posesFile = path.join(os.tmpdir(), 'wordwing-opening-poses.json');
fs.writeFileSync(posesFile, JSON.stringify(poses));
execFileSync(blender(), ['-b', '--factory-startup', '--python', path.join(__dirname, 'opening_hands.py'), '--',
  posesFile, out, mode, preview ? process.argv[3] || 'hand:19' : 'hand:all,lid:all'],
  { stdio: ['ignore', 'ignore', 'inherit'] });
if (mode === 'verts') console.log(`OpeningHands verts -> ${path.join(out, 'verts.json')}`);
if (mode === 'gbuffer') {
  const metaFile = path.join(out, 'meta.json'), meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  meta.hash = BH.hashOf(poses);
  fs.writeFileSync(metaFile, JSON.stringify(meta));
  console.log(`OpeningHands: ${Object.keys(meta.frames).length} frames -> ${path.relative(process.cwd(), out)}`);
}
