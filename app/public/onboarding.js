const form = document.querySelector('#preferences');
const error = document.querySelector('#error');
const fields = ['roleTitles', 'skills', 'interests', 'preferredLocations', 'exclusions'];
const groups = ['countries', 'workModels'];
fetch('/api/profile').then(async response => {
  if (!response.ok) throw Error('Could not load your preferences. Refresh to try again.');
  const { profile } = await response.json();
  form.elements.timezone.value = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (profile) {
    for (const field of fields) form.elements[field].value = (profile[field] || []).join('\n');
    for (const group of groups) for (const input of form.querySelectorAll(`[name="${group}"]`)) input.checked = profile[group].includes(input.value);
    form.elements.minSalary.value = profile.minSalary || '';
    form.elements.includeContract.checked = profile.includeContract;
    form.elements.allowUnknownLocation.checked = profile.allowUnknownLocation;
    document.querySelector('#cancel').classList.remove('hidden');
  }
  document.querySelector('#loading').classList.add('hidden');
  form.classList.remove('hidden');
}).catch(failure => { document.querySelector('#loading').textContent = failure.message; });
form.addEventListener('submit', async event => {
  event.preventDefault();
  error.classList.add('hidden');
  const profile = {};
  for (const field of fields) profile[field] = form.elements[field].value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  for (const group of groups) profile[group] = [...form.querySelectorAll(`[name="${group}"]:checked`)].map(input => input.value);
  profile.minSalary = Number(form.elements.minSalary.value || 0);
  profile.includeContract = form.elements.includeContract.checked;
  profile.allowUnknownLocation = form.elements.allowUnknownLocation.checked;
  profile.timezone = form.elements.timezone.value.trim();
  if (!profile.countries.length || !profile.workModels.length) {
    error.textContent = 'Select at least one country option and work model.';
    error.classList.remove('hidden');
    return;
  }
  const save = document.querySelector('#save');
  save.disabled = true;
  try {
    const response = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Could not save preferences.');
    location.assign('/');
  } catch (failure) {
    error.textContent = failure.message;
    error.classList.remove('hidden');
  } finally { save.disabled = false; }
});
