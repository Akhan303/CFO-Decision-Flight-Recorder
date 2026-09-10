import { ReactNode, useMemo, useState } from "react";
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams
} from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from "recharts";

import decisionsJson from "./data/decisions.json";
import eventsJson from "./data/events.json";
import scenariosJson from "./data/scenarios.json";
import contextJson from "./data/context.json";
import economicsJson from "./data/economics.json";
import actualsJson from "./data/actuals.json";
import financePolicyJson from "./data/finance-policy.json";
import currentScenariosJson from "./data/current-scenarios.json";
import ScenarioAnalysisPanel from "./components/ScenarioAnalysisPanel";
import type { ScenarioAnalysisRow } from "./lib/scenarioAnalysis";
import type {
  ContextMetric,
  Decision,
  EconomicsAssumption,
  FinancePolicy,
  GovernanceEvent,
  OutcomeActual,
  Scenario
} from "./types";
import {
  assessApprovalAuthority,
  assessContextEvidence,
  attainment,
  executiveActionForDecision,
  financialBreakEven,
  formatUsdMillions,
  measurementState,
  outcomeAssessment,
  recommendationDisposition,
  scenarioEconomics,
  summarizeDecisionEconomics,
  SIMULATION_DATE
} from "./domain";
import "./aip-brief.css";

const decisions = decisionsJson as Decision[];
const events = eventsJson as GovernanceEvent[];
const scenarios = scenariosJson as Scenario[];
const contextRows = contextJson as ContextMetric[];
const economics = economicsJson as EconomicsAssumption[];
const actuals = actualsJson as OutcomeActual[];
const financePolicy = financePolicyJson as FinancePolicy;
const currentScenarios = currentScenariosJson as ScenarioAnalysisRow[];

const COLORS = ["#43d8ff", "#7b61ff", "#36d399", "#ffb84d", "#ff6b7a", "#77a6ff"];

const TOOLTIP_STYLE = {
  backgroundColor: "#0e1a30",
  border: "1px solid #35506f",
  borderRadius: "8px",
  color: "#f8fafc",
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)"
};

const TOOLTIP_LABEL_STYLE = {
  color: "#f8fafc",
  fontWeight: 600
};

const TOOLTIP_ITEM_STYLE = {
  color: "#f8fafc"
};
const DEFAULT_DECISION = decisions[0].decisionId;

const stateTone: Record<string, string> = {
  Closed: "positive",
  Executed: "positive",
  Approved: "info",
  Escalated: "critical",
  "Execution Pending": "warning",
  "Outcome Pending": "warning"
};

function contextSnapshot(decision: Decision): ContextMetric[] {
  return assessContextEvidence(decision, contextRows).selected;
}

function money(value: number): string {
  return formatUsdMillions(value);
}

function decimal(value: number): string {
  return value.toFixed(3);
}

function outcomeFor(decision: Decision) {
  return outcomeAssessment(decision, actuals);
}

function metricValue(row: ContextMetric): string {
  if (row.metricName.includes("USD M")) return `$${row.metricValue.toFixed(1)}M`;
  if (row.metricName.includes("%")) return `${row.metricValue.toFixed(1)}%`;
  if (row.metricName.includes("days")) return `${row.metricValue.toFixed(1)} days`;
  return row.metricValue.toFixed(2);
}

function prettyDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
}

function groupCount(values: string[]) {
  return Array.from(
    values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<string, number>())
  ).map(([name, value]) => ({ name, value }));
}

function selectedDecision(id?: string): Decision {
  return decisions.find((decision) => decision.decisionId === id) ?? decisions[0];
}

function StatusBadge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}

function KpiCard({
  label,
  value,
  detail,
  tone = "default"
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: string;
}) {
  return (
    <article className={`kpi-card ${tone}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {detail && <div className="kpi-detail">{detail}</div>}
    </article>
  );
}

function Panel({
  title,
  eyebrow,
  action,
  children,
  className = ""
}: {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || eyebrow || action) && (
        <header className="panel-header">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h2>{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

function PageHeading({
  eyebrow,
  title,
  subtitle,
  children
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {children && <div className="page-heading-actions">{children}</div>}
    </header>
  );
}

function DecisionSelector({
  value,
  onChange
}: {
  value: string;
  onChange: (decisionId: string) => void;
}) {
  return (
    <label className="decision-selector">
      <span>Decision</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {decisions.map((decision) => (
          <option key={decision.decisionId} value={decision.decisionId}>
            {decision.decisionId} — {decision.decisionTitle}
          </option>
        ))}
      </select>
    </label>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="sidebar">
        <div className="brand">
          <img src="./arcadia-mark.svg" alt="" />
          <div>
            <strong>Arcadia Industrial Automation</strong>
            <span>CFO Decision Flight Recorder</span>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Primary">
          <NavLink to="/command-center">⌂ <span>Command Center</span></NavLink>
          <NavLink to={`/decision/${DEFAULT_DECISION}`}>◆ <span>Decision Experience</span></NavLink>
        </nav>

        <div className="sidebar-spacer" />

        <div className="read-only-notice">
          <span className="pulse" />
          <div>
            <strong>Public showcase</strong>
            <small>Static · synthetic · read-only</small>
          </div>
        </div>
      </aside>

      <main className="main-area" id="main-content" tabIndex={-1}>
        <div className="topbar">
          <div className="topbar-title">
            <span>Executive Experience</span>
            <strong>Governed Decision Intelligence</strong>
          </div>
          <StatusBadge tone="positive">READ-ONLY</StatusBadge>
        </div>
        <div className="content">{children}</div>
        <footer>
          Simulation · 20 Aug 2026 · Phase 3 · Synthetic data · Demonstration
        </footer>
      </main>
    </div>
  );
}

function CommandCenter() {
  const navigate = useNavigate();
  const [chosen, setChosen] = useState(DEFAULT_DECISION);

  const totalExpected = decisions.reduce((sum, item) => sum + item.expectedEbitdaUsd, 0);
  const totalDownside = decisions.reduce((sum, item) => sum + item.downsideEbitdaUsd, 0);
  const realized = decisions.filter((item) => measurementState(item) === "Realized").length;
  const projected = decisions.filter((item) => measurementState(item) !== "Realized").length;

  const stateMix = groupCount(decisions.map((item) => item.lifecycleState));
  const typeMix = groupCount(decisions.map((item) => item.decisionType));
  const unitMix = groupCount(decisions.map((item) => item.businessUnit));
  const scatter = decisions.map((item) => ({
    id: item.decisionId,
    title: item.decisionTitle,
    expected: item.expectedEbitdaUsd / 1_000_000,
    downside: item.downsideEbitdaUsd / 1_000_000,
    confidence: Number(item.confidencePercent.replace("%", ""))
  }));
  const actionQueue = decisions.flatMap((decision) => {
    const action = executiveActionForDecision(decision, events);
    return action ? [{ decision, action }] : [];
  });
  const authorityGaps = decisions.filter((item) => assessApprovalAuthority(item, events).status === "Authority gap").length;
  const portfolioEconomics = decisions.map((decision) => summarizeDecisionEconomics(
    decision,
    scenarios.filter((row) => row.decisionId === decision.decisionId),
    economics.find((row) => row.decisionId === decision.decisionId)!,
  ));
  const riskAdjustedEbitda = portfolioEconomics.reduce((sum, item) => sum + item.probabilityWeightedEbitdaUsd, 0);
  const overlapReservedEbitda = portfolioEconomics.reduce((sum, item) => sum + item.overlapReservedEbitdaUsd, 0);
  const probabilityWeightedNpv = portfolioEconomics.reduce((sum, item) => sum + item.probabilityWeightedNpvUsd, 0);

  return (
    <>
      <PageHeading
        eyebrow="Portfolio Intelligence"
        title="CFO Command Center"
        subtitle="Decision portfolio, executive exposure, governance history and measurable outcomes."
      >
        <div className="command-select">
          <DecisionSelector value={chosen} onChange={setChosen} />
          <button className="primary-button" onClick={() => navigate(`/decision/${chosen}`)}>
            Open decision
          </button>
        </div>
      </PageHeading>

      <div className="kpi-grid four">
        <KpiCard label="Total decisions" value={decisions.length} detail="Across three business units" />
        <KpiCard label="Gross modeled EBITDA" value={money(totalExpected)} detail="Undiscounted · overlap not adjusted" tone="positive" />
        <KpiCard label="Probability-weighted EBITDA" value={money(riskAdjustedEbitda)} detail="Across explicit scenario probabilities" tone="positive" />
        <KpiCard label="Overlap-reserved planning value" value={money(overlapReservedEbitda)} detail="Portfolio planning only" tone="warning" />
        <KpiCard label="Probability-weighted NPV proxy" value={money(probabilityWeightedNpv)} detail="Cash-converted · midpoint discounted" tone={probabilityWeightedNpv >= 0 ? "positive" : "critical"} />
        <KpiCard label="Gross downside exposure" value={money(totalDownside)} detail="Non-additive stress indicator" tone="critical" />
        <KpiCard label="Authority gaps" value={authorityGaps} detail="Required approver not evidenced" tone={authorityGaps ? "critical" : "positive"} />
        <KpiCard label="Outcomes" value={`${realized} / ${projected}`} detail="Realized / projected" />
      </div>

      <div className="dashboard-grid">
        <Panel title="Decision mix by type" eyebrow="Portfolio composition">
          <div className="chart" role="img" aria-label="Bar chart showing decision count by decision type">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeMix} layout="vertical" margin={{ left: 22, right: 18 }}>
                <CartesianGrid stroke="#21314d" horizontal={false} />
                <XAxis type="number" allowDecimals={false} stroke="#8292ac" />
                <YAxis type="category" dataKey="name" width={105} stroke="#8292ac" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                />
                <Bar dataKey="value" fill="#43d8ff" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Business-unit coverage" eyebrow="Executive portfolio">
          <div className="chart" role="img" aria-label="Bar chart showing decision count by business unit">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={unitMix}>
                <CartesianGrid stroke="#21314d" vertical={false} />
                <XAxis dataKey="name" stroke="#8292ac" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} stroke="#8292ac" />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                />
                <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                  {unitMix.map((_, index) => <Cell key={index} fill={COLORS[index]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Workflow state distribution" eyebrow="Current public snapshot">
          <div className="chart" role="img" aria-label="Donut chart showing decision count by workflow state">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stateMix} dataKey="value" nameKey="name" innerRadius={54} outerRadius={88} paddingAngle={3}>
                  {stateMix.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Modeled value vs downside" eyebrow="Decision-level comparison · not a portfolio forecast">
          <div className="chart" role="img" aria-label="Scatter chart comparing modeled EBITDA value and downside for each decision">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ left: 0, right: 18, top: 12, bottom: 6 }}>
                <CartesianGrid stroke="#21314d" />
                <XAxis
                  type="number"
                  dataKey="downside"
                  name="Downside"
                  unit="M"
                  stroke="#8292ac"
                  domain={["dataMin - 1", 0]}
                />
                <YAxis
                  type="number"
                  dataKey="expected"
                  name="Expected"
                  unit="M"
                  stroke="#8292ac"
                />
                <ZAxis type="number" dataKey="confidence" range={[90, 480]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                />
                <Scatter data={scatter} fill="#7b61ff" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="Executive decision watchlist" eyebrow="Select any record">
        <div className="table-scroll">
          <table className="data-table interactive">
            <caption className="sr-only">Executive decision watchlist with governance state, modeled value, downside and outcome status</caption>
            <thead>
              <tr>
                <th>Decision</th>
                <th>Business unit</th>
                <th>State</th>
                <th>Recommendation</th>
                <th>Score</th>
                <th>Expected value</th>
                <th>Downside</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((decision) => (
                <tr
                  key={decision.decisionId}
                  role="link"
                  tabIndex={0}
                  aria-label={`Open ${decision.decisionId}: ${decision.decisionTitle}`}
                  onClick={() => navigate(`/decision/${decision.decisionId}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/decision/${decision.decisionId}`);
                    }
                  }}
                >
                  <td>
                    <strong>{decision.decisionId}</strong>
                    <span>{decision.decisionTitle}</span>
                  </td>
                  <td>{decision.businessUnit}</td>
                  <td><StatusBadge tone={stateTone[decision.lifecycleState]}>{decision.lifecycleState}</StatusBadge></td>
                  <td>{decision.recommendedAction}</td>
                  <td>{decimal(decision.compositeScore)}</td>
                  <td className="positive-text">{money(decision.expectedEbitdaUsd)}</td>
                  <td className="negative-text">{money(decision.downsideEbitdaUsd)}</td>
                  <td><StatusBadge tone={decision.outcomeStatus === "Realized" ? "positive" : "info"}>{decision.outcomeStatus}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Executive action queue" eyebrow="Exceptions requiring an accountable next step">
        <div className="action-queue">
          {actionQueue.map(({ decision, action }) => (
            <button key={`${decision.decisionId}-${action.action}`} onClick={() => navigate(`/decision/${decision.decisionId}`)}>
              <span><StatusBadge tone={action.tone}>{action.sla}</StatusBadge></span>
              <strong>{action.action}</strong>
              <small>
                {decision.decisionId} · Owner: {action.owner} · Prerequisite: {action.prerequisite} · Basis: {action.materialityBasis}
              </small>
              <b>Open →</b>
            </button>
          ))}
        </div>
      </Panel>
    </>
  );
}

const decisionTabs = [
  { path: "", label: "Decision Record" },
  { path: "/context", label: "Context" },
  { path: "/audit", label: "Governance & Audit" },
  { path: "/replay", label: "Decision Replay" },
  { path: "/outcomes", label: "Outcomes & Learning" },
  { path: "/scenarios", label: "Scenario & Sensitivity" },
  { path: "/story", label: "Executive Story" }
];

function DecisionHeader({ decision }: { decision: Decision }) {
  const navigate = useNavigate();

  return (
    <>
      <PageHeading
        eyebrow={`${decision.decisionId} · ${decision.decisionType}`}
        title={decision.decisionTitle}
        subtitle={`${decision.businessUnit} · Decision date ${prettyDate(decision.decisionDate)}`}
      >
        <DecisionSelector
          value={decision.decisionId}
          onChange={(id) => navigate(`/decision/${id}`)}
        />
      </PageHeading>

      <div className="passport-strip">
        <StatusBadge tone={stateTone[decision.lifecycleState]}>{decision.lifecycleState}</StatusBadge>
        <StatusBadge tone={decision.escalationTier.includes("Critical") ? "critical" : "warning"}>
          {decision.escalationTier}
        </StatusBadge>
        <span>{decision.outcomeStatus} outcome</span>
        <span>{contextSnapshot(decision).length} executive context drivers</span>
      </div>

      <nav className="decision-tabs" aria-label="Decision experience">
        {decisionTabs.map((tab) => (
          <NavLink
            key={tab.label}
            end={tab.path === ""}
            to={`/decision/${decision.decisionId}${tab.path}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

function DecisionView({ children }: { children: (decision: Decision) => ReactNode }) {
  const { decisionId } = useParams();
  const decision = selectedDecision(decisionId);

  return (
    <>
      <DecisionHeader decision={decision} />
      {children(decision)}
    </>
  );
}

function JourneyRail({ decision }: { decision: Decision }) {
  const items = events.filter((event) => event.decisionId === decision.decisionId);

  return (
    <Panel title="Decision journey" eyebrow="Historical lifecycle record">
      <div className="journey-rail">
        {items.map((event, index) => (
          <div className="journey-step" key={`${event.decisionId}-${event.seq}`}>
            <div className={`journey-dot ${index === items.length - 1 ? "current" : "complete"}`}>
              {index + 1}
            </div>
            <div>
              <strong>{event.eventLabel}</strong>
              <span>{event.date}</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function RecommendationPanel({ decision }: { decision: Decision }) {
  const authority = assessApprovalAuthority(decision, events);
  const disposition = recommendationDisposition(decision.decisionId, events);
  return (
    <Panel title="Recommendation and accountable decision" eyebrow="Model-derived advice is distinct from human authority" className="recommendation-panel">
      <div className="recommendation-layout">
        <div>
          <StatusBadge tone="info">{decision.recommendationLabel}</StatusBadge>
          <h3>{decision.recommendedAction}</h3>
          <p className="recommendation-copy">{decision.whySummary}</p>
        </div>

        <div className="score-gauge">
          <div className="gauge-value">{decimal(decision.compositeScore)}</div>
          <div className="gauge-label">Composite display score</div>
          <div className="gauge-track">
            <span style={{ width: `${decision.compositeScore * 100}%` }} />
          </div>
          <small>Confidence {decision.confidencePercent}</small>
        </div>
      </div>

      <div className="authority-grid">
        <div>
          <span>Comparison basis</span>
          <strong>{decision.comparisonMode}</strong>
          <small>{decision.comparisonMode === "Fully Comparative" ? "All displayed alternatives have governed economics" : "Only one alternative has eligible governed economics"}</small>
        </div>
        <div>
          <span>Model-derived recommendation</span>
          <strong>{decision.recommendedAction}</strong>
          <small>Decision support · not autonomous authority</small>
        </div>
        <div>
          <span>Authorized human decision</span>
          <strong>{authority.status}</strong>
          <small>
            Required: {authority.requiredRole} · Actual: {authority.actualRole ?? "Not recorded"}
            {authority.approvalDate ? ` · ${authority.approvalDate}` : ""}
          </small>
        </div>
        <div>
          <span>Recommendation disposition</span>
          <strong>{disposition}</strong>
          <small>{disposition === "Not recorded" ? "Accepted / modified / overridden / deferred cannot be inferred" : "Explicitly recorded in the governance trail"}</small>
        </div>
      </div>

      <div className="alternative-grid">
        {decision.alternatives.map((alternative) => (
          <article className={`alternative-card ${alternative.isRecommended ? "recommended" : ""}`} key={alternative.label}>
            <div>
              <span>{alternative.source}</span>
              {alternative.isRecommended && <StatusBadge tone="positive">Recommended</StatusBadge>}
            </div>
            <strong>{alternative.label}</strong>
            <small>{alternative.economics}</small>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function FoundryAipBriefPanel() {
  return (
    <Panel
      title="AIP recommendation evidence brief"
      eyebrow="Governed, on-demand synthesis in the authenticated Foundry experience"
      className="aip-brief-panel"
    >
      <div className="aip-brief-layout">
        <div>
          <StatusBadge tone="positive">Published in Foundry</StatusBadge>
          <h3>Evidence-grounded executive synthesis</h3>
          <p className="recommendation-copy">
            The operational application can generate a decision-ready brief from governed alternatives,
            evidence, assumptions, uncertainties, and run provenance. Deterministic completeness gates run
            before the model is called, and the brief never authorizes or changes the human decision.
          </p>
        </div>
        <div className="aip-brief-control" aria-label="Foundry-only AIP control">
          <button type="button" disabled>Available in authenticated Foundry</button>
          <small>This public showcase is static and never invokes a model.</small>
        </div>
      </div>
      <div className="aip-capability-grid">
        <div><span>Invocation</span><strong>Explicit, on demand</strong></div>
        <div><span>Grounding</span><strong>Governed ontology evidence</strong></div>
        <div><span>Guardrail</span><strong>Completeness gate first</strong></div>
        <div><span>Authority</span><strong>Human decision remains final</strong></div>
      </div>
    </Panel>
  );
}

function DecisionRecordPage() {
  return (
    <DecisionView>
      {(decision) => (
        <>
          <div className="kpi-grid five">
            <KpiCard label="Model-derived score" value={decimal(decision.compositeScore)} detail={decision.recommendationLabel} />
            <KpiCard label="Confidence" value={decision.confidencePercent} detail="Precomputed display value" />
            <KpiCard label="Expected EBITDA" value={money(decision.expectedEbitdaUsd)} detail="Expected impact" tone="positive" />
            <KpiCard label="Downside exposure" value={money(decision.downsideEbitdaUsd)} detail="Downside case" tone="critical" />
            <KpiCard label="Escalation tier" value={decision.escalationTier} detail={`${decision.escalationCount} historical escalation(s)`} tone="warning" />
          </div>

          <JourneyRail decision={decision} />
          <RecommendationPanel decision={decision} />
          <FoundryAipBriefPanel />

          <div className="two-column">
            <Panel title="Decision passport" eyebrow="Governed identity">
              <dl className="definition-grid">
                <div><dt>Decision ID</dt><dd>{decision.decisionId}</dd></div>
                <div><dt>Decision type</dt><dd>{decision.decisionType}</dd></div>
                <div><dt>Business unit</dt><dd>{decision.businessUnit}</dd></div>
                <div><dt>Decision date</dt><dd>{prettyDate(decision.decisionDate)}</dd></div>
                <div><dt>Current state</dt><dd>{decision.lifecycleState}</dd></div>
                <div><dt>Measurement date</dt><dd>{prettyDate(decision.outcomeDate)}</dd></div>
              </dl>
            </Panel>

            <Panel title="Supporting evidence" eyebrow="Public display snapshot">
              <div className="evidence-list">
                <div><span>Executive context drivers</span><strong>{contextSnapshot(decision).length}</strong></div>
                <div><span>Evidence sources</span><strong>{decision.contextSources.length}</strong></div>
                <div><span>Historical events</span><strong>{decision.eventCount}</strong></div>
                <div><span>Scenario cases</span><strong>3</strong></div>
              </div>
              <div className="source-chips">
                {decision.contextSources.map((source) => <span key={source}>{source}</span>)}
              </div>
            </Panel>
          </div>
        </>
      )}
    </DecisionView>
  );
}

function ContextPage() {
  return (
    <DecisionView>
      {(decision) => {
        const assessment = assessContextEvidence(decision, contextRows);
        const rows = assessment.selected;
        const uniqueMetrics = new Set(rows.map((row) => row.metricName)).size;

        return (
          <>
            <PageHeading
              eyebrow="Context Time Capsule"
              title="Point-in-time evidence snapshot"
              subtitle="The evidence visible at the time the executive decision was considered."
            />

            <div className="integrity-callout" role="note">
              Public context is a separate synthetic illustration for the read-only showcase. It is not a row-for-row sanitized export of the authenticated Foundry context, so values can differ between the two experiences.
            </div>

            <div className="kpi-grid four">
              <KpiCard label="Trusted drivers" value={rows.length} detail={`${uniqueMetrics} unambiguous metrics`} />
              <KpiCard label="Quarantined conflicts" value={assessment.conflicts.length} detail="Excluded from decision evidence" tone={assessment.conflicts.length ? "critical" : "positive"} />
              <KpiCard label="Evidence sources" value={new Set(rows.map((row) => row.sourceSystem)).size} detail="Synthetic display systems" />
              <KpiCard label="As-of date" value={rows[0] ? prettyDate(rows[0].dataAsOfDate) : "Not available"} detail="No later than decision date" />
            </div>

            <div className="two-column">
              <Panel title="Decision-time drivers" eyebrow="Unit-aware evidence · no mixed-scale axis">
                <div className="evidence-list">
                  {rows.map((row) => (
                    <div key={`${row.metricName}-${row.dataAsOfDate}`}>
                      <span>{row.metricName}</span>
                      <strong>{metricValue(row)}</strong>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Evidence coverage" eyebrow="Source and classification">
                <div className="coverage-stack">
                  {groupCount(rows.map((row) => row.sourceSystem)).map((entry, index) => (
                    <div className="coverage-row" key={entry.name}>
                      <span>{entry.name}</span>
                      <div><i style={{ width: `${(entry.value / rows.length) * 100}%`, background: COLORS[index] }} /></div>
                      <strong>{entry.value}</strong>
                    </div>
                  ))}
                  {groupCount(rows.map((row) => row.truthClassification)).map((entry, index) => (
                    <div className="coverage-row" key={entry.name}>
                      <span>{entry.name}</span>
                      <div><i style={{ width: `${(entry.value / rows.length) * 100}%`, background: COLORS[index + 2] }} /></div>
                      <strong>{entry.value}</strong>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            {assessment.conflicts.length > 0 && (
              <Panel title="Evidence integrity exceptions" eyebrow="Conflicting source-owned facts · quarantined">
                <div className="integrity-callout">
                  These records are conflicting source facts or derived KPIs with unresolved inputs. They are shown for remediation and do not feed the trusted driver view.
                </div>
                <div className="table-scroll">
                  <table className="data-table">
                    <caption className="sr-only">Quarantined evidence conflicts excluded from the trusted driver view</caption>
                    <thead><tr><th>Metric</th><th>Observed values</th><th>Issue</th><th>Source</th><th>As-of date</th></tr></thead>
                    <tbody>
                      {assessment.conflicts.map((conflict) => (
                        <tr key={conflict.key}>
                          <td><strong>{conflict.metricName}</strong></td>
                          <td className="negative-text">{conflict.values.join(" vs ")}</td>
                          <td>{conflict.reason}</td>
                          <td>{conflict.sourceSystem}</td>
                          <td>{prettyDate(conflict.dataAsOfDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}

            <Panel title="Executive context evidence" eyebrow="Unambiguous decision-time metrics with authoritative source ownership">
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Executive context evidence with source ownership, classification and as-of date</caption>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Value</th>
                      <th>Source</th>
                      <th>Evidence classification</th>
                      <th>As-of date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={`${row.metricName}-${index}`}>
                        <td><strong>{row.metricName}</strong></td>
                        <td>{metricValue(row)}</td>
                        <td>{row.sourceSystem}</td>
                        <td><StatusBadge tone={row.truthClassification === "Recorded" ? "positive" : "info"}>{row.truthClassification}</StatusBadge></td>
                        <td>{prettyDate(row.dataAsOfDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        );
      }}
    </DecisionView>
  );
}

function AuditPage() {
  return (
    <DecisionView>
      {(decision) => {
        const decisionEvents = events.filter((event) => event.decisionId === decision.decisionId);
        const latest = decisionEvents[decisionEvents.length - 1];
        const authority = assessApprovalAuthority(decision, decisionEvents);
        const disposition = recommendationDisposition(decision.decisionId, decisionEvents);

        return (
          <>
            <PageHeading
              eyebrow="Governance & Audit"
              title="Institutional control record"
              subtitle="Append-only historical activity rendered as a read-only chronology."
            />

            <div className="kpi-grid six">
              <KpiCard label="Current state" value={decision.lifecycleState} detail="Public snapshot" />
              <KpiCard label="Event count" value={decisionEvents.length} detail="Historical records" />
              <KpiCard label="Last event" value={latest.eventLabel} detail={latest.date} />
              <KpiCard label="Escalations" value={decision.escalationCount} detail={decision.escalationTier} tone={decision.escalationCount ? "critical" : "default"} />
              <KpiCard label="Approval authority" value={authority.status} detail={`${authority.actualRole ?? "No approver"} / ${authority.requiredRole}`} tone={authority.status === "Satisfied" ? "positive" : "critical"} />
              <KpiCard label="Recommendation disposition" value={disposition} detail={disposition === "Not recorded" ? "Governance gap" : "Explicit event"} tone={disposition === "Not recorded" ? "warning" : "positive"} />
            </div>

            <Panel title="Approval control check" eyebrow="Policy requirement reconciled to event evidence">
              <div className="authority-grid">
                <div><span>Required authority</span><strong>{authority.requiredRole}</strong><small>{decision.escalationTier}</small></div>
                <div><span>Observed authority</span><strong>{authority.actualRole ?? "Not recorded"}</strong><small>{authority.approvalDate ?? "No approval date"}</small></div>
                <div><span>Control result</span><strong>{authority.status}</strong><small>{authority.explanation}</small></div>
              </div>
            </Panel>

            <Panel title="Accountability chronology" eyebrow="Who acted, what occurred, and when">
              <div className="timeline">
                {decisionEvents.map((event) => (
                  <article className="timeline-event" key={`${event.decisionId}-${event.seq}`}>
                    <div className="timeline-seq">{String(event.seq).padStart(2, "0")}</div>
                    <div className="timeline-line" />
                    <div className="timeline-card">
                      <header>
                        <div>
                          <h3>{event.eventLabel}</h3>
                          <span>{event.transition}</span>
                        </div>
                        <StatusBadge tone={event.eventLabel.includes("Escalation") ? "critical" : "info"}>
                          {event.actorRole}
                        </StatusBadge>
                      </header>
                      <p>{event.comment}</p>
                      <time>{event.date}</time>
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          </>
        );
      }}
    </DecisionView>
  );
}

function ReplayPage() {
  return (
    <DecisionView>
      {(decision) => {
        const rows = contextSnapshot(decision);
        const decisionEvents = events.filter((event) => event.decisionId === decision.decisionId);
        const outcome = outcomeFor(decision);
        const actual = actuals.find((row) => row.decisionId === decision.decisionId);

        return (
          <>
            <PageHeading
              eyebrow="Decision Replay"
              title="THEN vs NOW"
              subtitle={decision.isReleasedByClock ? "Reconstruct the evidence available at decision time and compare it with the released outcome." : "Reconstruct the evidence available at decision time and track the outcome evidence still required."}
            />

            <div className="kpi-grid four">
              <KpiCard label="Decision-time observations" value={rows.length} detail="THEN evidence" />
              <KpiCard label="Historical events" value={decisionEvents.length} detail="Lifecycle chronology" />
              <KpiCard label="Measurement status" value={measurementState(decision)} detail={measurementState(decision) === "Overdue" ? "Outcome not recorded" : prettyDate(decision.outcomeDate)} tone={measurementState(decision) === "Overdue" ? "critical" : "info"} />
              <KpiCard label={decision.isReleasedByClock ? "Actual variance" : "Projected variance"} value={outcome.variance === undefined ? "—" : money(outcome.variance)} detail={`${outcome.basis} · value less expected`} tone="critical" />
            </div>

            <div className="then-now">
              <Panel title="THEN — At decision" eyebrow={prettyDate(decision.decisionDate)}>
                <div className="then-now-hero">
                  <span>Recommendation</span>
                  <strong>{decision.recommendedAction}</strong>
                  <p>{decision.whySummary}</p>
                </div>
                <div className="compact-metrics">
                  {rows.map((row) => (
                    <div key={row.metricName}>
                      <span>{row.metricName}</span>
                      <strong>{row.metricValue.toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title={decision.isReleasedByClock ? "NOW — Released evidence" : "NOW — Awaiting evidence"} eyebrow={prettyDate(decision.outcomeDate)}>
                <div className="outcome-hero">
                  <StatusBadge tone={decision.outcomeStatus === "Realized" ? "positive" : "info"}>
                    {decision.outcomeStatus}
                  </StatusBadge>
                  <strong>{outcome.variance === undefined ? "—" : money(outcome.variance)}</strong>
                  <span>{outcome.basis} variance · value less expected</span>
                </div>
                <dl className="definition-grid single">
                  <div><dt>Expected EBITDA</dt><dd>{money(decision.expectedEbitdaUsd)}</dd></div>
                  <div><dt>Downside exposure</dt><dd>{money(decision.downsideEbitdaUsd)}</dd></div>
                  <div><dt>Final recorded state</dt><dd>{decision.lifecycleState}</dd></div>
                  <div><dt>Evidence release</dt><dd>{decision.isReleasedByClock ? "Released" : "Not yet released"}</dd></div>
                  <div><dt>Outcome source</dt><dd>{actual ? `${actual.sourceSystem} · recorded ${prettyDate(actual.recordedAt)}` : "Projection reference · no observed actual"}</dd></div>
                </dl>
              </Panel>
            </div>

            <Panel title="Replay summary" eyebrow="Executive learning view">
              <p className="large-copy">
                The original recommendation, supporting evidence, accountability chronology and
                outcome display remain connected in one read-only executive record. This view
                shows what was known then and what became visible later without exposing the
                internal mechanisms that produced the recommendation.
              </p>
            </Panel>
          </>
        );
      }}
    </DecisionView>
  );
}

function OutcomesPage() {
  return (
    <DecisionView>
      {(decision) => {
        const realizedItems = decisions.filter((item) => measurementState(item) === "Realized");
        const projectedItems = decisions.filter((item) => measurementState(item) !== "Realized");
        const overdueItems = projectedItems.filter((item) => measurementState(item) === "Overdue");

        const OutcomeCard = ({ item }: { item: Decision }) => {
          const outcome = outcomeFor(item);
          const variance = outcome.variance;
          const actual = actuals.find((row) => row.decisionId === item.decisionId);
          return (
          <article className={`outcome-card ${item.decisionId === decision.decisionId ? "selected" : ""}`}>
            <header>
              <div>
                <span>{item.decisionId}</span>
                <strong>{item.decisionTitle}</strong>
              </div>
              <StatusBadge tone={item.outcomeStatus === "Realized" ? "positive" : "info"}>
                {item.outcomeStatus}
              </StatusBadge>
            </header>
            <div className="outcome-values">
              <div><span>Recorded expected EBITDA</span><strong>{money(item.expectedEbitdaUsd)}</strong></div>
              <div><span>Expected measurement period</span><strong>Not established in source contract</strong></div>
              <div><span>Observed measurement window</span><strong>{actual ? `${prettyDate(actual.measurementStartDate)} – ${prettyDate(actual.measurementEndDate)}` : "Not observed"}</strong></div>
              <div><span>{outcome.basis}</span><strong>{outcome.value === undefined ? "—" : money(outcome.value)}</strong></div>
              <div><span>Variance · value less expected</span><strong className={(variance ?? 0) >= 0 ? "positive-text" : "negative-text"}>{variance === undefined ? "—" : money(variance)}</strong></div>
              <div><span>Direction</span><strong>{variance === undefined ? "Unverified" : variance >= 0 ? "Favorable" : "Unfavorable"}</strong></div>
              <div><span>Attainment</span><strong>{attainment(item, actuals)}</strong></div>
              <div><span>Measurement status</span><strong>{measurementState(item)}</strong></div>
              <div><span>Measurement date</span><strong>{prettyDate(item.outcomeDate)}</strong></div>
              <div><span>Evidence source</span><strong>{actual ? `${actual.sourceSystem} · ${prettyDate(actual.recordedAt)}` : "Projection reference · not observed"}</strong></div>
              <div><span>Learning / next gate</span><strong>{item.isReleasedByClock ? "Obtain matched-period target and benefit definition" : measurementState(item) === "Overdue" ? "Record outcome evidence" : "Measure on scheduled date"}</strong></div>
            </div>
          </article>
          );
        };

        const selectedOutcome = outcomeFor(decision);

        return (
          <>
            <PageHeading
              eyebrow="Outcomes & Learning"
              title="Measured decision outcomes"
              subtitle="Recorded expectations and observed values are shown independently. Actual variance and attainment are withheld until periods and benefit definitions are matched. Projected amounts remain synthetic-reference illustrations."
            />

            <div className="kpi-grid four">
              <KpiCard label="Released outcomes" value={realizedItems.length} detail="Realized display records" tone="positive" />
              <KpiCard label="Projected outcomes" value={projectedItems.length} detail={`${overdueItems.length} overdue · ${projectedItems.length - overdueItems.length} scheduled`} tone="info" />
              <KpiCard label="Selected outcome" value={decision.outcomeStatus} detail={decision.decisionId} />
              <KpiCard label={decision.isReleasedByClock ? "Selected actual variance" : "Selected projected variance"} value={selectedOutcome.variance === undefined ? "—" : money(selectedOutcome.variance)} detail={decision.isReleasedByClock ? "Matched-period target not established" : "Synthetic reference · not observed"} tone="critical" />
            </div>

            <Panel title="Released outcomes" eyebrow="Observed performance">
              <div className="outcomes-grid">
                {realizedItems.map((item) => <OutcomeCard item={item} key={item.decisionId} />)}
              </div>
            </Panel>

            <Panel title="Projected outcomes" eyebrow="Pending measurement">
              <div className="outcomes-grid">
                {projectedItems.map((item) => <OutcomeCard item={item} key={item.decisionId} />)}
              </div>
            </Panel>
          </>
        );
      }}
    </DecisionView>
  );
}

function HistoricalScenarioPage() {
  return (
    <DecisionView>
      {(decision) => {
        const rows = scenarios.filter((row) => row.decisionId === decision.decisionId);
        const assumption = economics.find((row) => row.decisionId === decision.decisionId)!;
        const summary = summarizeDecisionEconomics(decision, rows, assumption);
        const calculatedRows = rows.map((row) => scenarioEconomics(decision, row, assumption));
        const breakEven = financialBreakEven(decision, assumption);

        return (
          <>
            <PageHeading
              eyebrow="Scenario & Sensitivity"
              title="Illustrative financial scenarios"
              subtitle="Presentation-only assumptions separated from recorded facts; values are comparable in USD over an explicit decision horizon."
            />

            {decision.decisionId === "D-2026-031" && (
              <Panel title="Foundry parity disclosure" eyebrow="Authenticated status · DEFERRED_NO_SOURCE">
                <p className="large-copy">
                  The authenticated Foundry application has no reproducible scenario linkage for this decision.
                  The public scenarios below are clearly labeled presentation-only illustrations and are not ontology-backed scenario outputs.
                </p>
              </Panel>
            )}

            <div className="kpi-grid six">
              <KpiCard label="Probability-weighted EBITDA" value={money(summary.probabilityWeightedEbitdaUsd)} detail={`${assumption.horizonMonths}-month horizon`} tone="positive" />
              <KpiCard label="Probability-weighted NPV proxy" value={money(summary.probabilityWeightedNpvUsd)} detail="After investment and discounting" tone={summary.probabilityWeightedNpvUsd >= 0 ? "positive" : "critical"} />
              <KpiCard label="Upfront investment" value={money(assumption.upfrontInvestmentUsd)} detail={assumption.cashTiming} tone="warning" />
              <KpiCard label="Cash conversion" value={`${assumption.cashConversionPct}%`} detail={`${assumption.discountRatePct}% discount rate`} />
              <KpiCard label="Overlap reserve" value={`${assumption.overlapReservePct}%`} detail={assumption.overlapGroup} tone="warning" />
              <KpiCard label="Probability coverage" value={`${summary.probabilityTotalPct}%`} detail={`${rows.length} mutually exclusive cases`} />
            </div>

            <Panel title="Economic model contract" eyebrow="Scope, timing and portfolio treatment">
              <div className="authority-grid">
                <div><span>Valuation scope</span><strong>{assumption.currency} · {assumption.horizonMonths} months</strong><small>Assumptions as of {prettyDate(assumption.asOfDate)} · {assumption.assumptionStatus}</small></div>
                <div><span>Cash and discounting</span><strong>{assumption.cashConversionPct}% conversion · {assumption.discountRatePct}% rate</strong><small>{assumption.cashTiming}. Proxy = midpoint-discounted EBITDA × cash conversion − upfront investment.</small></div>
                <div><span>Portfolio overlap</span><strong>{assumption.overlapGroup}</strong><small>{assumption.overlapReservePct}% reserve · planning value {money(summary.overlapReservedEbitdaUsd)}</small></div>
              </div>
            </Panel>

            <Panel title="Finance breakpoints" eyebrow={`${financePolicy.modelVersion} · calculation provenance`}>
              <div className="authority-grid">
                <div><span>Break-even EBITDA</span><strong>{money(breakEven.breakEvenEbitdaUsd)}</strong><small>Minimum horizon benefit required for zero discounted net cash</small></div>
                <div><span>Base-case headroom</span><strong className={breakEven.baseCaseHeadroomUsd >= 0 ? "positive-text" : "negative-text"}>{money(breakEven.baseCaseHeadroomUsd)}</strong><small>{breakEven.status} at the stated investment and cash conversion</small></div>
                <div><span>Required cash conversion</span><strong>{Number.isFinite(breakEven.requiredCashConversionPct) ? `${breakEven.requiredCashConversionPct.toFixed(0)}%` : "—"}</strong><small>{financePolicy.discountTiming}. {financePolicy.roundingPolicy}.</small></div>
              </div>
            </Panel>

            <Panel title="Scenario score comparison" eyebrow="Base / upside / downside">
              <div className="chart scenario-chart" role="img" aria-label={`Scenario score comparison for ${decision.decisionId}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={rows} margin={{ left: 12, right: 20, top: 20, bottom: 12 }}>
                    <CartesianGrid stroke="#21314d" vertical={false} />
                    <XAxis dataKey="scenarioName" stroke="#8292ac" />
                    <YAxis domain={[0, 1]} stroke="#8292ac" />
                    <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                />
                    <Legend />
                    <ReferenceLine y={decision.compositeScore} stroke="#ffb84d" strokeDasharray="5 5" />
                    <Bar dataKey="scenarioScore" name="Scenario score" radius={[7, 7, 0, 0]}>
                      {rows.map((row, index) => (
                        <Cell
                          key={row.scenarioName}
                          fill={index === 0 ? "#43d8ff" : index === 1 ? "#36d399" : "#ff6b7a"}
                        />
                      ))}
                    </Bar>
                    <Line type="monotone" dataKey="baseScore" name="Base reference" stroke="#ffb84d" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <div className="scenario-cards">
              {calculatedRows.map(({ scenario: row, ebitdaImpactUsd, discountedNetCashUsd }, index) => (
                <article key={row.scenarioName}>
                  <span>{row.scenarioName} · {row.probabilityPct}%</span>
                  <strong>{money(ebitdaImpactUsd)}</strong>
                  <div className="gauge-track">
                    <i style={{ width: `${row.scenarioScore * 100}%`, background: index === 1 ? "#36d399" : index === 2 ? "#ff6b7a" : "#43d8ff" }} />
                  </div>
                  <small>Decision score {decimal(row.scenarioScore)} · base {decimal(row.baseScore)}</small>
                  <dl>
                    <div><dt>Assumption</dt><dd>{row.assumptionDelta}</dd></div>
                    <div><dt>EBITDA impact</dt><dd>{money(ebitdaImpactUsd)} over {assumption.horizonMonths} months</dd></div>
                    <div><dt>Discounted net cash proxy</dt><dd>{money(discountedNetCashUsd)} after {money(assumption.upfrontInvestmentUsd)} investment</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          </>
        );
      }}
    </DecisionView>
  );
}

function ScenarioPage() {
  return (
    <DecisionView>
      {(decision) => {
        const rows = currentScenarios.filter((row) => row.decisionId === decision.decisionId);
        return (
          <>
            <PageHeading
              eyebrow="Scenario & Sensitivity"
              title="Current driver-based analysis"
              subtitle="A dated, read-only showcase of FDR-DRIVER-v1 outputs built from disclosed synthetic assumptions and authoritative decision links."
            />

            <ScenarioAnalysisPanel decisionId={decision.decisionId} rows={rows} />

            <Panel title="Public showcase boundary" eyebrow="Read-only · synthetic projection">
              <p className="large-copy">
                These current estimates were exported from the governed scenario transformation for public demonstration. They do not revise the original recommendation, represent an observed outcome, or authorize an action. Internal recommendation and alternative identifiers are excluded from this public dataset.
              </p>
            </Panel>

            <details className="legacy-scenario-archive">
              <summary>
                <span>Historical presentation model at the 20 Aug 2026 snapshot</span>
                <small>Open the archived score shifts, probabilities and NPV proxy</small>
              </summary>
              <HistoricalScenarioPage />
            </details>
          </>
        );
      }}
    </DecisionView>
  );
}

function StoryPage() {
  return (
    <DecisionView>
      {(decision) => <ExecutiveStory decision={decision} />}
    </DecisionView>
  );
}

function ExecutiveStory({ decision }: { decision: Decision }) {
  const [frame, setFrame] = useState(0);
  const rows = contextSnapshot(decision);
  const decisionEvents = events.filter((event) => event.decisionId === decision.decisionId);
  const currentScenarioRows = currentScenarios.filter((row) => row.decisionId === decision.decisionId);
  const authority = assessApprovalAuthority(decision, decisionEvents);
  const disposition = recommendationDisposition(decision.decisionId, decisionEvents);
  const outcome = outcomeFor(decision);

  const frames = useMemo(() => [
    {
      kicker: "Frame 1 · The Decision",
      title: decision.decisionTitle,
      body: (
        <div className="story-metric-grid">
          <KpiCard label="Decision ID" value={decision.decisionId} detail={decision.decisionType} />
          <KpiCard label="Business unit" value={decision.businessUnit} detail={prettyDate(decision.decisionDate)} />
          <KpiCard label="Current state" value={decision.lifecycleState} detail={decision.escalationTier} />
        </div>
      )
    },
    {
      kicker: "Frame 2 · Advice and Authority",
      title: "Model-derived recommendation, accountable human decision",
      body: (
        <>
          <p className="story-quote">{decision.whySummary}</p>
          <div className="story-metric-grid">
            <KpiCard label="Model-derived recommendation" value={decision.recommendedAction} detail="Decision support" />
            <KpiCard label="Approval authority" value={authority.status} detail={`${authority.actualRole ?? "No approver"} / ${authority.requiredRole}`} tone={authority.status === "Satisfied" ? "positive" : "critical"} />
            <KpiCard label="Disposition" value={disposition} detail={disposition === "Not recorded" ? "No unsupported inference" : "Explicit governance event"} />
            <KpiCard label="Score" value={decimal(decision.compositeScore)} />
            <KpiCard label="Confidence" value={decision.confidencePercent} />
            <KpiCard label="Expected EBITDA" value={money(decision.expectedEbitdaUsd)} tone="positive" />
            <KpiCard label="Downside" value={money(decision.downsideEbitdaUsd)} tone="critical" />
          </div>
        </>
      )
    },
    {
      kicker: "Frame 3 · What Changed",
      title: "The evidence visible at decision time",
      body: (
        <div className="story-evidence">
          {rows.slice(0, 8).map((row, index) => (
            <div key={`${row.metricName}-${index}`}>
              <span>{row.metricName}</span>
              <strong>{row.metricValue.toFixed(2)}</strong>
              <small>{row.sourceSystem}</small>
            </div>
          ))}
        </div>
      )
    },
    {
      kicker: "Frame 4 · What Happened",
      title: `${decision.outcomeStatus} outcome`,
      body: (
        <div className="story-outcome">
          <div>
            <span>{decision.isReleasedByClock ? "Actual variance" : "Projected variance"}</span>
            <strong>{outcome.variance === undefined ? "—" : money(outcome.variance)}</strong>
          </div>
          <div>
            <span>Measurement date</span>
            <strong>{prettyDate(decision.outcomeDate)}</strong>
          </div>
          <div>
            <span>Historical events</span>
            <strong>{decisionEvents.length}</strong>
          </div>
          <div>
            <span>Evidence release</span>
            <strong>{decision.isReleasedByClock ? "Released" : measurementState(decision)}</strong>
          </div>
        </div>
      )
    },
    {
      kicker: "Frame 5 · Current Analysis",
      title: "A new driver model, clearly separated from the historic record",
      body: <ScenarioAnalysisPanel decisionId={decision.decisionId} rows={currentScenarioRows} compact />
    },
    {
      kicker: "Frame 6 · What We Learned",
      title: decision.isReleasedByClock ? "Measure value, explain variance, retain the learning" : "Close the governance loop at the next evidence gate",
      body: (
        <>
          <p className="story-quote">
            {decision.isReleasedByClock
              ? `The record connects the model-derived recommendation, recorded human authorization and observed evidence. A matched-period target and common benefit definition are still needed before variance, attainment or realized value conclusions can be drawn.`
              : `The record connects the model-derived recommendation, available human authorization and point-in-time evidence. The outcome is not measured; the next executive action is to ${measurementState(decision) === "Overdue" ? "record overdue outcome evidence" : `measure value on ${prettyDate(decision.outcomeDate)}`}.`}
          </p>
          <div className="integrity-callout" role="note">
            Historical FIN-SCENARIO-v1 score stress tests remain in the archived Scenario section at the 20 Aug 2026 snapshot. Those ranking diagnostics are not probabilities, current financial results or observed outcomes.
          </div>
        </>
      )
    }
  ], [currentScenarioRows, decision, decisionEvents.length, outcome.variance, rows]);

  return (
    <>
      <PageHeading
        eyebrow="Executive Story"
        title="Board-ready decision narrative"
        subtitle="Six concise frames connecting the decision, evidence, accountability, current analysis and outcome."
      />

      <Panel className="story-panel">
        <div className="story-frame">
          <div className="eyebrow">{frames[frame].kicker}</div>
          <h2>{frames[frame].title}</h2>
          <div className="story-body">{frames[frame].body}</div>
        </div>

        <div className="story-controls">
          <button
            onClick={() => setFrame((current) => Math.max(0, current - 1))}
            disabled={frame === 0}
          >
            ← Previous
          </button>
          <div>
            {frames.map((_, index) => (
              <button
                key={index}
                aria-label={`Open frame ${index + 1}`}
                className={index === frame ? "active" : ""}
                onClick={() => setFrame(index)}
              />
            ))}
          </div>
          <button
            onClick={() => setFrame((current) => Math.min(frames.length - 1, current + 1))}
            disabled={frame === frames.length - 1}
          >
            Next →
          </button>
        </div>
      </Panel>
    </>
  );
}

function NotFound() {
  return (
    <Panel title="Page not found">
      <p className="large-copy">Return to the CFO Command Center to select a decision.</p>
      <NavLink className="primary-button inline-button" to="/command-center">
        Return to Command Center
      </NavLink>
    </Panel>
  );
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/command-center" replace />} />
        <Route path="/command-center" element={<CommandCenter />} />
        <Route path="/decision/:decisionId" element={<DecisionRecordPage />} />
        <Route path="/decision/:decisionId/context" element={<ContextPage />} />
        <Route path="/decision/:decisionId/audit" element={<AuditPage />} />
        <Route path="/decision/:decisionId/replay" element={<ReplayPage />} />
        <Route path="/decision/:decisionId/outcomes" element={<OutcomesPage />} />
        <Route path="/decision/:decisionId/scenarios" element={<ScenarioPage />} />
        <Route path="/decision/:decisionId/story" element={<StoryPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Shell>
  );
}
