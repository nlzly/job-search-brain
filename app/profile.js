const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(process.env.JOB_SEARCH_DATA_DIR || path.join(ROOT, '.local'));
const PROFILE = path.join(DATA_DIR, 'profile.json');
const WIKI = path.join(DATA_DIR, 'wiki');
function ensureWorkspace() {
  for (const dir of [DATA_DIR, WIKI, ...['jobs', 'companies', 'searches', 'applications'].map(dir => path.join(WIKI, dir))]) fs.mkdirSync(dir, { recursive: true });
  const sources = path.join(DATA_DIR, 'ats_sources.json');
  if (!fs.existsSync(sources)) fs.writeFileSync(sources, '[]\n');
}
function readProfile() {
  if (!fs.existsSync(PROFILE)) return null;
  return JSON.parse(fs.readFileSync(PROFILE, 'utf8').replace(/^\uFEFF/, ''));
}
function validateProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Please provide your search preferences.');
  const list = (key, required = false) => {
    const values = input[key];
    if (!Array.isArray(values) || values.length > 50 || values.some(value => typeof value !== 'string' || value.length > 160 || /[\r\n]/.test(value))) throw Error(`Invalid ${key}.`);
    const result = [...new Set(values.map(value => value.trim()).filter(Boolean))];
    if (required && !result.length) throw Error(`Please select or enter ${key}.`);
    return result;
  };
  const profile = { version: 1, completed: true, roleTitles: list('roleTitles', true), skills: list('skills'), interests: list('interests'), countries: list('countries', true), workModels: list('workModels', true), exclusions: list('exclusions'), preferredLocations: list('preferredLocations'), minSalary: input.minSalary, includeContract: input.includeContract, allowUnknownLocation: input.allowUnknownLocation, timezone: input.timezone || 'UTC' };
  if (typeof profile.timezone !== 'string' || profile.timezone.length > 100) throw Error('Invalid timezone.');
  try { new Intl.DateTimeFormat('en', { timeZone: profile.timezone }); } catch { throw Error('Invalid timezone.'); }
  if (profile.countries.some(code => !['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ANY'].includes(code))) throw Error('Unsupported country selection.');
  if (profile.workModels.some(model => !['remote', 'hybrid', 'onsite'].includes(model))) throw Error('Invalid work model.');
  if (typeof profile.minSalary !== 'number' || !Number.isFinite(profile.minSalary) || profile.minSalary < 0 || profile.minSalary > 10000000) throw Error('Enter a valid minimum annual salary in USD.');
  if (typeof profile.includeContract !== 'boolean' || typeof profile.allowUnknownLocation !== 'boolean') throw Error('Invalid preference options.');
  return profile;
}
function preferencesMarkdown(profile) {
  const lines = values => values.length ? values.map(value => `- ${value}`).join('\n') : '- Not specified.';
  return `# Search preferences\n\nUpdated: ${new Date().toISOString()}\nTimezone: ${profile.timezone}\n\nRead SEARCH_NOTES.md when present for additional user instructions.\n\n## Target roles\n${lines(profile.roleTitles)}\n\n## Skills and experience\n${lines(profile.skills)}\n\n## Optional interests and hobbies\n${lines(profile.interests)}\n\nInterests are positive signals, not hard requirements.\n\n## Location and work model\n- Countries: ${profile.countries.join(', ')}\n- Work models: ${profile.workModels.join(', ')}\n- Unknown location eligibility: ${profile.allowUnknownLocation ? 'include, clearly flagged' : 'exclude'}\n- Never infer work authorization, citizenship, or sponsorship eligibility.\n\nPreferred locations:\n${lines(profile.preferredLocations)}\n\n## Compensation and employment\n- Target annual salary: ${profile.minSalary ? `USD ${profile.minSalary}` : 'not specified'}. Compare base salary separately from equity and bonuses.\n- Contract roles: ${profile.includeContract ? 'include' : 'exclude'}.\n- Lower or undisclosed salaries may be reviewed, but must be flagged.\n\n## Exclusions\n${lines(profile.exclusions)}\n\n## Search records\n- Show the top 10 newly found roles for the day; do not pad with excluded or closed roles.\n- Verify employer application pages and deduplicate by canonical URL and requisition ID.\n- Archive concise evidence and unknowns in wiki/ beneath the private data directory.\n- Search and archive only; do not apply, contact recruiters, or submit personal information.\n`;
}
function saveProfile(input) {
  const profile = validateProfile(input);
  ensureWorkspace();
  const preferences = path.join(DATA_DIR, 'SEARCH_PREFERENCES.md');
  if (fs.existsSync(preferences)) {
    const history = path.join(DATA_DIR, 'preferences-history');
    fs.mkdirSync(history, { recursive: true });
    fs.copyFileSync(preferences, path.join(history, `${Date.now()}-${process.hrtime.bigint()}.md`), fs.constants.COPYFILE_EXCL);
  }
  fs.writeFileSync(preferences, preferencesMarkdown(profile));
  const temp = PROFILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(profile, null, 2) + '\n');
  fs.renameSync(temp, PROFILE);
  return profile;
}
module.exports = { DATA_DIR, WIKI, ensureWorkspace, readProfile, saveProfile, validateProfile };
