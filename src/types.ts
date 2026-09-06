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
}

export interface ContextMetric {
  decisionId: string;
  metricName: string;
  metricValue: number;
  dataAsOfDate: string;
  sourceSystem: string;
  truthClassification: string;
}