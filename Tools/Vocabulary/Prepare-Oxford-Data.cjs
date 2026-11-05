const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const source = path.join(root, 'SourceAssets/Vocabulary/Oxford');
const raw = path.join(source, 'Raw');
fs.mkdirSync(raw, { recursive: true });
const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
const normalize = s => s.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
async function json(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Wordwing-personal-vocabulary-import' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}
async function main() {
  const html = fs.readFileSync(path.join(source, 'oxford-wordlist.html'), 'utf8');
  const entries = [...html.matchAll(/<li\b([^>]*data-hw[^>]*)>([\s\S]*?)<\/li>/g)].map(match => {
    const attr = name => decode(match[1].match(new RegExp(name + '="([^"]*)"'))?.[1] || '');
    return { word: decode(match[2].match(/<a[^>]*>([^<]*)<\/a>/)?.[1] || attr('data-hw')).replace(/[™®]/g,'').trim(), pos: match[2].match(/<span class="pos">([^<]*)<\/span>/)?.[1],
      cefr: attr('data-ox5000').toUpperCase(), oxford3000: !!attr('data-ox3000'),
      sourceUrl: 'https://www.oxfordlearnersdictionaries.com' + (match[2].match(/href="([^"]*)"/)?.[1] || '') };
  });
  if (entries.length < 5000 || entries.some(e => !e.word || !e.pos || !/^(A1|A2|B1|B2|C1)$/.test(e.cefr))) throw new Error('Oxford metadata validation failed.');
  const supplementsFile=path.join(source,'pdf-supplements.json');
  if(fs.existsSync(supplementsFile))for(const supplement of JSON.parse(fs.readFileSync(supplementsFile))) {
    const pdfName=supplement.pdfFile==='official-oxford-3000'?'The_Oxford_3000.pdf':'The_Oxford_5000.pdf';
    entries.push({...supplement,oxford3000:supplement.pdfFile==='official-oxford-3000',meaningOverride:supplement.meaning,topicsOverride:supplement.topics,
      sourceUrl:'https://www.oxfordlearnersdictionaries.com/external/pdf/wordlists/oxford-3000-5000/'+pdfName+'#page='+supplement.pdfPage+'&word='+encodeURIComponent(supplement.word)+'&pos='+encodeURIComponent(supplement.pos)+'&sense='+encodeURIComponent(supplement.qualifier)});
  }
  entries.sort((a,b)=>normalize(a.word).localeCompare(normalize(b.word),'en')||a.pos.localeCompare(b.pos)||a.cefr.localeCompare(b.cefr));
  fs.writeFileSync(path.join(source, 'oxford-index.json'), JSON.stringify(entries, null, 2));
  console.log(`Oxford index: ${entries.length} word/POS rows, ${new Set(entries.map(e => e.word)).size} distinct spellings.`);

  let commit;
  const commitFile = path.join(source, 'dictionary-commit.json');
  if (fs.existsSync(commitFile)) commit = JSON.parse(fs.readFileSync(commitFile));
  else { commit = await json('https://api.github.com/repos/thichhoc-org/thichhoc-dict/commits/main'); fs.writeFileSync(commitFile, JSON.stringify({ sha: commit.sha, tree: commit.commit.tree.sha })); }
  const tree = await json(`https://api.github.com/repos/thichhoc-org/thichhoc-dict/git/trees/${commit.sha}?recursive=1`);
  const shards = tree.tree.filter(e => /^dict-en-vi\/data\/entries\/[a-z0-9-]+\.jsonl$/.test(e.path));
  const words = new Set(entries.map(e => normalize(e.word)));
  const aliases = {
    colour:'color', coloured:'colored', colourful:'colorful', favourite:'favorite', favour:'favor', behaviour:'behavior', centre:'center', theatre:'theater',
    litre:'liter', metre:'meter', kilometre:'kilometer', travelling:'traveling', traveller:'traveler', cancelled:'canceled', cancellation:'cancellation',
    defence:'defense', offence:'offense', licence:'license', practise:'practice', programme:'program', grey:'gray', mould:'mold', moustache:'mustache',
    pyjamas:'pajamas', jewellery:'jewelry', cheque:'check', cosy:'cozy', aeroplane:'airplane', aluminium:'aluminum', artefact:'artifact',
    sceptical:'skeptical', scepticism:'skepticism', analyse:'analyze', paralyse:'paralyze', apologise:'apologize', organisation:'organization',
    organise:'organize', recognise:'recognize', realise:'realize', emphasise:'emphasize', criticise:'criticize', characterise:'characterize',
    specialise:'specialize', specialise:'specialize', summarise:'summarize', visualise:'visualize', authorise:'authorize', prioritise:'prioritize',
    labour:'labor', neighbour:'neighbor', neighbouring:'neighboring', harbour:'harbor', humour:'humor', honour:'honor', rumour:'rumor', odour:'odor',
    coloured:'colored', flavour:'flavor', savoury:'savory', 'ice cream':'ice-cream', 'per cent':'percent', 'a.m.':'am', 'p.m.':'pm'
  };
  for (const word of [...words]) {
    if (aliases[word]) words.add(aliases[word]);
    if (/isation$/.test(word)) words.add(word.replace(/isation$/, 'ization'));
    if (/ise$/.test(word)) words.add(word.replace(/ise$/, 'ize'));
  }
  const matched = new Map();
  let cursor = 0, completed = 0;
  async function worker() {
    while (cursor < shards.length) {
      const shard = shards[cursor++];
      const file = path.join(raw, path.basename(shard.path));
      let text;
      if (fs.existsSync(file)) text = fs.readFileSync(file, 'utf8');
      else {
        const response = await fetch(`https://raw.githubusercontent.com/thichhoc-org/thichhoc-dict/${commit.sha}/${shard.path}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${shard.path}`);
        text = await response.text();
        const actual = crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
        if (actual !== shard.sha) throw new Error(`Git object hash mismatch: ${shard.path}`);
        fs.writeFileSync(file, text);
      }
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        const entry = JSON.parse(line);
        if (words.has(normalize(entry.headword))) matched.set(entry.id, entry);
      }
      completed++;
      if (completed % 15 === 0 || completed === shards.length) console.log(`Open dictionary: ${completed}/${shards.length} shards read.`);
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  fs.writeFileSync(path.join(source, 'dictionary-matches.json'), JSON.stringify([...matched.values()].sort((a,b)=>a.id.localeCompare(b.id))));
  fs.writeFileSync(path.join(source, 'spelling-aliases.json'), JSON.stringify(aliases, null, 2));
  console.log(`Dictionary: ${matched.size} matching word/POS records; pinned commit ${commit.sha.slice(0,12)}.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
