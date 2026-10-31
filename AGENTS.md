# Job Search Brain - agent instructions

This repository contains shareable code and generic templates. All user records belong in `.local/` or the directory set by `JOB_SEARCH_DATA_DIR`. Never commit profiles, resumes, applications, saved roles, company research, search logs, watchlists or exports.

## Context and searching

1. Read private `SEARCH_PREFERENCES.md`, `profile.json`, `wiki/index.md`, `wiki/background.md` when present, and recent logs before searching. Use the resume designated by the user in the private directory. Preserve submitted artifacts. Do not assume skills, interests, salary, location or work authorization. If there is no profile, direct the user to the site's questionnaire.
2. Read both structured preferences and private `SEARCH_NOTES.md` when present for detailed additional constraints. Preserve explicit additional constraints; never replace them with inferred defaults. Interests are positive signals unless explicitly required.
3. Search multiple targeted queries. Prefer employer career and ATS pages; aggregators are discovery only. Verify an active original application route, otherwise mark unverified. Apply exclusions. Never infer eligibility from a bare remote label, employer address or citizenship assumptions.
4. Compare requirements with resume evidence. Include clear strengths, gaps and unknowns, a 0-100 heuristic score, salary, location, employment type, travel and on-call details. Scores are not hiring predictions. Keep base salary separate from equity and bonuses.
5. Deduplicate canonical URLs and requisition IDs. Update existing role pages for reposts, preserving history. Keep closed/rejected roles and submitted artifacts.
6. Use `templates/`. Write concise role pages under private `wiki/jobs/`, company pages under private `wiki/companies/`, and maintain the private index. Company pages may have verified website metadata and a sourced `## About` paragraph.
7. Record searches in new append-only private `wiki/searches/YYYY-MM-DD-NNN.md` files. Use ISO dates and the user's timezone. Show the top 10 newly found that day; do not pad with excluded/closed roles. Separate existing-role refreshes.
8. Search and archive only. Do not apply, contact others or submit personal information without explicit authorization.

## Development and sharing

Run `npm test` for storage, matching and onboarding changes. Keep examples generic; never embed a user's preferences or resume signals in code.

`npm run migrate` moves legacy personal records into `.local/` without overwriting existing destinations. `npm run share` creates an allowlisted source-only repository at `share/job-search-brain` without private data or the original Git history. Ignoring or untracking files does not remove historical copies. Leave existing history alone unless the user explicitly requests rewriting it; use the clean export for sharing.
