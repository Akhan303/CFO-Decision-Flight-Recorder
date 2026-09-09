import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  attainment,
  financialBreakEven,
  formatUsdMillions,
  measurementState,
  outcomeAssessment,
  scenarioEconomics,
  summarizeDecisionEconomics,
} from "../src/domain.ts";

const load = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), "utf8"));
const decisions = load("decisions");
const scenarios = load("scenarios");
const economics = load("economics");
const actuals = load("actuals");
const decision = (id) => decisions.find((row) => row.decisionId === id);
const assumption = (id) => economics.find((row) => row.decisionId === id);
const scenarioRows = (id) => scenarios.filter((row) => row.decisionId === id);
const closeTo = (actual, expected, tolerance = 1) => assert.ok(
  Math.abs(actual - expected) <= tolerance,
  `expected ${actual} to be within ${tolerance} of ${expected}`,
);

test("every decision scenario set is complete and probability-balanced", () => {
  for (const item of decisions) {
    const rows = scenarioRows(item.decisionId);
    assert.deepEqual(rows.map((row) => row.scenarioName).sort(), ["Base Case", "Downside Stress Test", "Upside Stress Test"]);
    assert.equal(rows.reduce((sum, row) => sum + row.probabilityPct, 0), 100);
  }
});

test("Austin scenario economics reconcile to the disclosed formula", () => {
  const item = decision("D-2026-035");
  const contract = assumption(item.decisionId);
  const rows = scenarioRows(item.decisionId);
  const summary = summarizeDecisionEconomics(item, rows, contract);
  const independentlyWeightedEbitda = item.expectedEbitdaUsd * 0.55
    + item.expectedEbitdaUsd * 1.25 * 0.25
    + item.downsideEbitdaUsd * 0.20;
  const independentlyWeightedNpv = independentlyWeightedEbitda
    * 0.70 / Math.pow(1.11, 1)
    - 8_400_000;

  closeTo(summary.probabilityWeightedEbitdaUsd, independentlyWeightedEbitda);
  closeTo(summary.probabilityWeightedNpvUsd, independentlyWeightedNpv);
  closeTo(summary.overlapReservedEbitdaUsd, independentlyWeightedEbitda * 0.80);
});

test("scenario net cash subtracts the investment exactly once after weighting", () => {
  const item = decision("D-2026-032");
  const contract = assumption(item.decisionId);
  const calculated = scenarioRows(item.decisionId).map((row) => scenarioEconomics(item, row, contract));
  const weighted = calculated.reduce((sum, row) => sum + row.discountedNetCashUsd * row.scenario.probabilityPct / 100, 0);
  const weightedEbitda = calculated.reduce((sum, row) => sum + row.ebitdaImpactUsd * row.scenario.probabilityPct / 100, 0);
  const expected = weightedEbitda * 0.55 / Math.pow(1.10, 9 / 24) - 5_500_000;
  closeTo(weighted, expected);
});

test("break-even diagnostic returns zero NPV at the required EBITDA", () => {
  const item = decision("D-2026-035");
  const contract = assumption(item.decisionId);
  const result = financialBreakEven(item, contract);
  const discountedCash = result.breakEvenEbitdaUsd * 0.70 / Math.pow(1.11, 1);

  closeTo(discountedCash - contract.upfrontInvestmentUsd, 0);
  assert.equal(result.status, "Below break-even");
  assert.ok(result.requiredCashConversionPct > 100);
});

test("observed actuals determine realized variance and attainment", () => {
  const item = decision("D-2026-031");
  const result = outcomeAssessment(item, actuals);
  assert.equal(result.basis, "Observed actual");
  assert.equal(result.value, 8_390_000);
  assert.equal(result.variance, -5_300_000);
  assert.equal(attainment(item, actuals), "61%");
});

test("unreleased decisions remain projections without actual attainment", () => {
  const item = decision("D-2026-035");
  const result = outcomeAssessment(item, actuals);
  assert.equal(result.basis, "Projection");
  assert.equal(result.value, 1_920_000);
  assert.equal(attainment(item, actuals), "—");
});

test("outcome learning is gated by observed release state, not the measurement date alone", () => {
  const item = decision("D-2026-035");
  assert.equal(item.outcomeStatus, "Projected");
  assert.equal(item.isReleasedByClock, false);
  assert.equal(measurementState(item), "Overdue");
  assert.equal(outcomeAssessment(item, actuals).basis, "Projection");
});

test("cross-application currency display uses explicit half-away-from-zero rounding", () => {
  assert.equal(formatUsdMillions(4_050_000), "$4.1M");
  assert.equal(formatUsdMillions(-4_050_000), "-$4.1M");
  assert.equal(formatUsdMillions(4_049_999), "$4.0M");
});

test("portfolio values reconcile to the executive display precision", () => {
  const summaries = decisions.map((item) => summarizeDecisionEconomics(item, scenarioRows(item.decisionId), assumption(item.decisionId)));
  const weightedEbitda = summaries.reduce((sum, row) => sum + row.probabilityWeightedEbitdaUsd, 0);
  const overlapReserved = summaries.reduce((sum, row) => sum + row.overlapReservedEbitdaUsd, 0);
  const weightedNpv = summaries.reduce((sum, row) => sum + row.probabilityWeightedNpvUsd, 0);

  closeTo(weightedEbitda, 47_800_000, 50_000);
  closeTo(overlapReserved, 42_300_000, 50_000);
  closeTo(weightedNpv, 11_000_000, 50_000);
});
