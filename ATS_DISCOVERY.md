# ATS discovery

The dashboard polls public Greenhouse, Lever and Ashby boards from your private watchlist. These services expose individual employer boards, not a universal job search. Agents can search other sources manually.

Start with `npm start`, complete the questionnaire, then use **Edit** in the board watchlist. Each entry needs an employer name, ATS type and board identifier:

```json
[{"company":"Example employer","ats":"greenhouse","board":"employer-board-id"}]
```

Use `lever` or `ashby` for other supported ATS types. Lever supports `region: "eu"`. Use a board ID, not a full URL. The watchlist is stored as `ats_sources.json` inside `.local/` or `JOB_SEARCH_DATA_DIR`, never in tracked app configuration.

## Matching and limits

Both site and CLI read local `profile.json`. Role titles, skills, interests, salary target and preferred locations affect ranking. Country, work model, exclusions and contract choices affect filtering. Unknown hiring eligibility is excluded unless enabled. Missing work-model metadata requires manual review. Country matching does not establish residence, authorization, sponsorship or state payroll eligibility. Keyword matching can miss synonyms or create false positives.

Targets are annual USD; other currencies are not converted. Equity and bonuses are separate from salary. Lower/undisclosed pay is flagged rather than discarded. Discovery scores are hints, not curated assessments or hiring predictions. Saved assessments retain their original scores when preferences change.

Unlisted Ashby postings are omitted. Fetch failures are reported per board, with a 25-second timeout. Other boards continue. No applications or personal information are submitted.

## CLI

```powershell
npm run scan
npm run scan -- --min-score 50
```

Output is timestamped JSON under private `wiki/searches/`. Optional `--config FILE` selects another watchlist; `--out FILE.json` sets the output. Keep alternate files private. The legacy Python entry point delegates to this same Node scanner; it no longer uses separate scoring or writes CSV. The web dashboard also saves scans privately.

Verify original postings before creating curated saved-role pages with `templates/` and the workflow in AGENTS.md.
