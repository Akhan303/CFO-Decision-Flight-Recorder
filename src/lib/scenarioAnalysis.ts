export interface ScenarioAnalysisRow {
  analysisId: string;
  decisionId?: string;
  scenarioName?: string;
  modelVersion?: string;
  analysisPayload?: string;
}
export interface FinancialResult {
  ebitdaUsd: number;
  workingCapitalReleaseUsd: number;
  investmentUsd: number;
  netCashUsd: number;
}
export interface ScenarioPayload {
  schemaVersion: number;
  modelVersion: string;
  createdAt: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  horizonMonths: number;
  provenance: string;
  reference: string;
  alternative: string;
  formula: string;
  cashFormula: string;
  comparisonWarning: string;
  recordedExpectedEbitdaUsd: number | null;
  baseline: FinancialResult;
  result: FinancialResult;
  delta: FinancialResult;
  inputs: { key: string; label: string; unit: string; baseline: number; value: number; provenance: string }[];
  sensitivity: { driver: string; label: string; unit: string; baselineValue: number; testedValue: number; ebitdaDeltaUsd: number; netCashDeltaUsd: number }[];
}
export interface ParsedScenario { id: string; name: string; payload: ScenarioPayload }
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const financial = (value: unknown): value is FinancialResult => !!value && typeof value === 'object' && ['ebitdaUsd','workingCapitalReleaseUsd','investmentUsd','netCashUsd'].every(k => finite((value as Record<string,unknown>)[k]));

/** Validate evidence received from the object query. Never fill missing finance with zero. */
export function parseScenarioSet(rows: readonly ScenarioAnalysisRow[], decisionId: string): ParsedScenario[] {
  if (rows.length !== 3 || new Set(rows.map(r => r.analysisId)).size !== 3) {throw new Error('Three unique scenario records are required.');}
  const expected = ['Base','Upside','Downside'];
  if (new Set(rows.map(r => r.scenarioName)).size !== 3 || rows.some(r => !expected.includes(r.scenarioName ?? ''))) {throw new Error('The scenario set is incomplete or duplicated.');}
  const result = rows.map(row => {
    if (row.decisionId !== decisionId || row.modelVersion !== 'FDR-DRIVER-v1' || !row.analysisPayload) {throw new Error('Scenario identity or model version mismatch.');}
    const p = JSON.parse(row.analysisPayload) as ScenarioPayload;
    if (p.schemaVersion !== 1 || p.modelVersion !== row.modelVersion || p.currency !== 'USD' || p.horizonMonths !== 12 || !Number.isFinite(Date.parse(p.createdAt)) || !Number.isFinite(Date.parse(p.periodStart)) || !Number.isFinite(Date.parse(p.periodEnd)) || p.periodEnd < p.periodStart || p.createdAt.slice(0,10) > p.periodStart || !financial(p.result) || !financial(p.baseline) || !financial(p.delta)) {throw new Error('Scenario financial basis is missing or invalid.');}
    if (p.recordedExpectedEbitdaUsd !== null && !finite(p.recordedExpectedEbitdaUsd)) {throw new Error('Recorded expectation is missing or invalid.');}
    if (![p.provenance,p.reference,p.alternative,p.formula,p.cashFormula,p.comparisonWarning].every(s => typeof s === 'string' && s.length>0)) {throw new Error('Scenario provenance is incomplete.');}
    if (!Array.isArray(p.inputs) || p.inputs.length===0 || p.inputs.some(x => !x.key || !x.label || !x.unit || !finite(x.value) || !finite(x.baseline))) {throw new Error('Scenario drivers are incomplete.');}
    if (!Array.isArray(p.sensitivity) || p.sensitivity.some(x => !x.driver || !finite(x.ebitdaDeltaUsd) || !finite(x.netCashDeltaUsd) || !finite(x.testedValue) || !finite(x.baselineValue))) {throw new Error('Driver sensitivity evidence is invalid.');}
    return {id:row.analysisId,name:row.scenarioName!,payload:p};
  }).sort((a,b)=>expected.indexOf(a.name)-expected.indexOf(b.name));
  const base=result[0].payload;
  const driverKeys=base.inputs.map(x=>x.key).sort().join('|');
  if (result.some(r=>new Set(r.payload.inputs.map(x=>x.key)).size!==base.inputs.length || r.payload.inputs.map(x=>x.key).sort().join('|')!==driverKeys)) {throw new Error('Scenario driver sets do not match.');}
  if (result.some(r => r.payload.createdAt!==base.createdAt || r.payload.periodStart!==base.periodStart || r.payload.periodEnd!==base.periodEnd || JSON.stringify(r.payload.baseline)!==JSON.stringify(base.baseline))) {throw new Error('Scenario periods or baselines do not match.');}
  return result;
}
