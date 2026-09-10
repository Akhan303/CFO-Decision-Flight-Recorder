export interface Alternative {
  label: string;
  source: string;
  isRecommended: boolean;
  economics: string;
}

export interface Decision {
  decisionId: string;
  decisionTitle: string;
  decisionType: string;
  businessUnit: string;
  decisionDate: string;
  lifecycleState: string;
  recommendationLabel: string;
  recommendedAction: string;
  compositeScore: number;
  confidencePercent: string;
  expectedEbitdaUsd: number;
  downsideEbitdaUsd: number;
  escalationTier: string;
  comparisonMode: "Fully Comparative" | "Single Eligible Alternative";
  whySummary: string;
  outcomeStatus: string;
  outcomeDate: string;
  outcomeVarianceMRef: number;
  isReleasedByClock: boolean;
  eventCount: number;
  escalationCount: number;
  contextMetricCount: number;
  contextSources: string[];
  contextDateRange: string[];
  alternatives: Alternative[];
}

export interface GovernanceEvent {
  decisionId: string;
  seq: number;
  eventLabel: string;
  transition: string;
  actorRole: string;
  date: string;
  comment: string;
}

export interface Scenario {
  decisionId: string;
  scenarioName: string;
  baseScore: number;
  scenarioScore: number;
  probabilityPct: number;
  impactBasis: "Expected" | "Downside";
  impactMultiplier: number;
  assumptionDelta: string;
}

export interface EconomicsAssumption {
  decisionId: string;
  currency: "USD";
  horizonMonths: number;
  upfrontInvestmentUsd: number;
  cashConversionPct: number;
  discountRatePct: number;
  cashTiming: string;
  overlapGroup: string;
  overlapReservePct: number;
  assumptionStatus: "Illustrative";
  asOfDate: string;
}

export interface OutcomeActual {
  decisionId: string;
  actualEbitdaUsd: number;
  currency: "USD";
  measurementStartDate: string;
  measurementEndDate: string;
  recordedAt: string;
  sourceSystem: string;
  evidenceStatus: "Observed";
}

export interface FinancePolicy {
  modelVersion: string;
  owner: string;
  probabilityMethod: string;
  ebitdaFormula: string;
  npvProxyFormula: string;
  discountTiming: string;
  overlapTreatment: string;
  roundingPolicy: string;
  lastValidated: string;
}

export interface ContextMetric {
  decisionId: string;
  metricName: string;
  metricValue: number;
  dataAsOfDate: string;
  sourceSystem: string;
  truthClassification: string;
}
