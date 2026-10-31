const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { DATA_DIR, WIKI, ensureWorkspace, readProfile, saveProfile } = require('./profile');
const matching = require('./matching');

const PORT = Number(process.env.PORT || 4173);
const CONFIG = path.join(DATA_DIR, 'ats_sources.json');
ensureWorkspace();
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const usStates = ['alabama','alaska','arizona','arkansas','california','colorado','connecticut','delaware','florida','georgia','hawaii','idaho','illinois','indiana','iowa','kansas','kentucky','louisiana','maine','maryland','massachusetts','michigan','minnesota','mississippi','missouri','montana','nebraska','nevada','new hampshire','new jersey','new mexico','new york','north carolina','north dakota','ohio','oklahoma','oregon','pennsylvania','rhode island','south carolina','south dakota','tennessee','texas','utah','vermont','virginia','washington','west virginia','wisconsin','wyoming','district of columbia'];

function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
function clean(value) { return String(value || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim(); }
function configRead() { return JSON.parse(fs.readFileSync(CONFIG, 'utf8').replace(/^\uFEFF/, '')); }
function configWrite(items) { fs.writeFileSync(CONFIG, JSON.stringify(items, null, 2) + '\n', 'utf8'); }
async function requestJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 131072) throw Error('Request is too large.');
  }
  return JSON.parse(body);
}
async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'JobSearchBrainATSDiscovery/1.0 (personal research)', 'Accept': 'application/json' }, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  return response.json();
}
async function fetchBoard(source) {
  const ats = source.ats.toLowerCase();
  const board = encodeURIComponent(source.board);
  if (ats === 'greenhouse') {
    const data = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`);
    return (data.jobs || []).map(j => { const locationName=j.location?.name || ''; const officeEvidence=!locationName ? (j.offices||[]).map(x=>x.location||'').join('; ') : ''; return { title:j.title, url:j.absolute_url, location:locationName, usEvidence:`${locationName}; ${officeEvidence}`, country:j.location?.country || j.country || '', workplaceType:'', employmentType:'', salary:'', department:(j.departments||[]).map(x=>x.name).join(', '), team:(j.offices||[]).map(x=>x.name).join(', '), updated:j.updated_at || j.first_published || '', description:clean(j.content) }; });
  }
  if (ats === 'lever') {
    const host = source.region === 'eu' ? 'api.eu.lever.co' : 'api.lever.co';
    const data = await fetchJson(`https://${host}/v0/postings/${board}?mode=json`);
    return data.map(j => ({ title:j.text, url:j.hostedUrl, location:j.categories?.location || '', usEvidence:`${j.categories?.location||''}; ${(j.categories?.allLocations||[]).join('; ')}`, country:j.country || j.categories?.country || '', workplaceType:'', employmentType:j.categories?.commitment || '', salary:j.salaryDescriptionPlain || '', department:j.categories?.department || '', team:j.categories?.team || '', updated:j.createdAt ? new Date(j.createdAt).toISOString() : '', description:clean(j.descriptionPlain || j.description) }));
  }
  if (ats === 'ashby') {
    const data = await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=true`);
    return (data.jobs || []).filter(j => j.isListed !== false).map(j => { const address=j.address?.postalAddress || {}; const secondary=(j.secondaryLocations||[]).map(x=>x.location||'').join('; '); return { title:j.title, url:j.jobUrl, location:j.location || '', usEvidence:`${j.location||''}; ${secondary}; ${address.addressLocality||''}; ${address.addressRegion||''}; ${address.addressCountry||''}`, country:address.addressCountry || '', workplaceType:j.workplaceType || '', employmentType:j.employmentType || '', salary:j.compensation?.scrapeableCompensationSalarySummary || j.compensation?.compensationTierSummary || '', department:j.department || '', team:j.team || '', updated:j.publishedAt || '', description:clean(j.descriptionPlain || j.descriptionHtml) }; });
  }
  throw new Error(`Unknown ATS: ${source.ats}`);
}
function isExplicitlyUS(job) {
  const country = String(job.country || '').trim();
  if (/^(US|USA|U\.S\.?|United States|United States of America)$/i.test(country)) return true;
  const evidence = `${job.location || ''} ${job.usEvidence || ''} ${country}`.toLowerCase();
  if (/\b(united states|united states of america|usa|u\.s\.a?\.?|us|us-based|us based)\b/i.test(evidence)) return true;
  if (usStates.some(state => new RegExp(`\\b${state.replace(/ /g, '\\s+')}\\b`, 'i').test(evidence))) return true;
  if (/,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/i.test(evidence)) return true;
  if (/\bUS\s*[-:–]\s*(remote|hybrid|[A-Z][a-z])/i.test(evidence)) return true;
  const postingText = String(job.description || '');
  return /candidates?\s+(?:must|need to|are expected to)\s+(?:be\s+)?(?:located|based)\s+in\s+(?:the\s+)?(?:United States|U\.S\.?|USA)\b/i.test(postingText) ||
    /(?:remote|open)\s+(?:role|position)?\s*(?:across|within|in|to candidates in)\s+(?:the\s+)?(?:United States|U\.S\.?|USA)\b/i.test(postingText) ||
    /open to candidates anywhere in the (?:U\.S\.?|United States)\b/i.test(postingText);
}
async function scan(sources, profile) {
  const results = await Promise.all(sources.map(async source => {
    try {
      const jobs = await fetchBoard(source);
      return { source, jobs:jobs.map(job => ({...job, company:source.company || source.board, ats:source.ats})), error:null };
    } catch (e) { return { source, jobs:[], error:e.message || String(e) }; }
  }));
  const allJobs = results.flatMap(group => group.jobs);
  const filtered = { nonEngineering:0, nonUS:0, preferenceExcluded:0 };
  const eligible = [];
  for (const job of allJobs) {
    if (!/engineer|developer|programmer|\bsre\b/i.test(job.title) && !profile.roleTitles.some(title => job.title.toLowerCase().includes(title.toLowerCase()))) { filtered.nonEngineering++; continue; }
    const reason = matching.exclusion(job, profile, isExplicitlyUS);
    if (reason === 'location') { filtered.nonUS++; continue; }
    if (reason) { filtered.preferenceExcluded++; continue; }
    eligible.push({...job, ...matching.evaluate(job, profile)});
  }
  const seen = new Map();
  for (const job of eligible) {
    const key = job.url || `${job.ats}:${job.company}:${job.title}`;
    if (!seen.has(key) || seen.get(key).score < job.score) seen.set(key, job);
  }
  return { ranAt:new Date().toISOString(), totalPostings:allJobs.length, filtered, boards:results.map(x=>({ company:x.source.company || x.source.board, ats:x.source.ats, count:x.jobs.length, error:x.error })), jobs:[...seen.values()].sort((a,b)=>b.score-a.score || a.company.localeCompare(b.company) || a.title.localeCompare(b.title)) };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (['POST', 'PUT'].includes(req.method)) {
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return json(res, 403, { error: 'Cross-origin changes are not allowed.' });
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { error: 'Send application/json.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/profile') return json(res, 200, { profile: readProfile() });
    if (req.method === 'PUT' && url.pathname === '/api/profile') {
      try { return json(res, 200, { profile: saveProfile(await requestJson(req)) }); }
      catch (error) { return json(res, 400, { error: error.message }); }
    }
    if (req.method === 'GET' && ['/', '/index.html', '/saved.html'].includes(url.pathname) && !readProfile()?.completed) {
      res.writeHead(302, { Location: '/onboarding.html', 'Cache-Control': 'no-store' });
      return res.end();
    }
    if (req.method === 'GET' && url.pathname === '/api/saved') {
      const folder = path.join(WIKI, 'jobs');
      const companyDetails = new Map();
      const companiesFolder = path.join(WIKI, 'companies');
      for (const name of fs.readdirSync(companiesFolder).filter(name => name.endsWith('.md'))) {
        const company = fs.readFileSync(path.join(companiesFolder, name), 'utf8');
        const website = company.match(/^website: "(https:\/\/[^"\r\n]+)"\s*$/m)?.[1];
        let safeWebsite = '';
        try { if (website && new URL(website).protocol === 'https:') safeWebsite = website; } catch { /* Omit invalid URLs. */ }
        const description = company.match(/^## About\s*\r?\n\s*\r?\n([^\r\n]+)/m)?.[1] || '';
        for (const link of company.matchAll(/\]\(\.\.\/jobs\/([^/)]+\.md)\)/g)) companyDetails.set(link[1], { companyWebsite: safeWebsite, companyDescription: description });
      }
      const jobs = fs.readdirSync(folder).filter(name => name.endsWith('.md')).map(name => {
        const markdown = fs.readFileSync(path.join(folder, name), 'utf8').replace(/^\uFEFF/, '');
        const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
        if (!match) return null;
        const fields = {};
        for (const line of match[1].split(/\r?\n/)) {
          const field = line.match(/^([a-z_]+):\s*(.*?)\s*$/);
          if (field) fields[field[1]] = field[2].replace(/^"|"$/g, '');
        }
        return { ...fields, companyWebsite: '', companyDescription: '', ...companyDetails.get(name), fit_score: Number(fields.fit_score || 0), body: markdown.slice(match[0].length), file: name };
      }).filter(Boolean).sort((a, b) => b.fit_score - a.fit_score || a.company.localeCompare(b.company));
      return json(res, 200, { jobs });
    }
    if (req.method === 'GET' && url.pathname === '/api/sources') return json(res, 200, configRead());
    if (req.method === 'PUT' && url.pathname === '/api/sources') {
      const items=await requestJson(req);
      if (!Array.isArray(items) || items.some(x=>!x.company || !x.board || !['greenhouse','lever','ashby'].includes(String(x.ats).toLowerCase()))) return json(res,400,{error:'Each board needs company, board, and ats: greenhouse, lever, or ashby.'});
      configWrite(items); return json(res,200,{ok:true});
    }
    if (req.method === 'POST' && url.pathname === '/api/scan') {
      const profile = readProfile();
      if (!profile?.completed) return json(res, 409, { error: 'Complete your search preferences first.' });
      const result = await scan(configRead(), profile);
      const output = path.join(WIKI, 'searches', `scan-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      fs.writeFileSync(output, JSON.stringify(result, null, 2));
      return json(res, 200, result);
    }
    if (req.method === 'GET' && url.pathname === '/api/health') return json(res,200,{ok:true});
    if (req.method === 'GET') {
      const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
      const target = path.resolve(__dirname, 'public', relative);
      if (!target.startsWith(path.resolve(__dirname,'public') + path.sep)) return json(res,403,{error:'Forbidden'});
      fs.readFile(target,(err,data)=>{ if(err){res.writeHead(404);res.end('Not found');return;} res.writeHead(200,{'Content-Type':MIME[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store'});res.end(data); }); return;
    }
    json(res,404,{error:'Not found'});
  } catch (e) { json(res,500,{error:e.message || String(e)}); }
});
if (require.main === module) server.listen(PORT, '127.0.0.1', () => console.log(`Job Search Brain running at http://127.0.0.1:${server.address().port}`));
module.exports = { server, scan, isExplicitlyUS };
