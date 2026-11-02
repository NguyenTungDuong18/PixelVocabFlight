const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const root = path.resolve(__dirname, '../..');
const pairs = [
  ['stealth-bomber-pixel-art-style-260nw-2646708681.jpg', 'UserEnemy.png'],
  ['missile-pixel-art-style-260nw-2514365451.jpg', 'UserMissile.png']
];
(async () => {
  const report = [];
  for (const [name, output] of pairs) {
    const source = path.join(root, 'SourceAssets/PixelArt/UserSelected', name);
    const destination = path.join(root, 'SourceAssets/PixelArt/ConvertedReference', output);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const meta = await sharp(source).metadata();
    await sharp(source).keepMetadata().png().toFile(destination);
    const originalPixels = await sharp(source).ensureAlpha().raw().toBuffer();
    const importedPixels = await sharp(destination).ensureAlpha().raw().toBuffer();
    if (!originalPixels.equals(importedPixels)) throw new Error('Decoded pixels changed: ' + name);
    report.push({ source: name, detectedFormat: meta.format, destination: path.relative(root,destination),
      width: meta.width, height: meta.height, decodedPixelsIdentical: true,
      pixelSha256: crypto.createHash('sha256').update(originalPixels).digest('hex') });
  }
  fs.writeFileSync(path.join(__dirname, 'conversion-report.json'), JSON.stringify(report, null, 2));
  console.log('PASS: Two WebP files with .jpg extensions converted to PNG; decoded pixels and source footers retained exactly.');
})().catch(error => { console.error(error); process.exit(1); });
