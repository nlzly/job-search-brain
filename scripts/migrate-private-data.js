// Explicit, repeatable migration. Refuses to overwrite a destination.
const fs = require('node:fs');
const path = require('node:path');
const { DATA_DIR } = require('../app/profile');
const root = path.resolve(__dirname, '..');
if (DATA_DIR !== path.join(root, '.local')) throw Error('Run legacy migration with the default .local data directory.');
fs.mkdirSync(DATA_DIR, { recursive: true });
const candidates = ['wiki', 'SEARCH_PREFERENCES.md', 'ats_sources.json', 'site', ...fs.readdirSync(root).filter(name => /\.pdf$/i.test(name) || /^data-modeling-review.*\.html$/i.test(name))];
const moves = candidates.filter(name => fs.existsSync(path.join(root, name))).map(name => ({ name, from: path.join(root, name), to: path.join(DATA_DIR, name) }));
for (const move of moves) if (fs.existsSync(move.to)) throw Error(`Destination already exists for ${move.name}; resolve manually without overwriting.`);
for (const move of moves) { fs.renameSync(move.from, move.to); console.log(`Preserved locally: ${move.name}`); }
console.log('Migration complete. Git index/history are handled separately; this script never removes Git history.');
