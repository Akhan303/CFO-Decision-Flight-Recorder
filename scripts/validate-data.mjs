import { readFileSync } from "node:fs";

const load = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), "utf8"));
const semanticContract = JSON.parse(readFileSync(new URL("../release/foundry-public-semantic-contract.json", import.meta.url), "utf8"));
const aipContract = JSON.parse(readFileSync(new URL("../release/aip-provenance-contract.json", import.meta.url), "utf8"));
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const readmeSource = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const decisions = load("decisions");
const events = load("events");
const context = load("context");
const scenarios = load("scenarios");
const economics = load("economics");
const actuals = load("actuals");
const financePolicy = load("finance-policy");
const errors = [];
const warnings = [];

const sameValues = (actual, expected) =>
  actual.length === expected.length && actual.every((value, index) => value === expected[index]);

if (semanticContract.contractVersion !== "FDR-PUBLIC-v1") errors.push("Unexpected public semantic contract version");
if (semanticContract.projection.runtimeConnectionToFoundry !== false) errors.push("Public projection contract must prohibit runtime Foundry connectivity");
if (semanticContract.financeModelVersion !== financePolicy.modelVersion) errors.push("Semantic contract finance model does not match finance policy");

if (aipContract.contractVersion !== "AIP-PROVENANCE-v1") errors.push("Unexpected AIP provenance contract version");
if (aipContract.currentState.financeModelVersion !== financePolicy.modelVersion) errors.push("AIP provenance contract finance model does not match finance policy");
if (aipContract.currentState.llmBacked !== false || aipContract.currentState.generationMode !== "deterministic_scoring") {
  errors.push("AIP provenance contract must remain deterministic until a model-backed run and evaluation evidence exist");
}
if (aipContract.upgradeGate.minimumEvaluationCases < 12) errors.push("AIP upgrade gate must retain at least 12 evaluation cases");
if (aipContract.requiredPersistedProvenance.length < 15) errors.push("AIP persisted provenance contract is incomplete");

const claimSurface = `${appSource}\n${readmeSource}\n${JSON.stringify(decisions)}\n${JSON.stringify(events)}`;
for (const prohibitedClaim of ["AI Recommendation", "AI recommendation", "AI analysis", "AI-driven"]) {
  if (claimSurface.includes(prohibitedClaim)) errors.push(`Unproven AI claim remains in public source: ${prohibitedClaim}`);
}

if (financePolicy.modelVersion !== "FIN-SCENARIO-v1") errors.push("Unexpected finance model version");
if (!financePolicy.owner || !financePolicy.ebitdaFormula || !financePolicy.npvProxyFormula) errors.push("Finance calculation policy is incomplete");
if (!/^\d{4}-\d{2}-\d{2}$/.test(financePolicy.lastValidated)) errors.push("Finance policy validation date is invalid");

const by = (rows, key) => rows.reduce((map, row) => {
  const value = row[key];
  map.set(value, [...(map.get(value) ?? []), row]);
  return map;
}, new Map());

const decisionIds = new Set();
for (const decision of decisions) {
  if (decisionIds.has(decision.decisionId)) errors.push(`Duplicate decisionId ${decision.decisionId}`);
  decisionIds.add(decision.decisionId);
  if (!Number.isFinite(decision.expectedEbitdaUsd) || !Number.isFinite(decision.downsideEbitdaUsd)) {
    errors.push(`${decision.decisionId}: non-numeric financial impact`);
  }
  if (!decision.outcomeDate) errors.push(`${decision.decisionId}: missing measurement date`);
  const statusRealized = decision.outcomeStatus === "Realized";
  if (statusRealized !== decision.isReleasedByClock) {
    errors.push(`${decision.decisionId}: outcome status conflicts with release flag`);
  }
}

const orderedDecisionIds = decisions.map((decision) => decision.decisionId);
if (!sameValues(orderedDecisionIds, semanticContract.projection.decisionIds)) {
  errors.push("Public decision IDs or ordering drifted from the approved Foundry projection contract");
}

const contractCounts = semanticContract.expectedCounts;
const actualCounts = {
  decisions: decisions.length,
  events: events.length,
  context: context.length,
  scenarios: scenarios.length,
  actuals: actuals.length,
};
for (const [name, expected] of Object.entries(contractCounts)) {
  if (actualCounts[name] !== expected) errors.push(`${name} count ${actualCounts[name]} does not match semantic contract ${expected}`);
}

const realizedIds = decisions.filter((decision) => decision.outcomeStatus === "Realized").map((decision) => decision.decisionId);
const projectedIds = decisions.filter((decision) => decision.outcomeStatus === "Projected").map((decision) => decision.decisionId);
if (!sameValues(realizedIds, semanticContract.outcomeClassification.realized)) errors.push("Realized outcome set drifted from semantic contract");
if (!sameValues(projectedIds, semanticContract.outcomeClassification.projected)) errors.push("Projected outcome set drifted from semantic contract");

const expectedEbitda = decisions.reduce((sum, decision) => sum + decision.expectedEbitdaUsd, 0);
const downsideEbitda = decisions.reduce((sum, decision) => sum + decision.downsideEbitdaUsd, 0);
if (expectedEbitda !== semanticContract.expectedPortfolioTotalsUsd.expectedEbitda) errors.push("Expected EBITDA total drifted from semantic contract");
if (downsideEbitda !== semanticContract.expectedPortfolioTotalsUsd.downsideEbitda) errors.push("Downside EBITDA total drifted from semantic contract");

const eventsByDecision = by(events, "decisionId");
const contextByDecision = by(context, "decisionId");
const scenariosByDecision = by(scenarios, "decisionId");
const economicsByDecision = by(economics, "decisionId");
const actualsByDecision = by(actuals, "decisionId");
[...events, ...context, ...scenarios, ...economics, ...actuals].forEach((row) => {
  if (!decisionIds.has(row.decisionId)) errors.push(`Orphan record for unknown decision ${row.decisionId}`);
});
let authorityGapCount = 0;
let missingDispositionCount = 0;
for (const decision of decisions) {
  const decisionEvents = eventsByDecision.get(decision.decisionId) ?? [];
  const seqs = new Set(decisionEvents.map((event) => event.seq));
  if (seqs.size !== decisionEvents.length) errors.push(`${decision.decisionId}: duplicate event sequence`);
  if (decision.eventCount !== decisionEvents.length) errors.push(`${decision.decisionId}: eventCount mismatch`);
  if (decision.contextMetricCount !== (contextByDecision.get(decision.decisionId) ?? []).length) {
    errors.push(`${decision.decisionId}: contextMetricCount mismatch`);
  }
  const scenarioNames = new Set((scenariosByDecision.get(decision.decisionId) ?? []).map((row) => row.scenarioName));
  if (scenarioNames.size !== 3) errors.push(`${decision.decisionId}: expected exactly three named scenarios`);
  const decisionScenarios = scenariosByDecision.get(decision.decisionId) ?? [];
  const probabilityTotal = decisionScenarios.reduce((sum, row) => sum + row.probabilityPct, 0);
  if (probabilityTotal !== 100) errors.push(`${decision.decisionId}: scenario probabilities total ${probabilityTotal}%, expected 100%`);
  for (const scenario of decisionScenarios) {
    if (!Number.isFinite(scenario.probabilityPct) || scenario.probabilityPct <= 0) errors.push(`${decision.decisionId}: invalid scenario probability`);
    if (!Number.isFinite(scenario.impactMultiplier) || scenario.impactMultiplier <= 0) errors.push(`${decision.decisionId}: invalid impact multiplier`);
    if (!Number.isFinite(scenario.scenarioScore) || scenario.scenarioScore < 0 || scenario.scenarioScore > 1) errors.push(`${decision.decisionId}: scenario score outside 0-1`);
    if (!scenario.assumptionDelta) errors.push(`${decision.decisionId}: missing scenario assumption delta`);
  }
  const baseScenario = decisionScenarios.find((row) => row.scenarioName === "Base Case");
  if (!baseScenario || baseScenario.impactBasis !== "Expected" || baseScenario.impactMultiplier !== 1) {
    errors.push(`${decision.decisionId}: base case must use expected impact at 1.0x`);
  }
  const downsideScenario = decisionScenarios.find((row) => row.scenarioName === "Downside Stress Test");
  if (!downsideScenario || downsideScenario.impactBasis !== "Downside") {
    errors.push(`${decision.decisionId}: downside case must use downside impact basis`);
  }

  const assumptions = economicsByDecision.get(decision.decisionId) ?? [];
  if (assumptions.length !== 1) errors.push(`${decision.decisionId}: expected exactly one economics assumption record`);
  const assumption = assumptions[0];
  if (assumption) {
    if (assumption.currency !== "USD") errors.push(`${decision.decisionId}: unsupported scenario currency ${assumption.currency}`);
    if (!Number.isFinite(assumption.horizonMonths) || assumption.horizonMonths <= 0) errors.push(`${decision.decisionId}: invalid benefit horizon`);
    if (!Number.isFinite(assumption.upfrontInvestmentUsd) || assumption.upfrontInvestmentUsd < 0) errors.push(`${decision.decisionId}: invalid upfront investment`);
    if (assumption.cashConversionPct < 0 || assumption.cashConversionPct > 100) errors.push(`${decision.decisionId}: cash conversion outside 0-100%`);
    if (assumption.discountRatePct < 0) errors.push(`${decision.decisionId}: negative discount rate`);
    if (assumption.overlapReservePct < 0 || assumption.overlapReservePct > 100) errors.push(`${decision.decisionId}: overlap reserve outside 0-100%`);
    if (assumption.asOfDate > decision.decisionDate) errors.push(`${decision.decisionId}: economics assumptions use future information`);
    if (assumption.assumptionStatus !== "Illustrative") errors.push(`${decision.decisionId}: synthetic economics must be labeled Illustrative`);
  }

  const decisionActuals = actualsByDecision.get(decision.decisionId) ?? [];
  if (decision.isReleasedByClock && decisionActuals.length !== 1) errors.push(`${decision.decisionId}: realized decision must have exactly one observed actual`);
  if (!decision.isReleasedByClock && decisionActuals.length) errors.push(`${decision.decisionId}: unreleased decision cannot expose an observed actual`);
  const actual = decisionActuals[0];
  if (actual) {
    if (actual.currency !== "USD" || actual.evidenceStatus !== "Observed") errors.push(`${decision.decisionId}: actual must be observed and denominated in USD`);
    if (actual.sourceSystem !== "CFO Performance Monthly") errors.push(`${decision.decisionId}: unexpected actual source system`);
    if (actual.measurementStartDate <= decision.decisionDate) errors.push(`${decision.decisionId}: actual measurement starts before the decision`);
    if (actual.measurementEndDate !== decision.outcomeDate || actual.recordedAt < actual.measurementEndDate) errors.push(`${decision.decisionId}: actual measurement dates do not reconcile`);
    const independentlyCalculatedVariance = actual.actualEbitdaUsd - decision.expectedEbitdaUsd;
    const referenceVariance = decision.outcomeVarianceMRef * 1_000_000;
    if (Math.abs(independentlyCalculatedVariance - referenceVariance) > 1) errors.push(`${decision.decisionId}: observed actual does not reconcile to reference variance`);
  }

  const requiredCfo = decision.escalationTier.includes("CFO");
  const approval = [...decisionEvents].reverse().find((event) => event.eventLabel === "Approve Decision");
  if (requiredCfo && approval && !approval.actorRole.includes("CFO")) authorityGapCount += 1;
  const hasDisposition = decisionEvents.some((event) =>
    /Accept Recommendation Disposition|Modify Recommendation|Override Recommendation|Defer Recommendation/.test(event.eventLabel),
  );
  if (!hasDisposition) missingDispositionCount += 1;
}
if (authorityGapCount) warnings.push(`${authorityGapCount} decisions have an approval-authority gap`);
if (missingDispositionCount) warnings.push(`${missingDispositionCount} decisions do not record recommendation disposition`);

const financialMetrics = new Set([
  "Cash Conversion Cycle (days)", "Days Sales Outstanding", "EBITDA Margin %",
  "EBITDA (USD M)", "Net Sales (USD M)", "Data Freshness Flag",
]);
const groups = new Map();
for (const row of context) {
  const owner = financialMetrics.has(row.metricName) ? "CFO Performance Monthly" : "External Market Signals";
  if (row.sourceSystem !== owner) continue;
  const key = `${row.decisionId}|${row.metricName}|${row.dataAsOfDate}|${row.sourceSystem}`;
  groups.set(key, [...(groups.get(key) ?? []), row.metricValue]);
}
const conflicts = [...groups.values()].filter((values) => new Set(values).size > 1);
if (conflicts.length) warnings.push(`${conflicts.length} conflicting context facts are quarantined by the UI`);

if (errors.length) {
  console.error(`Data validation failed (${errors.length})\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`Data validation passed: ${decisions.length} decisions, ${events.length} events, ${context.length} context rows, ${scenarios.length} scenarios, ${economics.length} economics contracts, ${actuals.length} observed actuals.`);
for (const warning of warnings) console.warn(`Warning: ${warning}`);
