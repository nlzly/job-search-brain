const query = document.querySelector('#query');
const date = document.querySelector('#date');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
let saved = [];
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function render() {
  const search = query.value.trim().toLowerCase();
  const list = saved.filter(job => (date.value === 'all' || job.first_seen === date.value) &&
    (status.value === 'all' || job.status === status.value) &&
    `${job.company} ${job.title} ${job.location} ${job.companyDescription || ''} ${job.body}`.toLowerCase().includes(search));
  document.querySelector('#count').textContent = `${list.length} roles · ranked by fit · expand a role for its full assessment`;
  results.replaceChildren();
  for (const job of list) {
    const card = element('article', undefined, 'panel saved-card');
    card.append(element('div', `${job.fit_score}/100`, 'score'), element('div', job.company, 'eyebrow'), element('h2', job.title));
    card.append(element('div', `${job.location} · ${job.employment_type}`, 'meta'));
    card.append(element('div', job.salary, 'meta'));
    card.append(element('p', `${job.status} · Found ${job.first_seen} · Last checked ${job.last_verified}`, 'sub'));
    if (job.companyDescription) {
      const about = element('section', undefined, 'company-description');
      about.append(element('h3', 'About the company'), element('p', job.companyDescription));
      card.append(about);
    }
    const why = job.body.match(/## Why it may be interesting\s+([\s\S]*?)(?=\n## |$)/);
    if (why) card.append(element('p', why[1].trim()));
    const details = element('details');
    details.append(element('summary', 'Read assessment, requirements and concerns'));
    details.append(element('div', job.body, 'role-body'));
    card.append(details);
    const links = element('div', undefined, 'role-links');
    if (/^https:\/\//i.test(job.url)) {
      const original = element('a', 'Open employer posting ↗');
      original.href = job.url;
      original.target = '_blank';
      original.rel = 'noopener noreferrer';
      links.append(original);
    }
    if (/^https:\/\//i.test(job.companyWebsite || '')) {
      const company = element('a', 'Company website ↗');
      company.href = job.companyWebsite;
      company.target = '_blank';
      company.rel = 'noopener noreferrer';
      links.append(company);
    }
    if (links.childElementCount) card.append(links);
    results.append(card);
  }
}
for (const control of [query, date, status]) control.addEventListener('input', render);
fetch('/api/saved').then(async response => {
  if (!response.ok) throw new Error('Could not load saved roles');
  saved = (await response.json()).jobs;
  const dates = [...new Set(saved.map(job => job.first_seen))].sort().reverse();
  for (const value of dates) {
    const option = element('option', value);
    option.value = value;
    date.append(option);
  }
  const all = element('option', 'All dates');
  all.value = 'all';
  date.append(all);
  render();
}).catch(error => { document.querySelector('#count').textContent = error.message; });
