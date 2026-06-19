import fs from 'fs';
import { extra } from './new-glossary.mjs';

const glossary = JSON.parse(fs.readFileSync('public/glossary.json', 'utf8'));
let added = 0;
for (const [k, v] of Object.entries(extra)) {
  if (!glossary[k]) {
    glossary[k] = v;
    added++;
  }
}
const sorted = Object.fromEntries(Object.entries(glossary).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync('public/glossary.json', JSON.stringify(sorted, null, 2) + '\n', 'utf8');
console.log('Added', added, 'words. Total:', Object.keys(sorted).length);
