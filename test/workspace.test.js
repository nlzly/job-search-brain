const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'job-search-test-'));
process.env.JOB_SEARCH_DATA_DIR = root;
const { server, scan, isExplicitlyUS } = require('../app/server');
const { readProfile, validateProfile } = require('../app/profile');
const { evaluate, exclusion } = require('../app/matching');
const sample = { roleTitles: ['Software Engineer'], skills: ['Rust'], interests: ['aquarium'], countries: ['CA'], workModels: ['remote'], preferredLocations: [], exclusions: ['military'], minSalary: 120000, includeContract: false, allowUnknownLocation: false };
let base;
before(async () => { await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); });
const put = data => fetch(`${base}/api/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

test('fresh workspace contains no personal records and redirects both entry pages', async () => {
  assert.equal(readProfile(), null);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'ats_sources.json'))), []);
  assert.deepEqual((await (await fetch(`${base}/api/saved`)).json()).jobs, []);
  for (const entry of ['/', '/saved.html']) {
    const response = await fetch(base + entry, { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/onboarding.html');
  }
  const response = await fetch(`${base}/api/scan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 409);
});
test('questionnaire validates before creating a profile, then saves and survives rereading', async () => {
  assert.equal((await put({ ...sample, countries: [] })).status, 400);
  assert.equal(readProfile(), null);
  assert.equal((await put({ ...sample, minSalary: -1 })).status, 400);
  assert.equal((await put(sample)).status, 200);
  assert.equal(readProfile().completed, true);
  assert.deepEqual(readProfile().countries, ['CA']);
  assert.match(fs.readFileSync(path.join(root, 'SEARCH_PREFERENCES.md'), 'utf8'), /120000/);
  assert.equal((await fetch(base + '/', { redirect: 'manual' })).status, 200);
});
test('editing preferences preserves prior detailed notes and does not touch records', async () => {
  const preferences = path.join(root, 'SEARCH_PREFERENCES.md');
  fs.appendFileSync(preferences, '\nAdditional user constraint.\n');
  const record = path.join(root, 'wiki', 'applications', 'submitted.pdf');
  const bytes = Buffer.from([0, 1, 255, 4]); fs.writeFileSync(record, bytes);
  assert.equal((await put({ ...sample, minSalary: 140000 })).status, 200);
  const history = fs.readdirSync(path.join(root, 'preferences-history'));
  assert.ok(history.some(file => fs.readFileSync(path.join(root, 'preferences-history', file), 'utf8').includes('Additional user constraint.')));
  assert.deepEqual(fs.readFileSync(record), bytes);
  assert.equal(readProfile().minSalary, 140000);
});
test('matching uses each user profile rather than the original user stack and country', () => {
  const job = { title: 'Software Engineer', description: 'Build Rust aquarium software', location: 'Canada - Remote', salary: '$130K - $150K', employmentType: 'FullTime' };
  assert.equal(exclusion(job, sample, isExplicitlyUS), null);
  assert.equal(exclusion({ ...job, location: 'United States - Remote' }, sample, isExplicitlyUS), 'location');
  assert.equal(exclusion({ ...job, location: 'Canada - Onsite' }, sample, isExplicitlyUS), 'preference');
  assert.equal(exclusion({ ...job, description: 'Military software' }, sample, isExplicitlyUS), 'preference');
  assert.equal(exclusion({ ...job, employmentType: 'Contract' }, sample, isExplicitlyUS), 'preference');
  assert.ok(evaluate(job, sample).score > evaluate(job, { ...sample, skills: ['React'], interests: [] }).score);
  assert.match(evaluate(job, sample).matched, /salary target/);
  assert.match(evaluate(job, { ...sample, minSalary: 160000 }).matched, /below-target/);
  assert.equal(exclusion({ ...job, location: 'Remote' }, sample, isExplicitlyUS), 'location');
  assert.equal(exclusion({ ...job, location: 'Remote' }, { ...sample, allowUnknownLocation: true }, isExplicitlyUS), null);
  assert.equal(exclusion({ ...job, location: 'Germany' }, { ...sample, allowUnknownLocation: true }, isExplicitlyUS), 'location');
  assert.match(evaluate({ ...job, description: 'C# and .NET' }, { ...sample, skills: ['C#', '.NET'] }).matched, /C#, .NET/);
});
test('scan integrates profile filtering and scoring on a public-board fixture', async () => {
  const original = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ jobs: [
    { id: '1', title: 'Software Engineer', jobUrl: 'https://example.org/job/1', location: 'Canada', workplaceType: 'Remote', employmentType: 'FullTime', isListed: true, descriptionPlain: 'Rust aquarium', compensation: {} },
    { id: '2', title: 'Software Engineer', jobUrl: 'https://example.org/job/2', location: 'United States', workplaceType: 'Remote', isListed: true },
    { id: '3', title: 'Software Engineer', location: 'Canada', isListed: false }
  ] }) });
  try {
    const result = await scan([{ company: 'Example', ats: 'ashby', board: 'example' }], sample);
    assert.equal(result.jobs.length, 1);
    assert.match(result.jobs[0].matched, /Rust/);
    assert.equal(result.filtered.nonUS, 1);
  } finally { global.fetch = original; }
});
test('API protects preference writes and does not serve private files', async () => {
  assert.equal((await fetch(`${base}/api/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: 'https://example.org' }, body: JSON.stringify(sample) })).status, 403);
  assert.equal((await fetch(`${base}/api/profile`, { method: 'PUT', body: JSON.stringify(sample) })).status, 415);
  for (const url of ['/.local/profile.json', '/profile.json', '/wiki/applications/submitted.pdf']) assert.equal((await fetch(base + url)).status, 404);
  assert.throws(() => validateProfile({ ...sample, skills: ['line\ninjection'] }));
});
test('saved roles retain company context after private-storage migration', async () => {
  fs.writeFileSync(path.join(root, 'wiki/jobs/example.md'), '---\ntitle: "Software Engineer"\ncompany: "Example"\nstatus: "open"\nfit_score: 80\n---\n\nPrivate assessment.');
  fs.writeFileSync(path.join(root, 'wiki/companies/example.md'), '---\nwebsite: "https://example.org/"\n---\n\n## About\n\nBuilds example products.\n\n- [Role](../jobs/example.md)');
  const { jobs } = await (await fetch(`${base}/api/saved`)).json();
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].companyDescription, 'Builds example products.');
  assert.equal(jobs[0].companyWebsite, 'https://example.org/');
});
