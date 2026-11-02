const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'../..');
const names=['ChatGPT Image Nov 2, 2026, 02_59_54 PM-1.png','699aa16c-2d8b-45bf-be60-7da814164d27.png','d5c9719d-f583-4b7b-b119-6b4ee37271d8.png'];
(async()=>{
  const report=[];
  for(let i=0;i<names.length;i++){
    const original=path.join(root,'SourceAssets/PixelArt/Ocean',names[i]);
    const asset=path.join(root,'Game/Assets/_Project/Art/Resources/Ocean',`Ocean0${i+1}.png`);
    const bytes=fs.readFileSync(asset),meta=await sharp(bytes).metadata();
    if(!bytes.equals(fs.readFileSync(original))||meta.format!=='png'||Math.max(meta.width,meta.height)>2048)throw new Error('Ocean import mismatch: '+names[i]);
    report.push({source:names[i],resource:`Ocean/Ocean0${i+1}`,width:meta.width,height:meta.height,originalBytesPreserved:true,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
  fs.writeFileSync(path.join(__dirname,'ocean-report.json'),JSON.stringify(report,null,2));
  const wideFile=path.join(root,'Game/Assets/_Project/Art/Resources/Ocean/OceanWide.png');
  if(fs.existsSync(wideFile)){
    const wide=fs.readFileSync(wideFile),prepared=fs.readFileSync(path.join(root,'SourceAssets/PixelArt/Prepared/OceanWide.png'));
    const info=await sharp(wide).metadata();
    if(!wide.equals(prepared)||info.width/info.height<2.5)throw new Error('Wide ocean extension mismatch: '+info.width+'x'+info.height);
    fs.writeFileSync(path.join(__dirname,'ocean-extension-report.json'),JSON.stringify({width:info.width,height:info.height,runtimeImportMaximum:2048,preparedCopyMatches:true,sha256:crypto.createHash('sha256').update(wide).digest('hex')},null,2));
  }
  console.log('PASS: All three ocean PNGs are preserved intact and fit Unity texture import limits.');
})().catch(error=>{console.error(error);process.exit(1);});
