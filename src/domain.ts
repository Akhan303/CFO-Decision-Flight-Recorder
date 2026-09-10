import type { ContextMetric, Decision, EconomicsAssumption, GovernanceEvent, OutcomeActual, Scenario } from "./types";

export const SIMULATION_DATE = "2026-08-20";

export type MeasurementState =
  | "Realized"
  | "Overdue"
  | "Scheduled"
  | "Not recorded"
  | "Integrity conflict";

export interface ContextConflict {
  key: string;
  metricName: string;
  dataAsOfDate: string;
  sourceSystem: string;
  values: number[];
  reason: string;
}

export interface ContextAssessment {
  selected: ContextMetric[];
  conflicts: ContextConflict[];
  excludedFutureRows: number;
}

export type ApprovalAuthorityStatus = "Satisfied" | "Authority gap" | "Pending" | "Not recorded";

export interface ApprovalAuthorityAssessment {
  status: ApprovalAuthorityStatus;
  requiredRole: "Approver CFO" | "Approver Manager";
  actualRole?: string;
  approvalDate?: string;
  explanation: string;
}

export type RecommendationDisposition =
  | "Accepted"
  | "Modified"
  | "Overridden"
  | "Deferred"
  | "Not recorded";

export interface ExecutiveAction {
  decisionId: string;
  title: string;
  action: string;
  owner: string;
  sla: string;
  prerequisite: string;
  materialityBasis: string;
  tone: string;
}

export interface ScenarioEconomics {
  scenario: Scenario;
  ebitdaImpactUsd: number;
  discountedNetCashUsd: number;
}

export interface DecisionEconomicsSummary {
  probabilityTotalPct: number;
  probabilityWeightedEbitdaUsd: number;
  probabilityWeightedNpvUsd: number;
  overlapReservedEbitdaUsd: number;
}

export interface FinancialBreakEven {
  breakEvenEbitdaUsd: number;
  baseCaseHeadroomUsd: number;
  requiredCashConversionPct: number;
  status: "Above break-even" | "Below break-even";
}

export function formatUsdMillions(value: number): string {
  const sign = value < 0 ? "-" : "";
  const rounded = Math.floor((Math.abs(value) + 50_000) / 100_000) / 10;
  return `${sign}$${rounded.toFixed(1)}M`;
}

const FINANCIAL_METRICS = new Set([
  "Cash Conversion Cycle (days)",
  "Days Sales Outstanding",
  "EBITDA Margin %",
  "EBITDA (USD M)",
  "Net Sales (USD M)",
  "Data Freshness Flag",
]);

const CONTEXT_PRIORITY: Record<string, string[]> = {
  Pricing: ["EBITDA Margin %", "Net Sales (USD M)", "Copper Index", "Manufacturing PMI", "USD/CAD FX Rate"],
  Inventory: ["Semiconductor Lead Time Index", "Cash Conversion Cycle (days)", "EBITDA Margin %", "Net Sales (USD M)", "Manufacturing PMI"],
  "Working Capital": ["Days Sales Outstanding", "Cash Conversion Cycle (days)", "Net Sales (USD M)", "EBITDA Margin %", "USD/CAD FX Rate"],
  Sourcing: ["Semiconductor Lead Time Index", "Copper Index", "Manufacturing PMI", "USD/CAD FX Rate", "EBITDA Margin %"],
  Capex: ["EBITDA (USD M)", "EBITDA Margin %", "Net Sales (USD M)", "Manufacturing PMI", "Semiconductor Lead Time Index"],
  Credit: ["Days Sales Outstanding", "Cash Conversion Cycle (days)", "Net Sales (USD M)", "EBITDA Margin %", "Manufacturing PMI"],
};

export function measurementState(
  decision: Pick<Decision, "outcomeStatus" | "outcomeDate" | "isReleasedByClock">,
  clock = SIMULATION_DATE,
): MeasurementState {
  const statusSaysRealized = decision.outcomeStatus === "Realized";
  if (statusSaysRealized !== decision.isReleasedByClock) return "Integrity conflict";
  if (statusSaysRealized) return "Realized";
  if (!decision.outcomeDate) return "Not recorded";
  return decision.outcomeDate <= clock ? "Overdue" : "Scheduled";
}

export function attainment(
  decision: Pick<Decision, "decisionId" | "expectedEbitdaUsd" | "isReleasedByClock">,
  actuals: readonly OutcomeActual[],
): string {
  const actual = actuals.find((row) => row.decisionId === decision.decisionId);
  // The recorded recommendation lacks a matched measurement period and benefit
  // definition. Scenario horizons cannot supply that missing historical target.
  if (!decision.isReleasedByClock || !actual) return "—";
  return "—";
}

export function outcomeAssessment(
  decision: Pick<Decision, "decisionId" | "expectedEbitdaUsd" | "outcomeVarianceMRef" | "isReleasedByClock">,
  actuals: readonly OutcomeActual[],
): { value?: number; variance?: number; basis: "Observed actual" | "Projection" | "Missing actual evidence" } {
  if (decision.isReleasedByClock) {
    const actual = actuals.find((row) => row.decisionId === decision.decisionId);
    if (!actual) return { basis: "Missing actual evidence" };
    return {
      value: actual.actualEbitdaUsd,
      basis: "Observed actual",
    };
  }
  return {
    value: decision.expectedEbitdaUsd + decision.outcomeVarianceMRef * 1_000_000,
    variance: decision.outcomeVarianceMRef * 1_000_000,
    basis: "Projection",
  };
}

export function assessApprovalAuthority(
  decision: Pick<Decision, "decisionId" | "escalationTier" | "lifecycleState">,
  rows: readonly GovernanceEvent[],
): ApprovalAuthorityAssessment {
  const requiresCfo = decision.escalationTier.includes("CFO") || decision.escalationTier.includes("Critical");
  const requiredRole = requiresCfo ? "Approver CFO" : "Approver Manager";
  const approval = rows
    .filter((event) => event.decisionId === decision.decisionId && event.eventLabel === "Approve Decision")
    .sort((a, b) => b.seq - a.seq)[0];

  if (!approval) {
    const pending = decision.lifecycleState === "Escalated";
    return {
      status: pending ? "Pending" : "Not recorded",
      requiredRole,
      explanation: pending
        ? `${requiredRole} approval is the next governed gate.`
        : "No decision-approval event is present in the public record.",
    };
  }

  const actualLevel = approval.actorRole.includes("CFO") ? 2 : approval.actorRole.includes("Manager") ? 1 : 0;
  const requiredLevel = requiredRole === "Approver CFO" ? 2 : 1;
  const satisfied = actualLevel >= requiredLevel;
  return {
    status: satisfied ? "Satisfied" : "Authority gap",
    requiredRole,
    actualRole: approval.actorRole,
    approvalDate: approval.date,
    explanation: satisfied
      ? `${approval.actorRole} met or exceeded the required authority.`
      : `${approval.actorRole} approved a decision requiring ${requiredRole}.`,
  };
}

export function recommendationDisposition(
  decisionId: string,
  rows: readonly GovernanceEvent[],
): RecommendationDisposition {
  const disposition = rows
    .filter((event) => event.decisionId === decisionId)
    .sort((a, b) => b.seq - a.seq)
    .find((event) =>
      [
        "Accept Recommendation Disposition",
        "Modify Recommendation",
        "Override Recommendation",
        "Defer Recommendation",
      ].includes(event.eventLabel),
    );

  if (!disposition) return "Not recorded";
  if (disposition.eventLabel.startsWith("Accept")) return "Accepted";
  if (disposition.eventLabel.startsWith("Modify")) return "Modified";
  if (disposition.eventLabel.startsWith("Override")) return "Overridden";
  return "Deferred";
}

export function scenarioEconomics(
  decision: Pick<Decision, "expectedEbitdaUsd" | "downsideEbitdaUsd">,
  scenario: Scenario,
  assumption: EconomicsAssumption,
): ScenarioEconomics {
  const basis = scenario.impactBasis === "Downside"
    ? decision.downsideEbitdaUsd
    : decision.expectedEbitdaUsd;
  const ebitdaImpactUsd = basis * scenario.impactMultiplier;
  const midpointYears = assumption.horizonMonths / 24;
  const discountFactor = Math.pow(1 + assumption.discountRatePct / 100, midpointYears);
  const discountedOperatingCash = (ebitdaImpactUsd * assumption.cashConversionPct / 100) / discountFactor;

  return {
    scenario,
    ebitdaImpactUsd,
    discountedNetCashUsd: discountedOperatingCash - assumption.upfrontInvestmentUsd,
  };
}

export function summarizeDecisionEconomics(
  decision: Pick<Decision, "expectedEbitdaUsd" | "downsideEbitdaUsd">,
  rows: readonly Scenario[],
  assumption: EconomicsAssumption,
): DecisionEconomicsSummary {
  const calculated = rows.map((row) => scenarioEconomics(decision, row, assumption));
  const probabilityTotalPct = rows.reduce((sum, row) => sum + row.probabilityPct, 0);
  const probabilityWeightedEbitdaUsd = calculated.reduce(
    (sum, row) => sum + row.ebitdaImpactUsd * row.scenario.probabilityPct / 100,
    0,
  );
  const probabilityWeightedNpvUsd = calculated.reduce(
    (sum, row) => sum + row.discountedNetCashUsd * row.scenario.probabilityPct / 100,
    0,
  );

  return {
    probabilityTotalPct,
    probabilityWeightedEbitdaUsd,
    probabilityWeightedNpvUsd,
    overlapReservedEbitdaUsd: probabilityWeightedEbitdaUsd * (1 - assumption.overlapReservePct / 100),
  };
}

export function financialBreakEven(
  decision: Pick<Decision, "expectedEbitdaUsd">,
  assumption: EconomicsAssumption,
): FinancialBreakEven {
  const midpointYears = assumption.horizonMonths / 24;
  const discountFactor = Math.pow(1 + assumption.discountRatePct / 100, midpointYears);
  const cashConversion = assumption.cashConversionPct / 100;
  const breakEvenEbitdaUsd = cashConversion > 0
    ? assumption.upfrontInvestmentUsd * discountFactor / cashConversion
    : Number.POSITIVE_INFINITY;
  const baseCaseHeadroomUsd = decision.expectedEbitdaUsd - breakEvenEbitdaUsd;
  const requiredCashConversionPct = decision.expectedEbitdaUsd > 0
    ? assumption.upfrontInvestmentUsd * discountFactor / decision.expectedEbitdaUsd * 100
    : Number.POSITIVE_INFINITY;

  return {
    breakEvenEbitdaUsd,
    baseCaseHeadroomUsd,
    requiredCashConversionPct,
    status: baseCaseHeadroomUsd >= 0 ? "Above break-even" : "Below break-even",
  };
}

export function executiveActionForDecision(
  decision: Decision,
  rows: readonly GovernanceEvent[],
): ExecutiveAction | undefined {
  const authority = assessApprovalAuthority(decision, rows);
  if (authority.status === "Authority gap") {
    return {
      decisionId: decision.decisionId,
      title: decision.decisionTitle,
      action: "Remediate approval-authority gap",
      owner: "CFO Controller",
      sla: "Immediate",
      prerequisite: "CFO ratification or governed rollback",
      materialityBasis: decision.escalationTier,
      tone: "critical",
    };
  }
  if (authority.status === "Pending") {
    return {
      decisionId: decision.decisionId,
      title: decision.decisionTitle,
      action: "Complete CFO approval gate",
      owner: "CFO Approver",
      sla: "1 business day",
      prerequisite: "Escalation evidence complete",
      materialityBasis: decision.escalationTier,
      tone: "critical",
    };
  }
  if (measurementState(decision) === "Overdue") {
    return {
      decisionId: decision.decisionId,
      title: decision.decisionTitle,
      action: "Record overdue outcome evidence",
      owner: "Decision Owner",
      sla: "2 business days",
      prerequisite: "Reconciled actual source evidence",
      materialityBasis: `Expected value ${(decision.expectedEbitdaUsd / 1_000_000).toFixed(1)}M USD`,
      tone: "critical",
    };
  }
  if (decision.lifecycleState === "Execution Pending") {
    return {
      decisionId: decision.decisionId,
      title: decision.decisionTitle,
      action: "Confirm execution gate",
      owner: "Decision Owner",
      sla: "3 business days",
      prerequisite: "Valid approval and execution evidence",
      materialityBasis: decision.escalationTier,
      tone: "warning",
    };
  }
  return undefined;
}

export function assessContextEvidence(
  decision: Pick<Decision, "decisionId" | "decisionDate" | "decisionType">,
  rows: readonly ContextMetric[],
): ContextAssessment {
  const owned = rows.filter((row) => {
    if (row.decisionId !== decision.decisionId) return false;
    const expectedSource = FINANCIAL_METRICS.has(row.metricName)
      ? "CFO Performance Monthly"
      : "External Market Signals";
    return row.sourceSystem === expectedSource;
  });
  const eligible = owned.filter((row) => row.dataAsOfDate <= decision.decisionDate);
  const grouped = new Map<string, ContextMetric[]>();
  for (const row of eligible) {
    const key = `${row.metricName}|${row.dataAsOfDate}|${row.sourceSystem}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  const trusted: ContextMetric[] = [];
  const conflicts: ContextConflict[] = [];
  for (const [key, candidates] of grouped) {
    const values = [...new Set(candidates.map((row) => row.metricValue))].sort((a, b) => a - b);
    if (values.length > 1) {
      const sample = candidates[0];
      conflicts.push({
        key,
        metricName: sample.metricName,
        dataAsOfDate: sample.dataAsOfDate,
        sourceSystem: sample.sourceSystem,
        values,
        reason: "Conflicting duplicate facts",
      });
    } else {
      trusted.push(candidates[0]);
    }
  }

  const hasUnresolvedMarginInput = conflicts.some((item) =>
    item.metricName === "EBITDA (USD M)" || item.metricName === "Net Sales (USD M)"
  );
  if (hasUnresolvedMarginInput) {
    const marginIndex = trusted.findIndex((row) => row.metricName === "EBITDA Margin %");
    if (marginIndex >= 0) {
      const margin = trusted.splice(marginIndex, 1)[0];
      conflicts.push({
        key: `${margin.metricName}|${margin.dataAsOfDate}|dependency`,
        metricName: margin.metricName,
        dataAsOfDate: margin.dataAsOfDate,
        sourceSystem: margin.sourceSystem,
        values: [margin.metricValue],
        reason: "Derived metric depends on quarantined EBITDA or sales inputs",
      });
    }
  }

  const priority = CONTEXT_PRIORITY[decision.decisionType] ?? trusted.map((row) => row.metricName);
  const selected = priority
    .map((name) => trusted.find((row) => row.metricName === name))
    .filter((row): row is ContextMetric => Boolean(row));

  return {
    selected,
    conflicts: conflicts.sort((a, b) => a.metricName.localeCompare(b.metricName)),
    excludedFutureRows: owned.length - eligible.length,
  };
}
