const fs = require('node:fs');
const path = require('node:path');
const { DATA_DIR, WIKI, readProfile } = require('../app/profile');
const { scan } = require('../app/server');
async function main() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--config', '--out', '--min-score'].includes(args[i]) || !args[i + 1]) throw Error('Usage: npm run scan -- [--config FILE] [--out FILE.json] [--min-score NUMBER]');
    options[args[i]] = args[i + 1];
  }
  const profile = readProfile();
  if (!profile?.completed) throw Error('Complete the questionnaire in the site before scanning.');
  const sources = JSON.parse(fs.readFileSync(options['--config'] || path.join(DATA_DIR, 'ats_sources.json'), 'utf8').replace(/^\uFEFF/, ''));
  const result = await scan(sources, profile);
  const minimum = Number(options['--min-score'] || 0);
  if (!Number.isFinite(minimum)) throw Error('Invalid minimum score.');
  result.jobs = result.jobs.filter(job => job.score >= minimum);
  const output = options['--out'] || path.join(WIKI, 'searches', `scan-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(`Saved ${result.jobs.length} discovery leads. Check original employer postings before applying.`);
  for (const board of result.boards.filter(board => board.error)) console.error(`${board.company}: ${board.error}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
