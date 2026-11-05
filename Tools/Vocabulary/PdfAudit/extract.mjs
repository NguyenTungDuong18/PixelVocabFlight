import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from './node_modules/pdfjs-dist/legacy/build/pdf.mjs';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const source=path.join(project,'SourceAssets/Vocabulary/Oxford');
for(const name of ['official-oxford-3000','official-oxford-5000-additions']) {
  const pdf=await getDocument({data:new Uint8Array(fs.readFileSync(path.join(source,name+'.pdf'))),isEvalSupported:false,useSystemFonts:false,disableFontFace:true}).promise;
  const pages=[];
  for(let p=1;p<=pdf.numPages;p++) {
    const page=await pdf.getPage(p);
    const content=await page.getTextContent();
    const viewport=page.getViewport({scale:1});
    const items=content.items.filter(item=>item.str?.trim()).map(item=>({text:item.str,font:item.fontName,x:item.transform[4],y:item.transform[5],width:item.width,height:item.height}));
    pages.push({page:p,width:viewport.width,height:viewport.height,items});
  }
  fs.writeFileSync(path.join(source,name+'-text.json'),JSON.stringify(pages,null,2));
  console.log(name+': '+pages.length+' pages, '+pages.reduce((sum,page)=>sum+page.items.length,0)+' text items.');
  console.log(JSON.stringify(pages[0].items.slice(4,14)));
  await pdf.destroy();
}
