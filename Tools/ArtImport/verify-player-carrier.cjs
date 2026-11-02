const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const root = path.resolve(__dirname, '../..');
(async () => {
  const report = [];
  for (const name of ['UserPlayer.png', 'UserCarrier.png', 'UserEnemy.png', 'UserMissile.png']) {
    const file = path.join(root, 'Game/Assets/_Project/Art/Resources/Art', name);
    const prepared = path.join(root, 'SourceAssets/PixelArt/Prepared', name);
    if (!fs.readFileSync(file).equals(fs.readFileSync(prepared))) throw new Error('Prepared source differs: ' + name);
    const metadata = await sharp(file).metadata();
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let clear = 0, opaque = 0;
    for (let i = 3; i < data.length; i += 4) { if (data[i] === 0) clear++; if (data[i] === 255) opaque++; }
    if (!metadata.hasAlpha || clear === 0 || opaque === 0 || data[3] !== 0) throw new Error('Missing transparent cutout: ' + name);
    report.push({ file: name, width: info.width, height: info.height, hasAlpha: true,
      transparentPixels: clear, opaquePixels: opaque, cornerTransparent: true,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') });
  }
  fs.writeFileSync(path.join(__dirname, 'player-carrier-report.json'), JSON.stringify(report, null, 2));
  console.log('PASS: All four models are transparent PNGs; runtime copies match the prepared source assets.');
})().catch(error => { console.error(error); process.exit(1); });
