import fs from 'fs';

const ids = ['r7qovpFAGrQ','xFYQQPAOz7Y','C7dPqrmDWxs','UXWFqxKU2qA','WDaNJW_jEBo'];
const glossary = JSON.parse(fs.readFileSync('public/glossary.json', 'utf8'));

const words = new Set();
for (const id of ids) {
  const lrc = fs.readFileSync(`public/lyrics/${id}.lrc`, 'utf8');
  for (const line of lrc.split('\n')) {
    const text = line.replace(/\[\d{2}:\d{2}\.\d{2}\]/, '').trim();
    for (const w of text.split(/\s+/)) {
      const clean = w.replace(/[^a-zA-Z']/g, '').toLowerCase();
      if (clean && !glossary[clean]) words.add(clean);
    }
  }
}
const sorted = [...words].sort();
fs.writeFileSync('scripts/new-words.json', JSON.stringify(sorted, null, 2));
console.log(sorted.length, 'new words ->', 'scripts/new-words.json');
