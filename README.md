# Job Search Brain

A local job-search workspace with a first-run questionnaire, ATS discovery and saved Markdown research. Requires Node.js 20 or newer; no package installation is needed.

```powershell
npm start
```

Open **http://127.0.0.1:4173**. New workspaces open the questionnaire. Choose target roles, skills, interests, hiring countries, work models, salary and exclusions. Edit these later from either dashboard page. Add employer boards to the watchlist, then run a scan.

Interests are bonuses, not requirements. Lower or undisclosed pay remains visible with a flag. Location matching is a discovery heuristic: verify state payroll, work authorization, sponsorship and application availability on the employer's posting.

## Private storage

All user data is kept in Git-ignored `.local/`:

```text
.local/
  profile.json
  SEARCH_PREFERENCES.md
  SEARCH_NOTES.md               # Optional additional agent instructions
  preferences-history/
  ats_sources.json
  wiki/
    index.md
    background.md
    jobs/
    companies/
    searches/
    applications/
  <private resume files>
```

The site reads saved Markdown directly from this directory. New clones contain no profile, resume, searches or watchlist. The app creates empty directories on startup and binds only to `127.0.0.1`. The questionnaire generates `SEARCH_PREFERENCES.md`; keep additional detailed constraints in `SEARCH_NOTES.md` for agent searches. The scanner uses structured questionnaire fields and does not interpret arbitrary Markdown instructions.

For storage outside the repo, set an absolute path:

```powershell
$env:JOB_SEARCH_DATA_DIR = 'C:\Private\job-search-data'
npm start
```

Keep the data directory private and back it up separately. The app does not encrypt files or provide automatic backups. Generic instructions and formats live in [AGENTS.md](AGENTS.md) and `templates/`.

## Existing workspaces

Before starting the updated app in a legacy checkout, run `npm run migrate`. It moves the old wiki, preferences, watchlist, PDFs, study pages and prototype into `.local/`, refusing to overwrite destinations. Submitted materials are preserved unchanged. Existing users can enter preferences in the questionnaire without losing migrated records. Questionnaire edits preserve previous preference text under private `preferences-history/`.

## Share with a friend

```powershell
git clone https://github.com/nlzly/job-search-brain.git
cd job-search-brain
npm start
```

Share the GitHub repository link. Each clone starts with an empty private workspace and opens the preference questionnaire on first run. Everyone's profile, resume, watchlist and searches stay in their own Git-ignored `.local/` folder.

Commit application code and generic templates only; keep personal records out of Git.

## Commands

- `npm start`: dashboard, saved roles and questionnaire.
- `npm test`: storage, onboarding/API and matching checks using temporary workspaces.
- `npm run scan`: CLI discovery using the same profile; writes a private timestamped JSON record.

See [ATS_DISCOVERY.md](ATS_DISCOVERY.md) for scanner details. The app never applies, contacts recruiters or submits personal information.
