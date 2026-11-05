import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const source=path.join(project,'SourceAssets/Vocabulary/Oxford');
const html=JSON.parse(fs.readFileSync(path.join(source,'oxford-index.json')));
const normalize=s=>s.replace(/[™®]/g,'').normalize('NFKC').toLowerCase().replace(/[’]/g,"'").replace(/[‐‑–]/g,'-').replace(/\s+/g,' ').trim();
const posSource='(?:indefinite article|definite article|infinitive marker|auxiliary v\\.|modal v\\.|linking v\\.|ordinal number|number|noun\\.|(?:adj|adv|prep|pron|det|conj|exclam|n|v)\\.)';
const posPattern=new RegExp('(?<=\\s)'+posSource);
const extracted=[];
for(const name of ['official-oxford-3000','official-oxford-5000-additions']) {
 const pages=JSON.parse(fs.readFileSync(path.join(source,name+'-text.json')));
 const logical=[];
 for(const page of pages) {
  for(let column=0;column<4;column++) {
   const items=page.items.filter(item=>item.y>44&&item.height<10&&!(item.height<8&&/^\d+$/.test(item.text))&& (item.x>=433.8?3:item.x>=303.2?2:item.x>=172.7?1:0)===column);
   const rows=[];
   for(const item of items) {
    let row=rows.find(row=>Math.abs(row.y-item.y)<0.8);
    if(!row){row={y:item.y,items:[]};rows.push(row);}
    row.items.push(item);
   }
   const lines=rows.sort((a,b)=>b.y-a.y).map(row=>({items:row.items.sort((a,b)=>a.x-b.x),text:row.items.sort((a,b)=>a.x-b.x).map(item=>item.text).join(' ').replace(/\s+([,./])/g,'$1').replace(/\s+/g,' ').trim()}));
   let current=null;
   for(const line of lines) {
    if(line.items[0].font?.endsWith('_f4')) {
     current={text:line.text,page:page.page,column:column+1,file:name};logical.push(current);
    } else if(current) current.text+=' '+line.text;
   }
  }
 }
 for(const entry of logical) {
  const position=posPattern.exec(entry.text);
  if(!position)continue;
  let rawHeadword=entry.text.slice(0,position.index).trim();
  const qualifier=rawHeadword.match(/\((.*?)\)/)?.[1]||'';
  let headword=rawHeadword.replace(/\s*\(.*?\)/g,'').replace(/\s*[12]$/,'').trim();
  const tail=entry.text.slice(position.index);
  const words=headword.split(/,\s*/).map(w=>w.trim());
  const homograph=rawHeadword.replace(/\s*\(.*?\)/g,'').match(/\s*([12])$/)?.[1]||'';
  extracted.push({...entry,rawHeadword,headword,words,tail,qualifier,homograph});
 }
 console.log(name+': '+logical.length+' logical headword rows.');
}
const mapPos={'n.':'noun','noun.':'noun','v.':'verb','adj.':'adjective','adv.':'adverb','prep.':'preposition','pron.':'pronoun','det.':'determiner','conj.':'conjunction','exclam.':'exclamation','auxiliary v.':'auxiliary verb','modal v.':'modal verb','linking v.':'linking verb'};
const slots=new Map();
for(const entry of extracted) {
  let pending=[],previous=[];
  for(const token of entry.tail.matchAll(new RegExp(posSource+'|\\b(?:A1|A2|B1|B2|C1)\\b','g'))) {
    if(/^(A1|A2|B1|B2|C1)$/.test(token[0])) {
      const positions=pending.length?pending:previous;
      for(const word of entry.words)for(let pos of positions) {
        if(pos==='number'&&['first','second','third','fourth','fifth'].includes(normalize(word)))pos='ordinal number';
        const key=[normalize(word),pos,token[0],entry.qualifier||entry.homograph].join('|');
        const slot={key,word:word.replace(/[™®]/g,''),pos,cefr:token[0],qualifier:entry.qualifier,homograph:entry.homograph,pdfFile:entry.file,pdfPage:entry.page,pdfText:entry.text};
        if(!slots.has(key))slots.set(key,slot);
      }
      previous=positions;pending=[];
    } else pending.push(mapPos[token[0]]||token[0]);
  }
}
const known=new Set(html.map(e=>normalize(e.word)));
const missing=[];
for(const entry of extracted)for(const word of entry.words)if(!known.has(normalize(word)))missing.push({...entry,word});
const htmlKeys=new Map();for(const entry of html){const key=[normalize(entry.word),entry.pos,entry.cefr].join('|');if(!htmlKeys.has(key))htmlKeys.set(key,[]);htmlKeys.get(key).push(entry);}
const consumed=new Map();
const missingSlots=[];
for(const slot of slots.values()) {
  const key=[normalize(slot.word),slot.pos,slot.cefr].join('|');
  const used=consumed.get(key)||0;
  if(used>=(htmlKeys.get(key)?.length||0))missingSlots.push(slot);
  consumed.set(key,used+1);
}
const report={pdfHeadwordRows:extracted.length,pdfStudySlots:slots.size,pdfDistinctSpellings:new Set(extracted.flatMap(e=>e.words.map(normalize))).size,
 catalogDistinctSpellings:known.size,missingHeadwords:missing,referenceMetadataDifferences:missingSlots.map(slot=>({...slot,currentWebsiteRecords:html.filter(e=>normalize(e.word)===normalize(slot.word)).map(e=>({pos:e.pos,cefr:e.cefr,sourceUrl:e.sourceUrl}))})),
 headwordCoveragePercent:missing.length===0?100:null,scope:'Every headword in the two official Oxford 3000/5000 PDF downloads; POS/CEFR discrepancies retained for review.'};
fs.writeFileSync(path.join(source,'official-pdf-entries.json'),JSON.stringify(extracted,null,2));
fs.writeFileSync(path.join(source,'official-pdf-slots.json'),JSON.stringify([...slots.values()],null,2));
fs.writeFileSync(path.join(source,'pdf-reconciliation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,referenceMetadataDifferences:report.referenceMetadataDifferences.length},null,2));
