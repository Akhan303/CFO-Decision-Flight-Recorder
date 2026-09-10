# CFO Decision Flight Recorder — Public Showcase

A static, read-only React and TypeScript demonstration of governed executive decision intelligence. The fictional Arcadia Industrial Automation portfolio connects recommendations, accountable human authority, decision-time evidence, lifecycle events, scenarios, economics, and measured outcomes in one auditable experience.

## What the showcase demonstrates

- A CFO command center spanning eight decisions and three business units
- Separation of model-derived recommendations from authorized human decisions
- Approval-authority and recommendation-disposition control checks
- Point-in-time evidence with conflicting facts quarantined from trusted drivers
- Base, upside, and downside cases with explicit probabilities and assumptions
- Probability-weighted EBITDA, cash conversion, investment, discounting, overlap reserves, and break-even diagnostics
- Independent observed actuals for released outcomes; unreleased outcomes remain clearly labeled projections
- Decision replay and a five-frame executive story for each record
- A transparent mirror of the authenticated Foundry app's governed, on-demand AIP evidence brief capability

## Trust model

The experience is intentionally honest about incomplete governance evidence. Authority gaps, missing recommendation dispositions, and conflicting source facts remain visible as control findings; they are not silently repaired or converted into trusted evidence. Stable structural rules fail the build, while known decision-record exceptions are surfaced as warnings and in the UI.

The finance model is identified as `FIN-SCENARIO-v1`. Calculations use unrounded USD and presentation values are rounded to one decimal million. The NPV figure is an explicitly labeled proxy, not a complete valuation model.

The underlying recommendation remains deliberately labeled **model-derived recommendation**. The private Foundry application now exposes a separately governed, on-demand AIP evidence brief over ontology-backed alternatives and evidence. This static public mirror describes that capability but cannot execute it, display generated output, or imply that AI has human approval authority. The remaining claim and evaluation gates are defined in `release/aip-provenance-contract.json`.

## Local commands

```powershell
npm install
npm run dev
npm run build
npm run preview
```

`npm run build` is the release gate. It performs data validation, nine dependency-free finance tests, TypeScript checking, the production bundle, a SHA-256 release manifest, and a compiled-distribution scan.

## Project structure

```text
src/App.tsx                 Executive experience and routes
src/domain.ts              Finance, outcome, evidence, and governance logic
src/data/                   Synthetic display data and finance policy
tests/finance.test.mjs      Independent calculation tests
scripts/validate-data.mjs  Data contract and integrity gate
scripts/validate-dist.mjs  Public-boundary and manifest gate
dist/                       Generated compiled release
release/                    Release-readiness evidence
```

## Public-boundary guarantees

- Synthetic Arcadia Industrial Automation data only
- Static, read-only browser experience
- No backend, authentication, mutation capability, operational data connection, or private runtime dependency
- Production source maps disabled
- Compiled artifacts checked for private platform identifiers and credential markers
- Hashed release manifest generated after every successful production build

## Release procedure

1. Run `npm run build` and require every hard gate to pass.
2. Review the warning set as disclosed governance conditions, not software defects.
3. Inspect `dist/release-manifest.json` and confirm the expected finance model version.
4. Commit the reviewed source changes, push them, and allow the existing Pages workflow to publish the compiled release.
5. Smoke-test the live command center, one decision, every decision tab, story controls, and the invalid-route fallback.

## Scope limitations

This repository is a public demonstration, not a production financial system. It does not provide live source lineage, identity enforcement, writeback, workflow execution, accounting close controls, or a complete investment valuation. Those capabilities belong in the governed operational platform rather than in the public static boundary.
