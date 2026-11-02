const query = document.querySelector('#query');
const date = document.querySelector('#date');
const allDates = document.querySelector('#all-dates');
const dateSummary = document.querySelector('#date-summary');
const selectedDates = new Set();
const status = document.querySelector('#status');
const results = document.querySelector('#results');
let saved = [];
function updateDates() {
  const options = [...date.querySelectorAll('input')];
  allDates.checked = options.length > 0 && selectedDates.size === options.length;
  allDates.indeterminate = selectedDates.size > 0 && !allDates.checked;
  dateSummary.textContent = allDates.checked ? 'All dates' : selectedDates.size === 1
    ? displayDate([...selectedDates][0]) : selectedDates.size ? `${selectedDates.size} dates selected` : 'Choose dates';
  render();
}
date.addEventListener('change', event => {
  if (event.target.type !== 'checkbox') return;
  if (event.target.checked) selectedDates.add(event.target.value);
  else selectedDates.delete(event.target.value);
  updateDates();
});
allDates.addEventListener('change', () => {
  selectedDates.clear();
  for (const option of date.querySelectorAll('input')) {
    option.checked = allDates.checked;
    if (option.checked) selectedDates.add(option.value);
  }
  updateDates();
});
const dateFilter = document.querySelector('.date-filter');
document.addEventListener('click', event => {
  if (!dateFilter.contains(event.target)) dateFilter.open = false;
});
dateFilter.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    dateFilter.open = false;
    dateSummary.focus();
  }
});
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
// Render the Markdown used in saved assessments without interpreting HTML.
function inlineText(parent, text) {
  const pattern = /\[([^\]]+)\]\(([^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    parent.append(document.createTextNode(text.slice(cursor, match.index)));
    if (match[1] !== undefined) {
      if (/^https?:\/\//i.test(match[2])) {
        const link = element('a', match[1]);
        link.href = match[2];
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        parent.append(link);
      } else parent.append(document.createTextNode(match[1]));
    } else parent.append(element(match[3] !== undefined ? 'strong' : 'code', match[3] ?? match[4]));
    cursor = match.index + match[0].length;
  }
  parent.append(document.createTextNode(text.slice(cursor)));
}
function assessmentText(markdown, className = 'role-body') {
  const body = element('div', undefined, className);
  let paragraph = [];
  let list = null;
  function flush() {
    if (paragraph.length) {
      const p = element('p');
      inlineText(p, paragraph.join(' '));
      body.append(p);
      paragraph = [];
    }
  }
  for (const line of String(markdown || '').split(/\r?\n/)) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const item = line.match(/^\s*(?:[-*]|(\d+)\.)\s+(.+)$/);
    if (!line.trim()) { flush(); list = null; continue; }
    if (heading) {
      flush(); list = null;
      const h = element(heading[1].length <= 2 ? 'h3' : 'h4');
      inlineText(h, heading[2]); body.append(h);
    } else if (item) {
      flush();
      const tag = item[1] ? 'OL' : 'UL';
      if (!list || list.tagName !== tag) {
        list = element(tag.toLowerCase());
        if (item[1]) list.start = Number(item[1]);
        body.append(list);
      }
      const li = element('li'); inlineText(li, item[2]); list.append(li);
    } else if (line.startsWith('> ')) {
      flush(); list = null;
      const quote = element('blockquote'); inlineText(quote, line.slice(2)); body.append(quote);
    } else { list = null; paragraph.push(line.trim()); }
  }
  flush();
  return body;
}
function displayDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value || 'Unknown';
  return new Date(`${value}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
function render() {
  const search = query.value.trim().toLowerCase();
  const list = saved.filter(job => selectedDates.has(job.first_seen) &&
    (status.value === 'all' || job.status === status.value) &&
    `${job.company} ${job.title} ${job.location} ${job.companyDescription || ''} ${job.body}`.toLowerCase().includes(search));
  document.querySelector('#count').textContent = `${list.length} roles · ranked by fit · expand a role for its full assessment`;
  results.replaceChildren();
  if (!list.length) results.append(element('p', 'No roles match these filters. Try another date, status, or search term.', 'saved-empty'));
  for (const job of list) {
    const card = element('article', undefined, 'panel saved-card');
    const header = element('div', undefined, 'saved-card-header');
    const heading = element('div', undefined, 'saved-card-heading');
    heading.append(element('div', job.company, 'eyebrow'), element('h2', job.title));
    const score = element('div', undefined, 'saved-score');
    score.setAttribute('aria-label', `Fit score: ${job.fit_score} out of 100`);
    score.append(element('strong', job.fit_score), element('span', 'FIT / 100'));
    header.append(heading, score); card.append(header);
    const meta = element('div', undefined, 'saved-meta');
    meta.append(element('span', job.location), element('span', job.employment_type));
    card.append(meta, element('p', job.salary, 'saved-salary'));
    const dates = element('div', undefined, 'saved-dates');
    dates.append(element('span', job.status, 'role-status'), element('span', `Found ${displayDate(job.first_seen)}`), element('span', `Checked ${displayDate(job.last_verified)}`));
    card.append(dates);
    if (job.companyDescription) {
      const about = element('section', undefined, 'company-description');
      const description = element('p'); inlineText(description, job.companyDescription);
      about.append(element('h3', 'About the company'), description);
      card.append(about);
    }
    const why = job.body.match(/## Why it may be interesting\s+([\s\S]*?)(?=\n## |$)/);
    if (why) card.append(assessmentText(why[1].trim(), 'role-intro'));
    const details = element('details', undefined, 'assessment');
    details.append(element('summary', 'Read assessment, requirements and concerns'));
    details.append(assessmentText(job.body));
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
for (const control of [query, status]) control.addEventListener('input', render);
fetch('/api/saved').then(async response => {
  if (!response.ok) throw new Error('Could not load saved roles');
  saved = (await response.json()).jobs;
  const dates = [...new Set(saved.map(job => job.first_seen))].sort().reverse();
  for (const value of dates) {
    const label = element('label');
    const option = element('input');
    option.type = 'checkbox';
    option.value = value;
    option.checked = value === dates[0];
    if (option.checked) selectedDates.add(value);
    label.append(option, element('span', displayDate(value)));
    date.append(label);
  }
  updateDates();
}).catch(error => { document.querySelector('#count').textContent = error.message; });
