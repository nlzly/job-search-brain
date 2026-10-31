// Allowlisted source-only export. Never copies Git metadata or user data.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const destination = path.join(root, 'share', 'job-search-brain');
if (fs.existsSync(destination)) throw Error('Share folder already exists. Move it aside before creating a new export.');
const entries = ['.gitignore', 'AGENTS.md', 'README.md', 'ATS_DISCOVERY.md', 'package.json', 'app', 'scripts', 'templates', 'test'];
fs.mkdirSync(destination, { recursive: true });
for (const entry of entries) {
  const source = path.join(root, entry);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(destination, entry), { recursive: true, filter: file => !['node_modules', '.git', '__pycache__'].includes(path.basename(file)) });
}
execFileSync('git', ['init', '--quiet', destination]);
console.log('Clean source-only repository created at share/job-search-brain. No personal records or original Git history copied.');
