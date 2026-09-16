# CLAUDE.md, cloelia-site

This is the public site of CLOELIA.AI: a reference that measures how people's practical freedoms
changed, one freedom and one place at a time (what happened, what followed, for whom, what can be
measured, how strong the evidence is, what remains unknown). Descriptor: Freedom Analytics. The
product definition, the standard, the roadmap, and the phase state live in the owner's Obsidian
vault under the CLOELIA project (the vault path is deliberately not written here; ask the owner if
you need it). Read the vault's Phase Index before starting a phase.

## Rules that never change

1. **No hand-typed numbers.** Every measure, chart, dataset, and finding on the site comes from the
   lab's `publish/` artifacts through `scripts/bridge.mjs`; `src/content/bridge/` and `public/charts/`
   are generated and committed, never edited by hand. `bridge.lock.json` records the lab commit.
2. **The Neutrality and Evidence Standard is enforced by code.** Schemas (`src/content.config.ts`),
   `scripts/validate.mjs`, and the bridge fail the build on a finding without a grade, a development
   without a source or a population, a measure without a definition or a population, a dangling
   reference, an estimate in a gap, an image without alt text, or an em dash.
3. **The Record's order is fixed:** scan block, What changed, What happened, What followed, What can
   be concluded, What is still unknown, Verify, Related. The scan block states freedom, place,
   period, population, the major measured change with its grade, and the remaining question.
4. **Static and readable without JavaScript.** No accounts, no request-time data, no inline scripts
   or styles (the CSP is strict), no tracking. Every chart has alt text and a data table.
5. **Never advocate, never score actors, never combine freedoms into one number, never tell the
   reader what to conclude.** Historical entities in the source's own terms; neutral verbs.
6. **No em dashes anywhere; no machine paths; no secrets.** The guard scans every commit.
7. **Do not touch the film repository (`cloelia-ai`), the lab's notebooks, the Khaylub.com
   repositories, or the owner's school coursework.** The lab is read by the bridge only.
8. **Phases and gates.** One open phase at a time; owner gates as the vault's Roadmap states; no
   production or DNS action outside Phase 6 and later gated phases.

## Verification list (run before any pull request)

`node .claude/hooks/verify-guard.mjs full` runs: check, validate, build:preview, validate (built
output), test:unit, test (Playwright), lhci, audit. The guard blocks commits with banned content and
pull requests without a stamp for HEAD on a clean tree.

## Layout

`src/content/<collection>/*.yaml` editorial content (dimensions, places, populations, sources,
developments, questions, corrections, records) · `src/content/bridge/` generated from the lab ·
`src/pages/` one file per template · `src/components/` the Record's parts · `src/styles/tokens.css`
the design tokens (pairing A: Newsreader, Public Sans) · `scripts/` bridge, validate, headers server ·
`tests/e2e/` Playwright · `tests/unit/` the bridge · `tests/fixtures/lab/` vendored lab fixtures for CI ·
`render.yaml` the staging service (production is added at Phase 6).
