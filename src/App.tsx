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
import type {
  ContextMetric,
  Decision,
  GovernanceEvent,
  Scenario
} from "./types";

const decisions = decisionsJson as Decision[];
const events = eventsJson as GovernanceEvent[];
const scenarios = scenariosJson as Scenario[];
const contextRows = contextJson as ContextMetric[];

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

function money(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value / 1_000_000).toFixed(1)}M`;
}

function decimal(value: number): string {
  return value.toFixed(3);
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

      <main className="main-area">
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
  const realized = decisions.filter((item) => item.outcomeStatus === "Realized").length;
  const projected = decisions.filter((item) => item.outcomeStatus === "Projected").length;
  const escalated = decisions.filter((item) => item.escalationCount > 0).length;
  const highRisk = decisions.filter((item) => item.downsideEbitdaUsd <= -5_000_000).length;

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

      <div className="kpi-grid six">
        <KpiCard label="Total decisions" value={decisions.length} detail="Across three business units" />
        <KpiCard label="Expected EBITDA" value={money(totalExpected)} detail="Portfolio opportunity" tone="positive" />
        <KpiCard label="Downside exposure" value={money(totalDownside)} detail="Precomputed display value" tone="critical" />
        <KpiCard label="High-risk decisions" value={highRisk} detail="Downside at or below -$5M" tone="warning" />
        <KpiCard label="Escalated records" value={escalated} detail="Historical activity" tone="info" />
        <KpiCard label="Outcomes" value={`${realized} / ${projected}`} detail="Realized / projected" />
      </div>

      <div className="dashboard-grid">
        <Panel title="Decision mix by type" eyebrow="Portfolio composition">
          <div className="chart">
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
          <div className="chart">
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
          <div className="chart">
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

        <Panel title="Expected value vs downside" eyebrow="Confidence-sized exposure">
          <div className="chart">
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
                <tr key={decision.decisionId} onClick={() => navigate(`/decision/${decision.decisionId}`)}>
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
        <span>{decision.contextMetricCount} context observations</span>
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
  return (
    <Panel title="Recommendation" eyebrow="Precomputed executive output" className="recommendation-panel">
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

function DecisionRecordPage() {
  return (
    <DecisionView>
      {(decision) => (
        <>
          <div className="kpi-grid five">
            <KpiCard label="Composite score" value={decimal(decision.compositeScore)} detail={decision.recommendationLabel} />
            <KpiCard label="Confidence" value={decision.confidencePercent} detail="Precomputed display value" />
            <KpiCard label="Expected EBITDA" value={money(decision.expectedEbitdaUsd)} detail="Expected impact" tone="positive" />
            <KpiCard label="Downside exposure" value={money(decision.downsideEbitdaUsd)} detail="Downside case" tone="critical" />
            <KpiCard label="Escalation tier" value={decision.escalationTier} detail={`${decision.escalationCount} historical escalation(s)`} tone="warning" />
          </div>

          <JourneyRail decision={decision} />
          <RecommendationPanel decision={decision} />

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
                <div><span>Context observations</span><strong>{decision.contextMetricCount}</strong></div>
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
        const rows = contextRows.filter((row) => row.decisionId === decision.decisionId);
        const uniqueMetrics = new Set(rows.map((row) => row.metricName)).size;
        const chartMetrics = ["EBITDA (USD M)", "Net Sales (USD M)", "EBITDA Margin %"];
        const trendData = chartMetrics.map((metricName) => {
          const metricRows = rows.filter((row) => row.metricName === metricName);
          return {
            metric: metricName.replace(" (USD M)", "").replace(" %", ""),
            first: metricRows[0]?.metricValue,
            second: metricRows[1]?.metricValue
          };
        });

        return (
          <>
            <PageHeading
              eyebrow="Context Time Capsule"
              title="Point-in-time evidence snapshot"
              subtitle="The evidence visible at the time the executive decision was considered."
            />

            <div className="kpi-grid four">
              <KpiCard label="Context observations" value={rows.length} detail={`${uniqueMetrics} distinct metrics`} />
              <KpiCard label="Evidence sources" value={new Set(rows.map((row) => row.sourceSystem)).size} detail="Synthetic display systems" />
              <KpiCard label="As-of date" value={prettyDate(rows[0].dataAsOfDate)} detail="Decision-time snapshot" />
              <KpiCard label="Evidence classification" value={new Set(rows.map((row) => row.truthClassification)).size} detail="Recorded and derived" />
            </div>

            <div className="two-column">
              <Panel title="Selected financial indicators" eyebrow="Two captured observation windows">
                <div className="chart tall">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData}>
                      <CartesianGrid stroke="#21314d" vertical={false} />
                      <XAxis dataKey="metric" stroke="#8292ac" />
                      <YAxis stroke="#8292ac" />
                      <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                />
                      <Legend />
                      <Bar dataKey="first" name="Decision-Time Snapshot" fill="#43d8ff" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="second" name="Comparison Snapshot" fill="#7b61ff" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
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

            <Panel title="Complete context evidence" eyebrow="Decision-time metrics">
              <div className="table-scroll">
                <table className="data-table">
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
                        <td>{row.metricValue.toFixed(2)}</td>
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

        return (
          <>
            <PageHeading
              eyebrow="Governance & Audit"
              title="Institutional control record"
              subtitle="Append-only historical activity rendered as a read-only chronology."
            />

            <div className="kpi-grid four">
              <KpiCard label="Current state" value={decision.lifecycleState} detail="Public snapshot" />
              <KpiCard label="Event count" value={decisionEvents.length} detail="Historical records" />
              <KpiCard label="Last event" value={latest.eventLabel} detail={latest.date} />
              <KpiCard label="Escalations" value={decision.escalationCount} detail={decision.escalationTier} tone={decision.escalationCount ? "critical" : "default"} />
            </div>

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
        const rows = contextRows.filter((row) => row.decisionId === decision.decisionId);
        const firstWindow = rows.slice(0, 10);
        const decisionEvents = events.filter((event) => event.decisionId === decision.decisionId);

        return (
          <>
            <PageHeading
              eyebrow="Decision Replay"
              title="THEN vs NOW"
              subtitle="Reconstruct the evidence available at decision time and compare it with the released outcome view."
            />

            <div className="kpi-grid four">
              <KpiCard label="Decision-time observations" value={rows.length} detail="THEN evidence" />
              <KpiCard label="Historical events" value={decisionEvents.length} detail="Lifecycle chronology" />
              <KpiCard label="Outcome status" value={decision.outcomeStatus} detail={decision.isReleasedByClock ? "Released" : "Projected"} />
              <KpiCard label="Outcome variance" value={`${decision.outcomeVarianceMRef.toFixed(2)}M`} detail={`As of ${prettyDate(decision.outcomeDate)}`} tone="critical" />
            </div>

            <div className="then-now">
              <Panel title="THEN — At decision" eyebrow={prettyDate(decision.decisionDate)}>
                <div className="then-now-hero">
                  <span>Recommendation</span>
                  <strong>{decision.recommendedAction}</strong>
                  <p>{decision.whySummary}</p>
                </div>
                <div className="compact-metrics">
                  {firstWindow.slice(0, 6).map((row) => (
                    <div key={row.metricName}>
                      <span>{row.metricName}</span>
                      <strong>{row.metricValue.toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="NOW — Released evidence" eyebrow={prettyDate(decision.outcomeDate)}>
                <div className="outcome-hero">
                  <StatusBadge tone={decision.outcomeStatus === "Realized" ? "positive" : "info"}>
                    {decision.outcomeStatus}
                  </StatusBadge>
                  <strong>{decision.outcomeVarianceMRef.toFixed(2)}M</strong>
                  <span>Outcome variance reference</span>
                </div>
                <dl className="definition-grid single">
                  <div><dt>Expected EBITDA</dt><dd>{money(decision.expectedEbitdaUsd)}</dd></div>
                  <div><dt>Downside exposure</dt><dd>{money(decision.downsideEbitdaUsd)}</dd></div>
                  <div><dt>Final recorded state</dt><dd>{decision.lifecycleState}</dd></div>
                  <div><dt>Evidence release</dt><dd>{decision.isReleasedByClock ? "Released" : "Not yet released"}</dd></div>
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
        const realizedItems = decisions.filter((item) => item.outcomeStatus === "Realized");
        const projectedItems = decisions.filter((item) => item.outcomeStatus === "Projected");

        const OutcomeCard = ({ item }: { item: Decision }) => (
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
              <div><span>Expected</span><strong>{money(item.expectedEbitdaUsd)}</strong></div>
              <div><span>Outcome variance</span><strong className="negative-text">{item.outcomeVarianceMRef.toFixed(2)}M</strong></div>
              <div><span>Measurement date</span><strong>{prettyDate(item.outcomeDate)}</strong></div>
            </div>
          </article>
        );

        return (
          <>
            <PageHeading
              eyebrow="Outcomes & Learning"
              title="Measured decision outcomes"
              subtitle="Released and projected outcomes connected to the original executive record."
            />

            <div className="kpi-grid four">
              <KpiCard label="Released outcomes" value={realizedItems.length} detail="Realized display records" tone="positive" />
              <KpiCard label="Projected outcomes" value={projectedItems.length} detail="Future measurement dates" tone="info" />
              <KpiCard label="Selected outcome" value={decision.outcomeStatus} detail={decision.decisionId} />
              <KpiCard label="Selected variance" value={`${decision.outcomeVarianceMRef.toFixed(2)}M`} detail={prettyDate(decision.outcomeDate)} tone="critical" />
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

function ScenarioPage() {
  return (
    <DecisionView>
      {(decision) => {
        const rows = scenarios.filter((row) => row.decisionId === decision.decisionId);
        const upside = rows.find((row) => row.scenarioName.startsWith("Upside"))!;
        const downside = rows.find((row) => row.scenarioName.startsWith("Downside"))!;

        return (
          <>
            <PageHeading
              eyebrow="Scenario & Sensitivity"
              title="Precomputed decision scenarios"
              subtitle="Base, upside and downside display values for executive inspection."
            />

            <div className="kpi-grid four">
              <KpiCard label="Base score" value={decimal(decision.compositeScore)} detail="Reference case" />
              <KpiCard label="Upside score" value={decimal(upside.scenarioScore)} detail={`+${((upside.scenarioScore - upside.baseScore) * 100).toFixed(1)} points`} tone="positive" />
              <KpiCard label="Downside score" value={decimal(downside.scenarioScore)} detail={`${((downside.scenarioScore - downside.baseScore) * 100).toFixed(1)} points`} tone="critical" />
              <KpiCard label="Scenario count" value={rows.length} detail="Precomputed cases" />
            </div>

            <Panel title="Scenario score comparison" eyebrow="Base / upside / downside">
              <div className="chart scenario-chart">
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
              {rows.map((row, index) => (
                <article key={row.scenarioName}>
                  <span>{row.scenarioName}</span>
                  <strong>{decimal(row.scenarioScore)}</strong>
                  <div className="gauge-track">
                    <i style={{ width: `${row.scenarioScore * 100}%`, background: index === 1 ? "#36d399" : index === 2 ? "#ff6b7a" : "#43d8ff" }} />
                  </div>
                  <small>Base reference {decimal(row.baseScore)}</small>
                </article>
              ))}
            </div>
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
  const rows = contextRows.filter((row) => row.decisionId === decision.decisionId);
  const decisionEvents = events.filter((event) => event.decisionId === decision.decisionId);
  const selectedScenarios = scenarios.filter((row) => row.decisionId === decision.decisionId);

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
      kicker: "Frame 2 · Why We Made It",
      title: decision.recommendedAction,
      body: (
        <>
          <p className="story-quote">{decision.whySummary}</p>
          <div className="story-metric-grid">
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
            <span>Outcome variance</span>
            <strong>{decision.outcomeVarianceMRef.toFixed(2)}M</strong>
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
            <strong>{decision.isReleasedByClock ? "Released" : "Projected"}</strong>
          </div>
        </div>
      )
    },
    {
      kicker: "Frame 5 · What We Learned",
      title: "One connected executive record",
      body: (
        <>
          <p className="story-quote">
            The recommendation, decision-time evidence, historical accountability record,
            scenario display and measured outcome remain connected for executive review.
          </p>
          <div className="story-scenario-row">
            {selectedScenarios.map((scenario) => (
              <div key={scenario.scenarioName}>
                <span>{scenario.scenarioName}</span>
                <strong>{decimal(scenario.scenarioScore)}</strong>
              </div>
            ))}
          </div>
        </>
      )
    }
  ], [decision, decisionEvents.length, rows, selectedScenarios]);

  return (
    <>
      <PageHeading
        eyebrow="Executive Story"
        title="Board-ready decision narrative"
        subtitle="Five concise frames connecting the decision, evidence, accountability and outcome."
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