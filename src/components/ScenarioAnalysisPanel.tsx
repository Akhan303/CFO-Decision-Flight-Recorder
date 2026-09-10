import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { parseScenarioSet, type ScenarioAnalysisRow } from '../lib/scenarioAnalysis';

const metrics = [
  { key: 'ebitdaUsd', label: 'Incremental EBITDA', note: 'Operating impact', tone: 'blue' },
  { key: 'workingCapitalReleaseUsd', label: 'Working capital', note: 'Cash release / (use)', tone: 'teal' },
  { key: 'investmentUsd', label: 'Capital investment', note: 'Cash committed', tone: 'amber' },
  { key: 'netCashUsd', label: 'Net cash proxy', note: 'Pre-tax · undiscounted', tone: 'navy' },
] as const;

function money(value: number, decimals = 1) {
  const sign = value < 0 ? '−' : '';
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${sign}$${(absolute / 1_000_000_000).toFixed(decimals)}B`;
  if (absolute >= 1_000_000) return `${sign}$${(absolute / 1_000_000).toFixed(decimals)}M`;
  if (absolute >= 1_000) return `${sign}$${(absolute / 1_000).toFixed(decimals)}K`;
  return `${sign}$${absolute.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function driverValue(value: number, unit: string) {
  if (unit === 'fraction') return `${(value * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
  if (unit.startsWith('USD')) return money(value, value >= 1_000_000 ? 1 : 0);
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${unit}`;
}

export default function ScenarioAnalysisPanel({
  decisionId,
  rows,
  loading,
  error,
  compact = false,
}: {
  decisionId: string;
  rows: readonly ScenarioAnalysisRow[];
  loading?: boolean;
  error?: unknown;
  compact?: boolean;
}) {
  if (error) {
    return <section className="scenario-analysis scenario-state" role="alert"><span className="scenario-state-mark">!</span><div><h2>Current scenario analysis unavailable</h2><p>The governed scenario query failed. No cached or invented results are shown.</p></div></section>;
  }
  if (loading && rows.length === 0) {
    return <section className="scenario-analysis scenario-state" role="status"><span className="scenario-loading" /><div><h2>Loading current scenario analysis</h2><p>Retrieving versioned driver inputs and financial results.</p></div></section>;
  }
  if (rows.length === 0) {
    return <section className="scenario-analysis scenario-state"><span className="scenario-state-mark">—</span><div><h2>Current scenario analysis</h2><p>No FDR-DRIVER-v1 records are indexed for this decision. This is a missing-data state, not a zero financial result.</p></div></section>;
  }

  let scenarios;
  try {
    scenarios = parseScenarioSet(rows, decisionId);
  } catch (e) {
    return <section className="scenario-analysis scenario-state" role="alert"><span className="scenario-state-mark">!</span><div><h2>Scenario evidence needs attention</h2><p>{e instanceof Error ? e.message : 'Invalid model evidence.'} Financial charts are withheld.</p></div></section>;
  }

  const base = scenarios[0].payload;
  const chart = scenarios.map((scenario) => ({
    name: scenario.name,
    'Incremental EBITDA': scenario.payload.result.ebitdaUsd / 1e6,
    'Net cash proxy': scenario.payload.result.netCashUsd / 1e6,
  }));
  const sensitivity = base.sensitivity.map((item) => ({
    name: `${item.label} · ${driverValue(item.testedValue, item.unit)}`,
    EBITDA: item.ebitdaDeltaUsd / 1e6,
    'Net cash': item.netCashDeltaUsd / 1e6,
  }));

  return (
    <section className={`scenario-analysis${compact ? ' compact' : ''}`} aria-label="Current synthetic driver analysis">
      <header className="scenario-hero">
        <div>
          <div className="scenario-overline">Current analysis <span>·</span> synthetic inputs</div>
          <h2>Decision-specific financial scenarios</h2>
          <p>Transparent operating and cash economics for the modeled alternative.</p>
        </div>
        <div className="scenario-model-badge"><span>Model</span><strong>{base.modelVersion}</strong></div>
      </header>

      <div className="scenario-context-grid">
        <div><span>Modeled action</span><strong>{base.alternative}</strong></div>
        <div><span>Reference</span><strong>{base.reference}</strong></div>
        <div><span>Analysis horizon</span><strong>{base.periodStart} — {base.periodEnd}</strong><small>{base.horizonMonths} months · USD · created {base.createdAt}</small></div>
      </div>

      <div className="scenario-kpi-grid">
        {metrics.map((metric) => {
          const value = base.result[metric.key];
          return <article key={metric.key} className={`scenario-kpi ${metric.tone}${value < 0 ? ' negative' : ''}`}><span>{metric.label}</span><strong>{money(value)}</strong><small>{metric.note}</small></article>;
        })}
      </div>

      <div className="scenario-disclosure"><span className="scenario-disclosure-icon">i</span><p>{base.comparisonWarning} Recorded recommendation EBITDA: <strong>{base.recordedExpectedEbitdaUsd === null ? 'not supplied' : money(base.recordedExpectedEbitdaUsd)}</strong>. A matched measurement period has not been established.</p></div>

      {compact ? <p className="scenario-compact-note">The Scenarios view contains all three cases, driver changes, financial deltas, sensitivities, formulas and provenance. These current estimates remain separate from measured outcome evidence.</p> : <>
        <div className="scenario-chart-grid">
          <article className="scenario-chart-card">
            <header><div><span>Scenario range</span><h3>EBITDA and cash impact</h3></div><small>USD millions · unweighted</small></header>
            <p>Alternative estimates relative to the stated reference. The zero line preserves unfavorable results.</p>
            <div role="img" aria-label="EBITDA and net cash by scenario" className="scenario-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{ top: 18, right: 12, bottom: 4, left: 4 }} barGap={5}><CartesianGrid strokeDasharray="2 5" vertical={false} stroke="#dfe7ec"/><XAxis dataKey="name" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${value}M`}/><Tooltip formatter={(value) => [`${Number(value).toFixed(2)}M USD`, '']} cursor={{ fill: '#f2f6f8' }}/><Legend iconType="circle" iconSize={7}/><ReferenceLine y={0} stroke="#8394a2"/><Bar dataKey="Incremental EBITDA" fill="#1769a6" radius={[5, 5, 0, 0]} maxBarSize={42}/><Bar dataKey="Net cash proxy" fill="#c0842c" radius={[5, 5, 0, 0]} maxBarSize={42}/></BarChart></ResponsiveContainer></div>
          </article>
          <article className="scenario-chart-card">
            <header><div><span>One-factor sensitivity</span><h3>Value at ±10% driver movement</h3></div><small>Δ to Base · USD millions</small></header>
            <p>Each driver moves independently while all other Base assumptions remain fixed.</p>
            <div role="img" aria-label="Financial sensitivity to individual drivers" className="scenario-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={sensitivity} layout="vertical" margin={{ top: 10, right: 12, bottom: 4, left: 4 }} barGap={3}><CartesianGrid strokeDasharray="2 5" horizontal={false} stroke="#dfe7ec"/><XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(value) => `${value}M`}/><YAxis type="category" dataKey="name" width={185} axisLine={false} tickLine={false} tick={{ fontSize: 9 }}/><Tooltip formatter={(value) => [`${Number(value).toFixed(2)}M USD`, '']} cursor={{ fill: '#f2f6f8' }}/><Legend iconType="circle" iconSize={7}/><ReferenceLine x={0} stroke="#8394a2"/><Bar dataKey="EBITDA" fill="#1769a6" radius={[0, 4, 4, 0]} maxBarSize={14}/><Bar dataKey="Net cash" fill="#13795b" radius={[0, 4, 4, 0]} maxBarSize={14}/></BarChart></ResponsiveContainer></div>
          </article>
        </div>

        <div className="scenario-table-block">
          <div className="scenario-table-heading"><div><span>Financial bridge</span><h3>Scenario results</h3></div><small>USD · unweighted</small></div>
          <div className="scenario-table-scroll"><table className="scenario-table"><thead><tr><th>Case</th>{metrics.map((metric) => <th key={metric.key}>{metric.label}</th>)}<th>EBITDA Δ</th><th>Net cash Δ</th></tr></thead><tbody>{scenarios.map((scenario) => <tr key={scenario.id}><th><span className={`scenario-case-dot ${scenario.name.toLowerCase()}`}/>{scenario.name}</th>{metrics.map((metric) => <td key={metric.key} className={scenario.payload.result[metric.key] < 0 ? 'negative' : ''}>{money(scenario.payload.result[metric.key])}</td>)}<td className={scenario.payload.delta.ebitdaUsd < 0 ? 'negative' : 'positive'}>{money(scenario.payload.delta.ebitdaUsd)}</td><td className={scenario.payload.delta.netCashUsd < 0 ? 'negative' : 'positive'}>{money(scenario.payload.delta.netCashUsd)}</td></tr>)}</tbody></table></div>
          <p className="scenario-footnote">Working-capital release is cash, not EBITDA. Positive investment consumes cash; negative investment means spending is deferred beyond this horizon.</p>
        </div>

        <div className="scenario-table-block">
          <div className="scenario-table-heading"><div><span>Assumption register</span><h3>Driver inputs</h3></div><small>All newly designed synthetic assumptions</small></div>
          <div className="scenario-table-scroll"><table className="scenario-table assumptions"><thead><tr><th>Driver</th><th>Unit</th>{scenarios.map((scenario) => <th key={scenario.id}>{scenario.name}</th>)}</tr></thead><tbody>{base.inputs.map((input) => <tr key={input.key}><th>{input.label}</th><td>{input.unit === 'fraction' ? '%' : input.unit}</td>{scenarios.map((scenario) => { const item = scenario.payload.inputs.find((candidate) => candidate.key === input.key); return <td key={scenario.id}>{item ? driverValue(item.value, item.unit) : 'Not supplied'}</td>; })}</tr>)}</tbody></table></div>
        </div>

        <details className="scenario-methodology"><summary><span>Model methodology and provenance</span><small>Formula, cash convention and evidence boundary</small></summary><div><h4>Operating formula</h4><p>{base.formula}</p><h4>Cash convention</h4><p>{base.cashFormula}</p><h4>Input provenance</h4><p>{base.provenance}</p><p>Scenario results describe the modeled alternative in this new period. Historical recommendation, approval and outcome records are preserved. No probability or automatic decision authority is asserted.</p></div></details>
      </>}
    </section>
  );
}
