'use strict';
// The ground under the raid: a Velmark port city on a north-south coast, 4.2 km under the bombers (ground plane
// z = ZG). Metres, x east, y north; the bombers fly north along x ~ 0..500 at z 2800..3400.
//   coast   x ~ 4.6 km, sea to the east (toward the low sun, so the sun glitter lies on water)
//   river   an estuary along y ~ +0.3 km from far inland to the coast; the port is on its north bank where the whip
//           down of shot 2 looks (x -6.7..-1.1 km): three basins with a capsized, a burning and a moored ship, a comb
//           dock, a broken bridge, a tank farm, the burnt-out old town round a brick church; a breakwater at the mouth
//   oil     tank farms by the port (-2.35, 2.3), W (-6.6, -1.4) and SE (3.3, -5.2) burning under the two nearest oil columns; a refinery far
//           south (-2.6, -17.5) under the third
//   fire    a burning belt inland (x -11.5..-0.9 km) the length of the coast, districts burning / burnt out / intact
//   south   a second port on a wide estuary at y ~ -12 km (SP, LOOP_PORT): what shot 8 and the menu loop look down on
// sky.cjs draws every shot in world mode (env.loop false): 4 km down, the loop's 8 s barely moves the ground, so it
// stands still while only the deck slides, and the loop still closes. The periodic loop mode (y tiles every
// P = DECK_P) is kept but no longer used.
const C = require('./core.cjs');
const { clamp, smooth, ih, noise2, noise2p, RAMP, rampAt, TAU } = C;
const ZG = -1200, P = 2400, TAN_SUN = Math.tan(7 * C.DEG);

// value noise that tiles every P along y in loop mode (cell must divide P)
const pn = (x, y, cell, s, per) => noise2p(x / cell, y / cell, per ? P / cell : 0, s);
// weight of a feature `size` metres across when a pixel covers `foot` metres: fades to its mean under ~3 px (no moire)
const lod = (size, foot) => clamp(size / (foot * 2.6) - .25);

// Smoke columns of the static far layer: base on the ground, cap at the inversion (A/B spread at one height). tone: D only, darker smoke.
// kind A oil (black, 2-3 of them reach the bombers), B city fires, C a ship, D warehouses.
const COLS = [
  { x: -6600, y: -1400, top: 3300, r: 230, kind: 'A', seed: 1, fire: 300 },
  { x: -2600, y: -17500, top: 3350, r: 360, kind: 'A', seed: 2, fire: 380 },
  { x: 3300, y: -5200, top: 3200, r: 170, kind: 'A', seed: 3, fire: 260 },
  { x: -5200, y: -13400, top: 2250, r: 380, kind: 'B', seed: 4, fire: 650 },
  { x: -10500, y: -21500, top: 2250, r: 460, kind: 'B', seed: 5, fire: 800 },
  { x: -9600, y: 2600, top: 2200, r: 280, kind: 'B', seed: 6, fire: 600 },
  { x: -7000, y: 3400, top: 1300, r: 170, kind: 'B', seed: 7, fire: 420 },
  { x: 7300, y: -2600, top: -250, r: 45, kind: 'C', seed: 8, fire: 90 },
  { x: -1300, y: -800, top: 200, r: 90, kind: 'D', seed: 9, fire: 160 },
  { x: 1700, y: -1300, top: -100, r: 80, kind: 'D', seed: 10, fire: 140 },
  { x: -3040, y: -11374, top: 2600, r: 150, kind: 'A', seed: 11, fire: 110 },  // the south port's tank farm: leads the eye from the docks up (loop)
  // small ones: burning blocks across the belt round the south port (loop, shots 1-3), under the deck
  { x: -9600, y: -14400, top: -300, r: 110, kind: 'D', tone: 1.05, seed: 12, fire: 220 }, { x: -7200, y: -16800, top: -200, r: 130, kind: 'D', tone: 1.05, seed: 13, fire: 240 },
  { x: -11800, y: -13300, top: -350, r: 100, kind: 'D', tone: 1.05, seed: 14, fire: 200 }, { x: -6300, y: -8900, top: -400, r: 90, kind: 'D', tone: 1.05, seed: 15, fire: 180 },
  { x: -2600, y: -15800, top: -250, r: 110, kind: 'D', tone: 1.05, seed: 16, fire: 200 },
  { x: -5810, y: -10450, top: -750, r: 40, kind: 'D', tone: 1.05, seed: 17, fire: 110 }   // black smoke off the two burning tanks of the south farm
];
// wind from the west: every column leans east by the same rule (dx at a height h above the ground)
const lean = h => h * .08 + h * h * 4e-5;

// ---------------------------------------------------------------- the map
function coastX(y, per) {
  let v = 4600 + (pn(0, y, 800, 401, per) - .5) * 700 + (pn(0, y, 240, 402, per) - .5) * 220;
  if (!per) v += (noise2(.5, y / 6000, 403) - .5) * 2600 * smooth((Math.abs(y) - 3000) / 5000) + 1500 * smooth((y + 7800) / 1500) * smooth((-700 - y) / 1500);   // a headland with the coastal town (shot 6)
  return v;
}
const riverY = x => 300 + 280 * Math.sin(x / 2600 + .6) + 90 * Math.sin(x / 830 + 2);
const riverHW = x => 170 + 260 * smooth((x + 3000) / 7600);
const northBank = x => riverY(x) + riverHW(x);
// ---- the port, laid out on the north bank where the whip down of shot 2 looks (frames 66-77 see x -6.6..-1.2 km,
// y 0..3.5 km at 20-35 m a pixel). Sizes are 1.5-2.5x real so the wreckage reads at that scale; the district fires
// are held back here (PORT mask) so the land stays dark and the burning things have shapes.
const PORT = { x0: -5300, x1: -800, y0: -300, y1: 5300 };
const BASINS = [{ x: -2550, ship: 'capsized' }, { x: -1950, ship: 'burning' }, { x: -1350, ship: 'moored' }];   // 300 x 900 m, ships 36 x 240 m
const DOCK = { x0: -4300, x1: -3000, y0: 2150, y1: 2850, n: 5, canal: -3700 };   // inner comb dock up a canal: fingers 90 x 470 m
const BRIDGES = [{ x: -2950, broken: true }, { x: -4800, broken: false }];
const CHURCH = { x: -3600, y: 4300 };                             // brick Gothic church (VL-4), tower at the west end, half fallen
// oil tanks: farm by the port (the whip down), the west farm, the coastal farm south-east; 'burn' = share on fire
const TANKS = [{ x: -2350, y: 2300, nx: 4, ny: 3, s: 110, r: 36, burn: .5 }, { x: -6600, y: -1400, nx: 4, ny: 4, s: 80, r: 24, burn: .62 }, { x: 3300, y: -5200, nx: 3, ny: 4, s: 80, r: 24, burn: .55 }];
// tall thin things that cast the long dusk shadow (x, y, height, width): the church tower (stump), chimneys
const TALL = [[CHURCH.x - 155, CHURCH.y, 70, 50], [-2250, 1500, 95, 16], [-1650, 1600, 90, 16], [-4500, 3100, 80, 14], [-2900, 3300, 85, 14], [2600, -900, 95, 12]];
// the coastal town south of the port (seen from the turning fight, shot 6) and its burning waterfront
const COAST_TOWN = { y0: -8000, y1: -500, w: 2600 };

// box test with soft (anti-aliased) edges: 1 inside, 0 outside; aa in metres
const inBox = (x, y, x0, x1, y0, y1, aa) => clamp((Math.min(x - x0, x1 - x, y - y0, y1 - y)) / aa + .5);

// ---- the south port (VL-port, signature: comb dock + three basins + a mole on a wide estuary, a tank farm, cranes
// throwing long dusk shadows). Shot 8 and the menu loop look at it from 10-14 km (28-31 m a pixel across, 76-95 m a
// pixel in depth); shots 1 and 3 see it far off. Sizes follow the matte-painting rule: anything along the depth at
// least 2 px wide, anything across the screen at least ~150 m deep, so the estuary is a bright band 8-12 px high.
// (east of the port it swings south, so in the loop it runs off into the haze behind the cloud lane, not across the menu)
const sRiverY = x => -12200 + 230 * Math.sin(x / 3300 + 1.3) + 50 * Math.sin(x / 900) - 2600 * smooth((x + 1000) / 4500);
const sRiverHW = x => 430 + 370 * smooth((x + 4000) / 9000);
const sNorth = x => sRiverY(x) + sRiverHW(x);
const SP = { x0: -9600, x1: -1800, y0: -13000, y1: -10100 };          // bounding box of the dock works (north bank + river)
const SCOMB = { x0: -8600, x1: -6900, d: 1000, n: 4 };              // comb dock: fingers 150 m wide, 270 m of water between
const SBASINS = [-6150, -5450, -4750];                              // 380 x 1000 m basins
const SMOLE = { x0: -4500, x1: -2300, off: 280, hw: 110 };           // a mole along the river in front of the east quays
const SBRIDGES = [{ x: -9300, broken: true }, { x: -1500, broken: false }];
// ships: along the river (ang 0, bow east) or moored in a basin (ang 90 deg, bow south); L x B metres (beam drawn 1.5-2x)
const SSHIPS = [
  { x: -5900, dy: -60, ang: 0, L: 300, B: 70, kind: 'burning' }, { x: -7550, dy: 200, ang: .35, L: 260, B: 70, kind: 'capsized' },
  { x: -3700, dy: -170, ang: -.06, L: 280, B: 60, kind: 'moving' }, { x: -2000, dy: 120, ang: 0, L: 320, B: 70, kind: 'moored' },
  ...SBASINS.map((bx, k) => ({ x: bx + (k - 1) * 70, dy: 0, at: 520 + 90 * k, ang: Math.PI / 2, L: 380, B: 100, kind: k === 1 ? 'burning' : 'moored' }))
].map(s => ({ ...s, y: s.at ? sNorth(s.x) + s.at : sRiverY(s.x) + s.dy, ca: Math.cos(s.ang), sa: Math.sin(s.ang) }));
const STANKX = -5450;                                               // the tank farm behind the middle basin (TANKS[3]), in the middle of the loop's view
TANKS.push({ x: STANKX, y: sNorth(STANKX) + 1390, nx: 3, ny: 2, s: 360, r: 140, burn: .35 });   // drawn ~2x: 9 x 3 px in the loop
// warehouses on the quays (x, y0, y1, half width): long pale roofs, the sunlit east pitch paler; every third one burning
const SSHEDS = [];
{ const nc = sNorth(-7750); SSHEDS.push([-9000, nc + 250, nc + 900, 55], [-7750, nc + 1150, nc + 1350, 600]); }
for (let k = 0; k < SBASINS.length; k++) { const bx = SBASINS[k], nb = sNorth(bx); SSHEDS.push([bx - 300, nb + 150, nb + 850, 60], [bx + 300, nb + 150, nb + 850, 60]); }
// cranes along the quay edges: a pale jib and a long shadow thrown west (TALL)
const SCRANES = [];
for (const bx of SBASINS) { const nb = sNorth(bx); for (const s of [-1, 1]) for (let k = 0; k < 3; k++) SCRANES.push([bx + s * 215, nb + 180 + k * 260]); }
for (let j = 0; j < SCOMB.n; j++) SCRANES.push([SCOMB.x0 + (j + .5) * (SCOMB.x1 - SCOMB.x0) / SCOMB.n, sNorth(-7750) + 240]);
for (const [cx, cy] of SCRANES) TALL.push([cx, cy, 48, 22]);
const southMask = (wx, wy) => inBox(wx, wy, SP.x0, SP.x1, sRiverY(wx) - sRiverHW(wx) - 200, SP.y1, 400);   // the docks, the river and the far quay
const portMask = (wx, wy) => Math.max(inBox(wx, wy, PORT.x0, PORT.x1, PORT.y0, PORT.y1, 500), southMask(wx, wy));

// water 0..1 at a world point (world mode): the sea, the rivers, the basins of both ports; s.land: piers, moles and
// bridges over the water; s.bridge: bridge decks; s.xc: the coast at that y
const BW = { x: coastX(riverY(4600), false) };
BW.y = riverY(BW.x) - riverHW(BW.x) - 140;
function wet(x, y, wx, wy, aa, per, s) {
  const xc = coastX(y, per);
  let water = clamp((x - xc) / aa + .5), land = 0, bridge = 0;
  if (!per && wx < xc + 1500) {
    const ry = riverY(wx), hw = riverHW(wx);
    water = Math.max(water, clamp((hw - Math.abs(wy - ry)) / aa + .5));
    if (wx > PORT.x0 - 400 && wx < PORT.x1 + 400 && wy > PORT.y0 - 400 && wy < PORT.y1 + 400) {
      for (const b of BASINS) { const nb = northBank(b.x); water = Math.max(water, inBox(wx, wy, b.x - 150, b.x + 150, nb - 30, nb + 900, aa)); }
      water = Math.max(water, inBox(wx, wy, DOCK.x0, DOCK.x1, DOCK.y0, DOCK.y1, aa), inBox(wx, wy, DOCK.canal - 70, DOCK.canal + 70, northBank(DOCK.canal) - 30, DOCK.y0 + 30, aa));
      for (let j = 0; j < DOCK.n; j++) { const fx = DOCK.x0 + 130 + j * 260; land = Math.max(land, inBox(wx, wy, fx - 45, fx + 45, DOCK.y1 - 470, DOCK.y1 + 20, aa)); }
    }
    for (const b of BRIDGES) { let k = inBox(wx, wy, b.x - 17, b.x + 17, ry - hw - 40, ry + hw + 40, aa); if (b.broken) k *= 1 - inBox(wx, wy, b.x - 30, b.x + 30, ry - 40, ry + 60, aa); land = Math.max(land, k); bridge = Math.max(bridge, k); }
    land = Math.max(land, inBox(wx, wy, BW.x - 200, BW.x + 1300, BW.y - 22, BW.y + 22, aa));   // breakwater south of the river mouth
    // the south estuary and its port
    if (wy > -17000 && wy < -9500) {
      const sy = sRiverY(wx), sh = sRiverHW(wx);
      water = Math.max(water, clamp((sh - Math.abs(wy - sy)) / aa + .5));
      if (wx > SP.x0 && wx < SP.x1 && wy < SP.y1) {
        const nc = sNorth((SCOMB.x0 + SCOMB.x1) / 2), fw = (SCOMB.x1 - SCOMB.x0) / SCOMB.n;
        water = Math.max(water, inBox(wx, wy, SCOMB.x0, SCOMB.x1, nc - 60, nc + SCOMB.d, aa));
        for (let j = 0; j < SCOMB.n; j++) { const fx = SCOMB.x0 + (j + .5) * fw; land = Math.max(land, inBox(wx, wy, fx - 75, fx + 75, nc + 170, nc + SCOMB.d + 20, aa)); }
        for (const bx of SBASINS) { const nb = sNorth(bx); water = Math.max(water, inBox(wx, wy, bx - 190, bx + 190, nb - 60, nb + 1000, aa)); }
        const nm = sNorth((SMOLE.x0 + SMOLE.x1) / 2) - SMOLE.off;
        land = Math.max(land, inBox(wx, wy, SMOLE.x0, SMOLE.x1, nm - SMOLE.hw, nm + SMOLE.hw, aa));
      }
      for (const b of SBRIDGES) { let k = inBox(wx, wy, b.x - 22, b.x + 22, sy - sh - 60, sy + sh + 60, aa); if (b.broken) k *= 1 - inBox(wx, wy, b.x - 40, b.x + 40, sy - 160, sy + 40, aa); land = Math.max(land, k); bridge = Math.max(bridge, k); }
    }
    water *= 1 - land;
  }
  s.land = land; s.bridge = bridge; s.xc = xc;
  return water;
}
// near enough to a river or a basin that the bank light and the quay shadows are worth a second look
const nearDocks = (wx, wy, foot) => (wx > PORT.x0 - 400 && wx < PORT.x1 + 400 && wy > PORT.y0 - 600 && wy < PORT.y1 + 400) || (wx > SP.x0 && wx < SP.x1 && wy > SP.y0 && wy < SP.y1)
  || Math.abs(wy - riverY(wx)) < riverHW(wx) + 2 * foot || Math.abs(wy - sRiverY(wx)) < sRiverHW(wx) + 2 * foot;

// fire density of the burning districts (smooth, no spots): 0 none .. 1 a sea of fire; the burnt-out share; ruin (roofless
// walls round the church)
function districts(x, y, wx, wy, per, world, o) {
  const e = -900 + (pn(x, y, 1200, 420, per) - .5) * 1400, w = -11500 + (pn(x, y, 1200, 421, per) - .5) * 3000;
  let city = smooth((e - x) / 600) * smooth((x - w) / 1500);
  o.ruin = 0;
  if (world) {
    const r = Math.hypot((wx + 2000) / 7200, (wy - 300) / 5600); city = Math.max(city, smooth((1 - r) / .25));
    const xc = coastX(wy, false); city = Math.max(city, smooth((wx - (xc - COAST_TOWN.w)) / 500) * smooth((xc + 100 - wx) / 200) * inBox(wx, wy, -1e9, 1e9, COAST_TOWN.y0, COAST_TOWN.y1, 900));
  }
  const d1 = pn(x, y, 600, 430, per) * .7 + pn(x, y, 240, 432, per) * .3, d2 = pn(x, y, 1200, 431, per);
  o.city = city;
  o.burnt = city * smooth((d2 - .58) / .1);
  o.fd = city * smooth((d1 - .53) / .12) * (1 - o.burnt * .8);
  if (world) {
    const pm = portMask(wx, wy);
    o.fd *= 1 - .85 * pm;
    const rd = Math.hypot(wx - CHURCH.x, (wy - CHURCH.y) * 1.2);  // the old town round the church: burnt out, a few embers
    o.ruin = smooth((900 - rd) / 250); o.burnt = Math.max(o.burnt, o.ruin); o.city = Math.max(o.city, o.ruin);
    o.fd = Math.max(o.fd * (1 - o.ruin), o.ruin * .12);
  }
  for (const c of COLS) { const d = Math.hypot(wx - c.x, wy - c.y); if (d < c.fire * 2.2) o.fd = Math.max(o.fd, smooth(1 - d / (c.fire * 2.2)) * (c.kind === 'C' ? .5 : 1)); }
}

// Surface at ground point (x, y) (loop: sliding frame; world: = wx, wy) and world point (wx, wy).
// o: col (diffuse, already in dusk light), water 0..1, emit [r,g,b] (fire, added after the haze), fd (fire light 0..1),
//    oil 0..1 (burning oil on water), inland 0..1 (river or dock water, not the open sea), foam 0..1 (wakes), qsh 0..1
//    (quay walls shading the water west of them). Input o.footH: metres a pixel across the view (bank light width).
const tc = [0, 0, 0], pc = [0, 0, 0], ds = {}, ws = { land: 0, bridge: 0 }, wo = { land: 0, bridge: 0 };
const mixIn = (ramp, L, k) => { if (k <= 0) return; rampAt(ramp, L, pc); tc[0] += (pc[0] - tc[0]) * k; tc[1] += (pc[1] - tc[1]) * k; tc[2] += (pc[2] - tc[2]) * k; };
const burn = (o, h) => { if (h <= 0) return; o.emit[0] += 1.6 * h; o.emit[1] += .78 * h * (.55 + .5 * Math.min(1, h)); o.emit[2] += .22 * h * h; };
function surface(x, y, wx, wy, foot, env, o) {
  const per = env.loop, world = !per, aa = Math.max(8, foot * .5);
  o.emit[0] = o.emit[1] = o.emit[2] = 0; o.oil = 0; o.foam = 0; o.qsh = 0;
  // ---- water: the sea, the rivers, the port basins (world)
  let water = wet(x, y, wx, wy, aa, per, ws), rim = 0;
  const bridge = ws.bridge, inPort = world && wx > PORT.x0 - 400 && wx < PORT.x1 + 400 && wy > PORT.y0 - 400 && wy < PORT.y1 + 400;
  const inS = world && wx > SP.x0 && wx < SP.x1 && wy > SP.y0 && wy < SP.y1;
  o.inland = world ? clamp((ws.xc - 400 - wx) / 900) : 0;
  if (world && nearDocks(wx, wy, foot)) {
    // matte-painting bank light: a pale lip on the land where the water lies to the east (toward the low sun) or to the
    // north (the far bank's wall, facing the loop camera); the quay walls throw a dark strip on the water west of them
    const hf = Math.max(6, o.footH || foot * .4), we = wet(x + hf * 1.8, y, wx + hf * 1.8, wy, aa, per, wo), wn = wet(x, y + foot * 1.4, wx, wy + foot * 1.4, aa, per, wo);
    rim = (1 - water) * Math.max(we, wn * .8) * (1 - bridge);
    o.qsh = water * (1 - we);
    o.foam = water * (1 - wn) * .45;                                  // a pale line of wash along the quay feet
  }
  // ---- land
  districts(x, y, wx, wy, per, world, ds);
  const w600 = lod(600, foot), w150 = lod(150, foot);
  let L = .5 + (pn(x, y, 600, 410, per) - .5) * .5 * w600 + (pn(x, y, 150, 411, per) - .5) * .3 * w150;
  rampAt(RAMP.land, L * .62, tc);
  let burnBlock = 0, bid = 0;
  if (ds.city > 0) {
    // blocks: a street grid turned per district (loop: square to the coast, 96 m rows so it tiles every P);
    // under ~3 px a block fades to its mean. A burning block is a mass of flame, not a dot. In the ruin round the
    // church the blocks are black shells and the walls and streets show pale.
    const ang = per ? 0 : (pn(x, y, 800, 433, per) - .5) * 1.4, ca = Math.cos(ang), sa = Math.sin(ang), gs = 1 + ds.ruin * 1.2, u = (x * ca + y * sa) / gs, v = (-x * sa + y * ca) / gs;   // ruin blocks drawn 2.2x so the shells read
    const bu = Math.floor(u / 120), bv = Math.floor(v / 96), wb = lod(100 * gs, foot), jv = per ? ((bv % 25) + 25) % 25 : bv;
    const fu = u / 120 - bu, fv = v / 96 - bv, sw = Math.max(9, foot * .5);
    const street = Math.max(clamp(1 - Math.min(fu, 1 - fu) * 120 / sw), clamp(1 - Math.min(fv, 1 - fv) * 96 / sw)) * Math.min(1, 16 / foot);
    const hb = ih(bu, jv, 0, 434);
    mixIn(RAMP.rubble, .3 + (hb - .5) * .5 * wb, ds.city * .8);
    const sd = 1 - street * .5 * wb * ds.city * (1 - ds.ruin); tc[0] *= sd; tc[1] *= sd; tc[2] *= sd;
    mixIn(RAMP.soot, .08 + .08 * hb * wb, ds.burnt);
    mixIn(RAMP.rubble, .85, Math.min(1, street * 2) * wb * ds.ruin);   // roofless shells: pale walls round black blocks
    const pb = ds.fd * .5, on = ih(bu, jv, 1, 435) < pb;
    bid = bu * 131 + jv;
    if (wb > 0 && on) {
      const fl = pn(x, y, 25, 436, per) * .6 + pn(x, y, 75, 437, per) * .4, inner = clamp(Math.min(fu, 1 - fu, fv, 1 - fv) * 8);
      burnBlock = clamp((fl - .42) / .2) * inner * wb;
    }
    // far off (120 m blocks under ~3 px) the district reads as big blocks between main roads: a block burns as a whole
    // (a mass of flame, not spots), burnt-out ones are ash grey, intact roofs dark, the roads paler between them
    const wS = (1 - wb) * ds.city;
    if (wS > 0) {
      const SU = u / 520, SV = v / 430, su = Math.floor(SU), sv = Math.floor(SV), fu2 = SU - su, fv2 = SV - sv;
      const rwu = Math.max(30, (o.footH || foot * .4) * .9), rwv = Math.max(30, foot * .7);
      const road = Math.max(clamp(1 - Math.min(fu2, 1 - fu2) * 520 / rwu), clamp(1 - Math.min(fv2, 1 - fv2) * 430 / rwv));
      const hs = ih(su, sv, 2, 470), sb = hs < ds.fd * .9 ? 1 : hs > 1 - ds.burnt * .85 ? 2 : 0;   // 1 burning, 2 burnt out
      if (sb === 2) mixIn(RAMP.soot, .4 + .12 * ih(su, sv, 3, 470), wS * .85); else mixIn(RAMP.land, .08, wS * .55);
      mixIn(RAMP.rubble, .72, road * wS * .8);
      if (sb === 1) { const fl = pn(x, y, 400, 471, per) * .5 + pn(x, y, 180, 472, per) * .5; burnBlock += (.45 + .55 * clamp((fl - .3) / .35)) * clamp(Math.min(fu2, 1 - fu2, fv2, 1 - fv2) * 5) * wS * .7; bid = su * 977 + sv; }   // flame cells >= 180 m: no speckle from 10 km
    }
  }
  if (world) {
    mixIn(RAMP.land, .1, southMask(wx, wy) * .75);                  // the south port's quays: dark, so the water and the roofs read
    // oil tanks: pale rings with a dark shadow side; burning ones are black pits with fire in the mouth
    for (const f of TANKS) {
      const sl = f.r * .12 / TAN_SUN;                                // the tank's shadow, thrown west
      if (wx < f.x - f.nx * f.s / 2 - 80 - sl || wx > f.x + f.nx * f.s / 2 + 80 || Math.abs(wy - f.y) > f.ny * f.s / 2 + 80) continue;
      mixIn(RAMP.land, .15, inBox(wx, wy, f.x - f.nx * f.s / 2 - 20, f.x + f.nx * f.s / 2 + 20, f.y - f.ny * f.s / 2 - 20, f.y + f.ny * f.s / 2 + 20, aa) * .6);   // the bund
      const gy = Math.round((wy - f.y) / f.s + (f.ny - 1) / 2); if (gy < 0 || gy >= f.ny) continue;
      const cy = f.y + (gy - (f.ny - 1) / 2) * f.s, r = f.r, ew = Math.max(4, foot * .5);
      for (let gx = 0; gx < f.nx; gx++) {
        const cx = f.x + (gx - (f.nx - 1) / 2) * f.s, dxs = cx - wx, ay = Math.abs(wy - cy);
        if (dxs > 0 && dxs < r + sl && ay < r) { const k = clamp((r - ay) / ew) * clamp((r + sl - dxs) / ew) * .55; tc[0] *= 1 - k; tc[1] *= 1 - k; tc[2] *= 1 - k * .9; }
        const d = Math.hypot(wx - cx, wy - cy); if (d > r + ew) continue;
        const ring = clamp((r - d) / ew + .5), lit = ih(gx, gy, f.x, 440) < f.burn, east = clamp((wx - cx) / r * .8 + .5), lip = clamp(1 - (r - d) / Math.max(r * .3, ew * 1.2));
        if (lit) { mixIn(RAMP.soot, .06, ring); mixIn(RAMP.soot, .35, ring * lip * .6); burn(o, ring * (1 - lip * .5) * clamp(1.3 - d / r) * (.9 + .5 * flick(gx * 7 + gy, f.x, env))); }
        else { mixIn(RAMP.rubble, .5 + .4 * east, ring); mixIn(RAMP.dock, 1, ring * (.3 + .35 * east + .35 * lip * east)); }   // pale painted steel, the lip lit on the sun side
      }
    }
    if (inPort) {
      // warehouses on the quays between the basins (long pale roofs, every other one burning) and the church
      for (let k = 0; k < BASINS.length - 1; k++) {
        const qx = (BASINS[k].x + BASINS[k + 1].x) / 2, nb = northBank(qx);
        for (const [dx, j] of [[-70, 0], [70, 1]]) {
          const roof = inBox(wx, wy, qx + dx * .8 - 45, qx + dx * .8 + 45, nb + 120, nb + 760, aa);
          if (roof <= 0) continue;
          const fire = (k + j) % 2 === 0;
          mixIn(fire ? RAMP.soot : RAMP.rubble, fire ? .1 : .8, roof);
          if (fire) burn(o, roof * clamp((pn(wx, wy, 30, 445, false) - .35) / .2) * .9 * flick(k * 2 + j, 21, env));
        }
      }
      const cu = wx - CHURCH.x, cv = wy - CHURCH.y;
      const nave = Math.max(inBox(cu, cv, -140, 140, -42, 42, aa), inBox(cu, cv, 30, 110, -120, 120, aa));
      mixIn(RAMP.ember, .45 + .35 * clamp(.5 - cv / 80), nave);              // brick roof (2.5x), sunlit side to the south-east
      mixIn(RAMP.ember, .9, inBox(cu, cv, -180, -130, -28, 28, aa));        // the tower stump
      if (nave > 0) burn(o, nave * clamp((pn(wx, wy, 25, 446, false) - .55) / .15) * .7 * flick(5, 22, env));
    }
    if (inS) {
      // the south port: warehouse roofs, crane jibs (pale dots held at ~1 px)
      for (let k = 0; k < SSHEDS.length; k++) {
        const [sx, y0, y1, hw] = SSHEDS[k], roof = inBox(wx, wy, sx - hw, sx + hw, y0, y1, aa); if (roof <= 0) continue;
        const fire = k % 3 === 2, lit = clamp((wx - sx) / hw * 2 + .5);
        if (fire) mixIn(RAMP.soot, .1, roof); else { mixIn(RAMP.rubble, .75, roof); mixIn(RAMP.dock, 1, roof * lit * .75); }
        if (fire) burn(o, roof * clamp((pn(wx, wy, 40, 448, false) - .35) / .2) * .9 * flick(k, 24, env));
      }
      const ch = Math.max(14, (o.footH || foot * .4) * .55), cv = Math.max(14, foot * .55);
      for (const [cx, cy] of SCRANES) if (Math.abs(wx - cx) < ch && Math.abs(wy - cy) < cv) mixIn(RAMP.rubble, 1, .9);
    }
    // long dusk shadows of towers and chimneys, thrown west
    for (const [tx, ty, th, tw] of TALL) {
      const len = th / TAN_SUN, dx = tx - wx; if (dx < 0 || dx > len || Math.abs(wy - ty) > tw + 30) continue;
      const k = clamp(1 - Math.abs(wy - ty) / (tw * .5)) * Math.min(1, tw * 1.2 / foot) * (1 - dx / len * .4); tc[0] *= 1 - .6 * k; tc[1] *= 1 - .6 * k; tc[2] *= 1 - .55 * k;
    }
  }
  mixIn(RAMP.rubble, .9, bridge);                                    // bridge decks: pale strokes over the dark water
  // fire light on the ground round the burning districts
  mixIn(RAMP.ember, .2 + .5 * ds.fd, ds.fd * .4);
  mixIn(RAMP.port, .97, rim);                                        // bank light
  o.col[0] = tc[0]; o.col[1] = tc[1]; o.col[2] = tc[2];
  o.fd = ds.fd; o.water = water;
  // ---- south port ships: dark hulls with a pale bridge aft, a wake behind the one under way, a slick of burning oil
  if (inS) for (const s of SSHIPS) {
    const ax = wx - s.x, ay = wy - s.y, u = ax * s.ca + ay * s.sa, v = -ax * s.sa + ay * s.ca, hl = s.L / 2;
    if (Math.abs(u) > hl + 1300 || Math.abs(v) > 500) continue;
    const hb = Math.max(s.B / 2, (s.ang > 1 ? (o.footH || foot * .4) : foot) * .5), bow = u > hl * .6 ? 1 - .75 * (u - hl * .6) / (hl * .4) : 1;
    const hull = inBox(u, v / Math.max(.2, bow), -hl, hl, -hb, hb, aa);
    if (s.kind === 'moving' && u < -hl) {
      const d = -hl - u, vs = Math.abs(v), fw = Math.max(20, foot * .35);
      o.foam = Math.max(o.foam, clamp(1 - vs / Math.max(hb * .9 + d * .03, foot * .55)) * Math.pow(clamp(1 - d / 1100), 1.4), clamp(1 - Math.abs(vs - hb - d * .13) / fw) * clamp(1 - d / 1200) * .6);
    }
    if (s.kind === 'burning') { const d = Math.hypot((u + (s.ang > 1 ? 0 : 160)) / (s.ang > 1 ? 260 : 480), v / (s.ang > 1 ? 160 : 210)); if (d < 1) o.oil = Math.max(o.oil, smooth(1 - d) * (.35 + .65 * pn(wx, wy, 60, 449, false))); }
    if (hull < 1) { const mu = Math.max(25, (s.ang > 1 ? foot : (o.footH || foot * .4)) * .7), mv = Math.max(20, (s.ang > 1 ? (o.footH || foot * .4) : foot) * .6); o.foam = Math.max(o.foam, inBox(u, v / Math.max(.2, bow), -hl - mu, hl + mu, -hb - mv, hb + mv, aa) * (1 - hull) * .7); }
    if (hull <= 0) continue;
    if (s.kind === 'capsized') rampAt(RAMP.ember, .12 + .3 * clamp(v / hb * .5 + .5), o.col);       // red-lead bottom up
    else rampAt(RAMP.dock, u > -hl * .4 && u < -hl * .1 && s.kind !== 'burning' ? 1 : 0, o.col);    // the bridge aft
    o.water *= 1 - hull;
    if (s.kind === 'burning') burn(o, hull * clamp((pn(wx, wy, 25, 450, false) - .25) / .2) * flick(s.x, 25, env) * 1.2);
  }
  // ---- ships: one capsized, one burning in a slick of burning oil, one at its moorings; the one burning at sea
  if (inPort) for (const b of BASINS) {
    const nb = northBank(b.x), cx = b.x + 60, cy = nb + 480, tilt = b.ship === 'capsized' ? .5 : 0;
    const ax = wx - cx, ay = wy - cy, u = ax * Math.cos(tilt) + ay * Math.sin(tilt), v = -ax * Math.sin(tilt) + ay * Math.cos(tilt);
    const hull = inBox(u, v, -18, 18, -120, 120, aa) * (1 - clamp((Math.abs(v) - 95) / 25) * clamp(Math.abs(u) / 12));
    if (b.ship === 'burning') { const d = Math.hypot(ax / 1.3, ay / 1.9); if (d < 260) o.oil = Math.max(o.oil, smooth(1 - d / 260) * (.35 + .65 * pn(wx, wy, 45, 443, false))); }
    if (hull <= 0) continue;
    if (b.ship === 'capsized') { rampAt(RAMP.ember, .15 + .25 * clamp(u / 18 + .5), o.col); }      // red-lead bottom up
    else { rampAt(RAMP.soot, b.ship === 'burning' ? .05 : .25 + .35 * clamp(1 - Math.abs(u) / 6), o.col); }
    o.water *= 1 - hull;
    if (b.ship === 'burning') burn(o, hull * clamp((pn(wx, wy, 20, 447, false) - .3) / .2) * flick(9, 23, env) * 1.1);
  }
  if (world) {
    const sh = COLS[7], d = Math.hypot((wx - sh.x) / 1.6, wy - sh.y);
    if (d < 260) { const hull = inBox(wx - sh.x, wy - sh.y, -75, 75, -11, 11, Math.max(3, foot * .5)); if (hull > 0) { rampAt(RAMP.soot, .05, o.col); o.water *= 1 - hull; } o.oil = Math.max(o.oil, smooth(1 - d / 260) * (.4 + .6 * pn(wx, wy, 60, 442, false))); }
  }
  // ---- district fires: burning blocks, and stray fires
  if (burnBlock > 0 && o.water < .5) burn(o, burnBlock * flick(bid, 3, env) * (1 - ds.burnt * .5) * (1 - o.water));
  if (ds.fd > .02 && o.water < .5) spots(x, y, foot, ds.fd * .45 * (world ? 1 - .8 * portMask(wx, wy) : 1) * (.25 + .75 * lod(100, foot)), ds.burnt, env, o.emit);
  return o;
}
// flicker of fire `id` 0.4..1.2: whole cycles per 8 s (loop-safe), plus a frame-to-frame shimmer
function flick(id, s, env) {
  const f = 3 + Math.floor(ih(id, s, 1, 450) * 9), ph = ih(id, s, 2, 450) * TAU;
  return .7 + .22 * Math.sin(TAU * f * env.time / 8 + ph) + .2 * (ih(id, s, env.frame, 451) - .5);
}
const C0 = 75;                                                       // 75 * 2^k divides P
function spots(x, y, foot, fd, burnt, env, e) {
  const L = Math.max(0, Math.ceil(Math.log2(foot * 1.25 / C0))), cell = C0 * (1 << Math.min(L, 5)), n = env.loop ? P / cell : 0;
  const ix = Math.floor(x / cell), iy = Math.floor(y / cell), jy = n ? ((iy % n) + n) % n : iy;
  const h1 = ih(ix, jy, L, 460), h2 = ih(ix, jy, L, 461), h3 = ih(ix, jy, L, 462);
  const dens = fd * (.3 + .08 * L) * (1 - burnt * .6);
  if (h1 > dens) return;
  const cx = (ix + .2 + .6 * h2) * cell, cy = (iy + .2 + .6 * h3) * cell, r = Math.max(cell * (.08 + .3 * fd * ih(ix, jy, L, 463)), foot * .62);
  const d = Math.hypot(x - cx, y - cy) / r; if (d >= 1) return;
  const h = (1 - d * d) * (.55 + .7 * ih(ix, jy, L, 464)) * flick(ix * 31 + jy, L, env) * (burnt > .5 ? .45 : 1);
  e[0] += 1.55 * h; e[1] += .72 * h * (.6 + .5 * h); e[2] += .2 * h * h;
}

// Darkness 0..1 of the long shadows of the smoke columns (they lie west of each column across the ground or the deck).
// p: [x, y, z] world point on a horizontal surface.
function columnShadow(px, py, pz) {
  let s = 0;
  for (const c of COLS) {
    if (c.kind === 'C' || c.kind === 'D' || px > c.x + 2000) continue;
    const z = pz + (c.x + lean(Math.max(0, pz - ZG)) - px) * TAN_SUN, h = z - ZG;    // height where the sun ray meets the column
    if (h < 0 || z > c.top) continue;
    const cx = c.x + lean(h), zz = pz + (cx - px) * TAN_SUN; if (zz > c.top || zz < ZG) continue;
    const r = colR(c, (zz - ZG) / (c.top - ZG)), d = Math.abs(py - c.y - (zz - ZG) * .02);
    s = Math.max(s, clamp(1.15 - d / r) * .6);
  }
  return s;
}
// radius of column c at height fraction v (0 ground .. 1 cap): pencil-thin low, flaring above
const colR = (c, v) => c.r * (.6 + 2.1 * Math.pow(v, 1.3));

// Where the loop camera (shot 8, menu) looks for the harbour: world metres, centre + half sizes. Contract between ground.cjs (draws a
// harbour there) and world.cjs/sky.cjs (keep the cloud deck open on the line of sight). Tune the numbers, keep the name.
const LOOP_PORT = { x: -5700, y: -11550, rx: 3900, ry: 1450 };                  // = SP, the south port's dock works

module.exports = { LOOP_PORT, ZG, P, COLS, portMask, lean, colR, coastX, riverY, riverHW, surface, columnShadow, districts, pn, TAN_SUN };
