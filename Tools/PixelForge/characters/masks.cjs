'use strict';
// Characters: pixel masks for heads, hair, hats and face accessories.
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- masks
// Head-level masks are 14 columns wide (x 5..18) and start 3 rows above the skull (y0 - 3).
const MX = 5;
function checkMask(name, rows) { rows.forEach((r, i) => { if (r.length !== 14) throw new Error(`mask ${name} row ${i} has ${r.length} chars`); }); return rows; }
function stamp(c, rows, ox, oy, pal) {
  rows.forEach((row, ry) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.' || ch === ' ') continue; const col = pal[ch]; if (col === undefined) throw new Error('mask char ' + ch); if (col) c.put(ox + i, oy + ry, col); } });
}

const HEAD = {
  s: checkMask('head s', [
    '..............',
    '..............',
    '..............',
    '...sssssssS...',
    '..ssssssssSS..',
    '..lsssssssSS..',
    '..lsssssssSS..',
    '..sbbssssbbS..',
    '.sssessssesSZ.',
    '.SssesssseSSZ.',
    '..ssssssssSS..',
    '..ssssmmssSS..',
    '...SSSSSSSS...',
    '.....ZZZZ.....']),
  n: checkMask('head n', [
    '..............',
    '..............',
    '..............',
    '...sssssssS...',
    '..ssssssssSS..',
    '..ssssssssSS..',
    '..ssssssssSS..',
    '..ssssssssSS..',
    '.ssssssssssSZ.',
    '.SsssssssssSZ.',
    '..ssssssssSS..',
    '..ssssssssSS..',
    '...SSSSSSSS...',
    '.....ZZZZ.....']),
  e: checkMask('head e', [
    '..............',
    '..............',
    '..............',
    '....sssssss...',
    '...sssssssss..',
    '...lssssssss..',
    '...lssssssss..',
    '...sssssssbs..',
    '...sssSSsses..',
    '...sssZSsses..',
    '...ssssssssss.',
    '...ssssssssm..',
    '....SSSSSSS...',
    '......ZZZ.....'])
};

const HAIR = {
  tousled: {
    s: ['......H.......', '...dhhHHhhd...', '..dhHHhhhHhd..', '..hHhhhhhhhd..', '.dhhhhhhhhhhd.',
      '.dhhhhhhh..hd.', '..dhhhd....hd.', '..d........d..', '..d........d..'],
    n: ['......H.......', '...dhhHHhhd...', '..dhHHhhhHhd..', '..hhhhHhhhhd..', '.dhhhhhhhhhhd.', '.dhhhhhhhhhhd.',
      '.dhhhhhhhhhhd.', '..dhhhhhhhhd..', '..dhhhhhhhhd..', '..ddhhhhhhdd..', '...ddhdhhdd...'],
    e: ['.......H......', '....dhhHHhd...', '...dhHHhhhHd..', '..dhhhHhhhhhd.', '..dhhhhhhhhhd.',
      '..dhhhhhhhhd..', '..dhhhhd......', '..dhhd........', '..dhhd........', '...dhd........', '....d.........']
  },
  receding: {
    s: ['..............', '..............', '...dhhhhhhd...', '..dh......hd..', '.dhh......hhd.',
      '.dhh......hhd.', '.dh........hd.', '..h........h..', '..d........d..'],
    n: ['..............', '..............', '...dhhhhhhd...', '..dhhhhhhhhd..', '.dhhhHhhhhhhd.', '.dhhhhhhhhhhd.',
      '.dhhhhhhhhhhd.', '..hhhhhhhhhh..', '..dhhhhhhhhd..', '...dhhhhhhd...', '....dddddd....'],
    e: ['..............', '..............', '....dhhhhd....', '...dhhh.......', '..dhhhh.......',
      '..dhhhh.......', '..dhhhh.......', '..dhhd........', '..dhhd........', '...dhd........', '....d.........']
  },
  bun: {
    s: ['..............', '....dhhhhd....', '...dhHhhHhd...', '..dhhhhhhhhd..', '..hhhh..hhhh..',
      '..hhd....dhh..', '..h........h..', '..h........h..', '..d........d..', '..d........d..'],
    n: ['..............', '....dhhhhd....', '...dhhHHhhd...', '..dhhhhhhhhd..', '..hhhhhhhhhh..', '..hhhhhhhhhh..',
      '..hhhdDDdhhh..', '..hhdhHhhdhh..', '..hhdhhhhdhh..', '..dhhdDDdhhd..', '...dhhhhhhd...'],
    e: ['..............', '....dhhhhd....', '...dhhHhhhd...', '..dhhhhhhhhd..', '.ddhhhhhhhd...',
      'dhdhhhhh.hd...', 'dHhdhhhd......', 'dhhdhhd.......', '.ddhhd........', '...dhd........']
  },
  crop: {
    s: ['..............', '..............', '..............', '..............', '..dhhhhhhhhd..',
      '..dh......hd..', '..d........d..', '..d........d..'],
    n: ['..............', '..............', '..............', '...dhhhhhhd...', '..dhhhhhhhhd..', '..dhhhhhhhhd..',
      '..dhhhhhhhhd..', '..dhhhhhhhhd..', '..dhhHhhhhhd..', '..ddhhhhhhdd..', '...dddddddd...'],
    e: ['..............', '..............', '..............', '....dhhhhd....', '...dhhhhhhd...', '..dhhhhhhhhd..',
      '..dhhhh.......', '..dhhd........', '..dhd.........', '...d..........']
  },
  // Smooth crown pulled back into a high ponytail (the tail itself is drawn by drawPonytail so it
  // can sway); side-swept fringe and two loose locks framing the face.
  ponytail: {
    s: ['..............', '.....dhhd.....', '...dhHHhhhd...', '..dhHHHhhhhd..', '..hHHhhhhhhhd.',
      '.dhHhhhhhhhhd.', '.dhhhhhhh.hhd.', '.dhhhd....hhd.', '.dh........hd.', '.dh........d..', '.d............'],
    n: ['..............', '.....dhhd.....', '...dhHHhhhd...', '..dhHhhhhhhd..', '..hhhhhhhhhd..', '.dhhhhhhhhhhd.', '.dhhhhhhhhhhd.',
      '.dhhhhhhhhhhd.', '..dhhhhhhhhd..', '..dhhhhhhhhd..', '...ddhhhhdd...'],
    e: ['..............', '.....dhhhd....', '...dhHHhhhd...', '..dhHHHhhhhd..', '..dhhhhhhhhhd.',
      '..dhhhhhhhhd..', '..dhhhhhhd.hd.', '..dhhhd.......', '..dhhd........', '...dd.........']
  }
};
for (const [k, v] of Object.entries(HAIR)) for (const d of 'sne') checkMask('hair ' + k + d, v[d]);

const HAT = {
  helmet: {
    s: ['..............', '....kcCCck....', '...kcCCccck...', '..kcCCcccckk..', '..cCcccccckk..', '.cccccccccckk.',
      '.cccccccccckk.', 'kkkkkkkkkkkkKK', '..K........K..', '..K........K..', '..K........K..', '...K......K...'],
    n: ['..............', '....kcCCck....', '...kcCCccck...', '..cCcccccckk..', '..cccccccckk..', '.cccccccccckk.',
      '.cccccccccckk.', '.cccccccccckk.', 'kkkkkkkkkkkkKK'],
    e: ['..............', '....kcCCcck...', '...kcCCcccck..', '..kcCcccccckk.', '..cCccccccckk.', '.ccccccccccckk',
      '.ccccccccccckk', 'kkkkkkkkkkkkKK', '........K.....', '........K.....', '.........K....', '..........K...']
  },
  cap: {
    s: ['..............', '..............', '....kcCCck....', '...kcCCccck...', '..kcCcccccck..', '..cccccccckk..',
      '..kkkkkkkkkk..', '.bbbbbbbbbbbb.'],
    n: ['..............', '..............', '....kcCCck....', '...kcCCccck...', '..kcCcccccck..', '..cccccccckk..',
      '..cccccccckk..', '..kkkkkkkkkk..'],
    e: ['..............', '..............', '.....kcCck....', '...kcCCccck...', '..kcCcccccck..', '..cccccccckk..',
      '..kkkkkkkkkk..', '........bbbbbb']
  },
  kepi: {
    s: ['..............', '...kcCCCcck...', 'kcCCccxxcccckK', '.kccccxxccckk.', '..BBBBBBBBBB..', '..bgbbbbbbbb..'],
    n: ['..............', '...kcCCCcck...', 'kcCCcccccccckK', '.kcccccccccck.', '..BBBBBBBBBB..'],
    e: ['..............', '....kcCCck....', '.kcCCccccxcck.', '..kccccccccck.', '...BBBBBBBBB..', '.........bgbbb']
  },
  nurse: {
    s: ['..............', '..............', '....wwxxww....', '...wwxxxxwk...', '...kwwxxwwk...'],
    n: ['..............', '..............', '....wwwwww....', '...wwwwwwwk...', '...kwwwwwwk...'],
    e: ['..............', '..............', '.....wwxww....', '....wwxxxwk...', '....kwwxwwk...']
  }
};
for (const [k, v] of Object.entries(HAT)) for (const d of 'sne') checkMask('hat ' + k + d, v[d]);

const GOGGLES = {
  s: ['..............', '..............', '..............', '..tgLiggLigt..', '..tgLLggLLgt..'],
  n: ['..............', '..............', '..............', '..............', '..ttttggtttt..'],
  e: ['..............', '..............', '..............', '.........gLig.', '..tttttttgLLg.']
};
const GLASSES = {
  s: ['...glgggglg...', '...g.g..g.g...'],
  e: ['......gggglg..', '.........g.g..']
};
const MUSTACHE = { s: ['....uuuuuu....', '....u....u....'], e: ['.........uuu..', '..............'] };
for (const g of [GOGGLES, GLASSES, MUSTACHE]) for (const d of Object.keys(g)) checkMask('acc', g[d]);

module.exports = {
  MX, stamp, HEAD, HAIR, HAT, GOGGLES, GLASSES, MUSTACHE
};
