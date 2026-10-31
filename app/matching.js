const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const contains = (text, term) => new RegExp(`(^|[^a-z0-9])${escape(term)}(?=$|[^a-z0-9])`, 'i').test(text);
const countries = { CA: ['canada', 'canadian'], GB: ['united kingdom', 'uk', 'great britain'], AU: ['australia', 'australian'], DE: ['germany', 'deutschland'], FR: ['france'] };
function locationMatches(job, profile, isUS) {
  if (profile.countries.includes('ANY')) return true;
  if (profile.countries.includes('US') && isUS(job)) return true;
  const evidence = `${job.country || ''} ${job.location || ''} ${job.usEvidence || ''}`;
  for (const code of profile.countries) {
    if (String(job.country || '').toUpperCase() === code || (countries[code] || []).some(name => contains(evidence, name))) return true;
  }
  // An unknown location is different from a known, non-matching country.
  return profile.allowUnknownLocation && /^(remote|hybrid|anywhere|global|worldwide|)?$/i.test(String(job.location || '').trim()) && !job.country;
}
function exclusion(job, profile, isUS) {
  if (!locationMatches(job, profile, isUS)) return 'location';
  const blob = `${job.title} ${job.description || ''}`;
  if (profile.exclusions.some(term => contains(blob, term))) return 'preference';
  if (!profile.includeContract && /contract|temporary|freelance/i.test(job.employmentType || '')) return 'preference';
  const work = `${job.workplaceType || ''} ${job.location || ''}`;
  const model = /hybrid/i.test(work) ? 'hybrid' : /remote/i.test(work) ? 'remote' : /on.?site/i.test(work) ? 'onsite' : null;
  if (model && !profile.workModels.includes(model)) return 'preference';
  return null;
}
function evaluate(job, profile) {
  const blob = `${job.title} ${job.description || ''}`;
  const target = profile.roleTitles.some(term => contains(job.title, term));
  const skills = profile.skills.filter(term => contains(blob, term));
  const interests = profile.interests.filter(term => contains(blob, term));
  let score = target ? 55 : 20;
  score += Math.min(25, skills.length * 5) + Math.min(8, interests.length * 2);
  const why = [];
  if (target) why.push('target role title');
  if (skills.length) why.push(`profile skill overlap: ${skills.slice(0, 5).join(', ')}`);
  if (interests.length) why.push(`interests: ${interests.slice(0, 3).join(', ')}`);
  if (profile.preferredLocations.some(term => contains(job.location || '', term))) { score += 5; why.push('preferred location'); }
  if (/remote|hybrid/i.test(`${job.workplaceType || ''} ${job.location || ''}`)) score += 5;
  const salary = String(job.salary || '');
  const amounts = /CAD|AUD|GBP|EUR|€|£/i.test(salary) ? [] : [...salary.matchAll(/\$\s*([\d,]+(?:\.\d+)?)\s*(k)?/gi)].map(m => Number(m[1].replace(/,/g, '')) * (m[2] ? 1000 : 1));
  if (profile.minSalary && amounts.length) {
    if (Math.min(...amounts) >= profile.minSalary) { score += 10; why.push('listed range starts at salary target'); }
    else why.push('range includes below-target pay');
  } else if (profile.minSalary) why.push('salary target alignment unverified');
  score = Math.min(score, 100);
  return { score, review: score >= 70 ? 'strong match' : score >= 50 ? 'review' : 'lower match', matched: why.join('; ') };
}
module.exports = { evaluate, exclusion, locationMatches };
