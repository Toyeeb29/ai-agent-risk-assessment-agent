import { useState } from 'react';
import type { AssessmentResult } from '../types';
import { Badge, BAND_COLOR, Card, KV, Meter, StatusRow } from './ui';
import ExecutiveReport from './ExecutiveReport';

const TABS = [
  'Overview',
  'Findings',
  'Agentic analysis',
  'Control gaps',
  'Evidence gaps',
  'Governance mapping',
  'Remediation',
  'Executive report',
  'Audit record',
] as const;

type Tab = (typeof TABS)[number];

/** Plain-language meaning of each band, so the number is never the only signal. */
const BAND_MEANING: Record<string, string> = {
  LOW: 'No blocking issues found in the automated pass. A person still records the decision.',
  MODERATE: 'Approvable with conditions. The identified gaps are addressable before deployment.',
  HIGH: 'Requires human governance review before an approval decision can be made.',
  CRITICAL: 'Should not be approved in its current configuration.',
};

const DECISION_LABEL: Record<string, string> = {
  APPROVE: 'No blocking issues found',
  APPROVE_WITH_CONDITIONS: 'Approve with conditions',
  REQUIRES_GOVERNANCE_REVIEW: 'Requires governance review',
  DO_NOT_APPROVE: 'Do not approve as configured',
};

/** Assessment identity — real values from n8n, never generated in the browser. */
function IdentityHeader({ r }: { r: AssessmentResult }) {
  const a = r.audit_record;
  return (
    <div className="ident">
      <dl>
        <div className="pair">
          <dt>Assessment ID</dt>
          <dd>{a.assessment_id}</dd>
        </div>
        <div className="pair">
          <dt>Assessment date</dt>
          <dd>
            {new Date(r.generated_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </dd>
        </div>
        <div className="pair">
          <dt>Status</dt>
          <dd>{a.final_status === 'PENDING_HUMAN_GOVERNANCE_REVIEW' ? 'Pending governance review' : 'Completed'}</dd>
        </div>
        <div className="pair">
          <dt>Engine</dt>
          <dd>v{a.engine_version}</dd>
        </div>
        <div className="pair">
          <dt>Input fingerprint</dt>
          <dd>{a.input_fingerprint}</dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * The project's central design decision, stated where a reviewer will actually
 * see it rather than only in the documentation.
 */
function DecisionSplit() {
  return (
    <div className="split">
      <div>
        <div className="who" style={{ color: 'var(--accent)' }}>
          The model decides
        </div>
        <h4>Qualitative analysis and language</h4>
        <ul>
          <li>Which risks this specific system creates, and why</li>
          <li>How an agent's authority could be misused</li>
          <li>The wording of each remediation action</li>
          <li>The business-language executive summary</li>
          <li>The rationale attached to a governance mapping</li>
        </ul>
      </div>
      <div>
        <div className="who" style={{ color: 'var(--low)' }}>
          Rules decide
        </div>
        <h4>Everything that has to be defended</h4>
        <ul>
          <li>The risk score, its three factors and the band</li>
          <li>Every control status and severity</li>
          <li>Every evidence status</li>
          <li>Remediation priority and SLA</li>
          <li>Whether human governance review is required</li>
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ panels */

function Overview({ r }: { r: AssessmentResult }) {
  const { risk } = r;
  return (
    <>
      <div className="scorecard">
        <div className="scoredial" style={{ borderColor: BAND_COLOR[risk.band], background: 'var(--surface)' }}>
          <span className="val" style={{ color: BAND_COLOR[risk.band] }}>
            {risk.score}
          </span>
          <span className="max">of {risk.max_score}</span>
          <span className="band" style={{ color: BAND_COLOR[risk.band] }}>
            {risk.band}
          </span>
        </div>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <h3>{r.system.name}</h3>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.86rem', margin: '4px 0 0' }}>
                {r.system.owner} · {r.system.department}
              </p>
            </div>
            <Badge value={r.executive_summary.recommended_decision}>
              {DECISION_LABEL[r.executive_summary.recommended_decision] ??
                r.executive_summary.recommended_decision.replace(/_/g, ' ')}
            </Badge>
          </div>

          <div className="grid c3" style={{ marginTop: 20 }}>
            {(['impact', 'likelihood', 'exposure'] as const).map((k) => {
              const f = risk.factors[k];
              return (
                <div key={k}>
                  <div className="mono" style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)' }}>
                    {k}
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)' }}>
                    {f.value}
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>/4</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{f.label}</div>
                </div>
              );
            })}
          </div>

          <p style={{ marginTop: 16, marginBottom: 0, fontSize: '0.87rem', color: 'var(--text-muted)' }}>
            <strong style={{ color: BAND_COLOR[risk.band] }}>{risk.band}</strong> — {BAND_MEANING[risk.band]}
          </p>
          <p className="mono" style={{ marginTop: 8, marginBottom: 0, fontSize: '0.76rem', color: 'var(--text-dim)' }}>
            {risk.methodology.formula} · engine {risk.methodology.engine_version}
          </p>
        </Card>
      </div>

      <div style={{ marginTop: 20 }}>
        <DecisionSplit />
      </div>

      <div className="grid c2" style={{ marginTop: 20 }}>
        <Card>
          <h3>Risk distribution</h3>
          <div style={{ marginTop: 12 }}>
            {risk.domains.map((d) => (
              <div className="domain" key={d.domain}>
                <div className="top">
                  <span className="name">{d.domain}</span>
                  <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                      {d.score}
                    </span>
                    <Badge value={d.band} />
                  </span>
                </div>
                <Meter pct={d.score} band={d.band} label={`${d.domain}: ${d.score} of 100, ${d.band}`} />
                <p style={{ margin: '8px 0 0', fontSize: '0.81rem', color: 'var(--text-dim)' }}>
                  {d.drivers.slice(0, 3).join(' · ')}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card>
            <h3>Agent risk modifiers</h3>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-dim)', margin: '6px 0 12px' }}>
              The six agent-specific factors, each 0–4, that feed the Impact × Likelihood × Exposure
              calculation. Derived at intake by rule.
            </p>
            <KV
              items={Object.entries(risk.modifiers).map(([k, v]) => [
                k.replace(/_/g, ' ').replace(/^./, (s) => s.toUpperCase()),
                <span className="mono" key={k} style={{ color: v >= 3 ? 'var(--high)' : 'var(--text)' }}>
                  {v} / 4
                </span>,
              ])}
            />
          </Card>

          <Card>
            <h3>Scoring breakdown</h3>
            <div style={{ marginTop: 10, fontSize: '0.83rem', color: 'var(--text-muted)' }}>
              {(['impact', 'likelihood', 'exposure'] as const).map((k) => (
                <div key={k} style={{ marginBottom: 12 }}>
                  <div className="mono" style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)' }}>
                    {k} = {risk.factors[k].value}
                  </div>
                  <ul style={{ margin: '5px 0 0', paddingLeft: 18 }}>
                    {risk.factors[k].drivers.map((d, i) => (
                      <li key={i} style={{ marginBottom: 2 }}>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

const SEV_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3 };

/**
 * Findings grouped by risk category rather than one flat list, so a reviewer can
 * route Privacy to the Privacy Office and Agentic AI Security to the security team
 * without reading every entry. Categories are ordered by their worst finding.
 */
function Findings({ r }: { r: AssessmentResult }) {
  const byCategory = new Map<string, typeof r.findings>();
  for (const f of r.findings) {
    const key = f.category || 'Other';
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(f);
  }

  const groups = [...byCategory.entries()]
    .map(([category, items]) => ({
      category,
      items: [...items].sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]),
      worst: Math.min(...items.map((i) => SEV_RANK[i.severity])),
    }))
    .sort((a, b) => a.worst - b.worst || b.items.length - a.items.length);

  return (
    <div className="grid" style={{ gap: 30 }}>
      {groups.map((g) => (
        <section key={g.category}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              paddingBottom: 9,
              marginBottom: 14,
              borderBottom: '1px solid var(--line)',
            }}
          >
            <h3 style={{ fontSize: '1.02rem' }}>{g.category}</h3>
            <Badge value={g.items[0].severity} />
            <span className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
              {g.items.length} finding{g.items.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="grid" style={{ gap: 14 }}>
            {g.items.map((f) => (
              <div className={`finding ${f.severity}`} key={f.id}>
                <h4>
                  {f.title}
                  <Badge value={f.severity} />
                  <span className="badge neutral">
                    {f.source === 'ai' ? 'AI analysis' : 'rule-derived'}
                  </span>
                </h4>
                <p style={{ margin: 0, fontSize: '0.91rem' }}>{f.finding}</p>
                {f.business_impact && (
                  <div className="blk">
                    <span className="lbl">Why it matters</span>
                    {f.business_impact}
                  </div>
                )}
                {f.recommendation && (
                  <div className="blk">
                    <span className="lbl">Recommendation</span>
                    {f.recommendation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Agentic({ r }: { r: AssessmentResult }) {
  return (
    <div className="grid c2" style={{ gap: 14 }}>
      {r.agentic_analysis.map((d) => (
        <Card key={d.dimension}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.98rem' }}>{d.dimension}</h3>
            <Badge value={d.status} />
          </div>
          <p style={{ margin: '10px 0 0', fontSize: '0.87rem', color: 'var(--text-muted)' }}>{d.observation}</p>
          {d.risk && (
            <p style={{ margin: '8px 0 0', fontSize: '0.87rem' }}>
              <span className="lbl" style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)' }}>
                Risk
              </span>
              {d.risk}
            </p>
          )}
          {d.recommendation && (
            <p style={{ margin: '8px 0 0', fontSize: '0.87rem', color: 'var(--text-muted)' }}>
              <span className="lbl" style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)' }}>
                Recommendation
              </span>
              {d.recommendation}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}

function ControlGaps({ r }: { r: AssessmentResult }) {
  return (
    <>
      <div className="statuslist">
        {r.control_gaps.map((c) => (
          <StatusRow
            key={c.control_id}
            status={c.status}
            label={`${c.control_id} · ${c.control}`}
            detail={c.reason}
            right={<Badge value={c.severity} />}
          />
        ))}
      </div>
      <p style={{ marginTop: 16, fontSize: '0.83rem', color: 'var(--text-dim)' }}>
        Control status is decided by rules over the intake, not by a language model. Every status above is
        reproducible from the same submission.
      </p>
    </>
  );
}

function EvidenceGaps({ r }: { r: AssessmentResult }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th style={{ width: 34 }} />
            <th>Evidence</th>
            <th style={{ width: 110 }}>Status</th>
            <th style={{ width: 110 }}>Risk</th>
            <th style={{ width: 190 }}>Owner</th>
          </tr>
        </thead>
        <tbody>
          {r.evidence_gaps.map((e) => (
            <tr key={e.evidence}>
              <td>
                <span className={`mark ${e.status}`} style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: e.status === 'MISSING' ? 'var(--critical)' : e.status === 'PARTIAL' ? 'var(--moderate)' : 'var(--low)' }}>
                  {e.status === 'MISSING' ? '✕' : e.status === 'PARTIAL' ? '⚠' : '✓'}
                </span>
              </td>
              <td>
                <strong style={{ fontWeight: 550 }}>{e.evidence}</strong>
                <div style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginTop: 3 }}>{e.why_required}</div>
              </td>
              <td>
                <Badge value={e.status} />
              </td>
              <td>
                <Badge value={e.risk} />
              </td>
              <td style={{ color: 'var(--text-muted)' }}>{e.owner}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Governance({ r }: { r: AssessmentResult }) {
  return (
    <>
      <div className="note warn" style={{ marginBottom: 18 }}>
        <strong>Illustrative mapping.</strong> These references show how each identified risk relates to
        published governance frameworks. They are not a certified crosswalk and do not constitute a claim of
        compliance with NIST AI RMF, ISO/IEC 42001 or any other standard. Framework references come from a
        fixed catalog in the workflow — never from the language model.
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: '26%' }}>Risk</th>
              <th style={{ width: '15%' }}>Governance area</th>
              <th style={{ width: '20%' }}>Framework reference</th>
              <th style={{ width: '21%' }}>Recommended control</th>
              <th style={{ width: '18%' }}>Required evidence</th>
            </tr>
          </thead>
          <tbody>
            {r.governance_mappings.map((g) => (
              <tr key={g.id}>
                <td>
                  {g.risk}
                  {g.rationale && (
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginTop: 5 }}>{g.rationale}</div>
                  )}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{g.governance_area}</td>
                <td className="mono" style={{ fontSize: '0.78rem', color: 'var(--accent)' }}>
                  {g.framework_reference}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{g.recommended_control}</td>
                <td style={{ color: 'var(--text-muted)' }}>{g.required_evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Remediation({ r }: { r: AssessmentResult }) {
  const groups = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
  return (
    <div className="grid" style={{ gap: 20 }}>
      {groups.map((p) => {
        const items = r.remediation_plan.filter((i) => i.priority === p);
        if (!items.length) return null;
        return (
          <div key={p}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Badge value={p} />
              <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                {items[0].sla}
              </span>
            </div>
            <div className="grid" style={{ gap: 10 }}>
              {items.map((i) => (
                <Card key={i.id} className="tight">
                  <p style={{ margin: 0, fontWeight: 550, fontSize: '0.92rem' }}>{i.action}</p>
                  <p style={{ margin: '7px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{i.rationale}</p>
                  <p style={{ margin: '9px 0 0', fontSize: '0.79rem', color: 'var(--text-dim)' }} className="mono">
                    owner: {i.owner}
                    {i.linked_controls.length ? ` · controls: ${i.linked_controls.join(', ')}` : ''}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Audit({ r }: { r: AssessmentResult }) {
  const a = r.audit_record;
  return (
    <div className="grid c2">
      <Card>
        <h3>Audit record</h3>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-dim)', margin: '6px 0 14px' }}>
          Written by the final n8n node. In production this is persisted to a GRC system of record rather
          than returned to the browser.
        </p>
        <KV
          items={[
            ['Assessment ID', <span className="mono">{a.assessment_id}</span>],
            ['Timestamp', <span className="mono">{new Date(a.timestamp).toISOString()}</span>],
            ['System', a.system],
            ['Engine version', <span className="mono">{a.engine_version}</span>],
            ['Schema version', <span className="mono">{a.schema_version}</span>],
            ['Input fingerprint', <span className="mono">{a.input_fingerprint}</span>],
            ['AI model', <span className="mono">{a.ai_model}</span>],
            ['Risk score', <span className="mono">{a.risk_score} / 64</span>],
            ['Risk band', <Badge value={a.risk_band} />],
            ['Control gaps', a.control_gap_count],
            ['Evidence missing', a.evidence_gap_count],
            ['Final status', <span className="mono">{a.final_status}</span>],
          ]}
        />
      </Card>
      <Card>
        <h3>Stages completed</h3>
        <div className="stagelog" style={{ marginTop: 12 }}>
          {a.stages_completed.map((s) => (
            <span className="done" key={s}>
              ✓ {s}
            </span>
          ))}
          {a.degraded_stages?.map((s) => (
            <span key={s} style={{ color: 'var(--moderate)' }}>
              ⚠ {s} — returned malformed output, deterministic content retained
            </span>
          ))}
        </div>
        <p style={{ marginTop: 18, marginBottom: 0, fontSize: '0.84rem', color: 'var(--text-dim)' }}>
          {r.disclaimer}
        </p>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ shell */

export default function Results({ result }: { result: AssessmentResult }) {
  const [tab, setTab] = useState<Tab>('Overview');

  const counts: Partial<Record<Tab, number>> = {
    Findings: result.findings.length,
    'Control gaps': result.control_gaps.filter((c) => c.status === 'GAP').length,
    'Evidence gaps': result.evidence_gaps.filter((e) => e.status === 'MISSING').length,
    Remediation: result.remediation_plan.length,
  };

  return (
    <div>
      <IdentityHeader r={result} />

      <div className="tabs" role="tablist" aria-label="Assessment sections">
        {TABS.map((t) => {
          if (t === 'Agentic analysis' && !result.system.is_agent) return null;
          return (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} type="button">
              {t}
              {counts[t] !== undefined && (
                <span className="mono" style={{ marginLeft: 6, fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  {counts[t]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'Overview' && <Overview r={result} />}
      {tab === 'Findings' && <Findings r={result} />}
      {tab === 'Agentic analysis' && <Agentic r={result} />}
      {tab === 'Control gaps' && <ControlGaps r={result} />}
      {tab === 'Evidence gaps' && <EvidenceGaps r={result} />}
      {tab === 'Governance mapping' && <Governance r={result} />}
      {tab === 'Remediation' && <Remediation r={result} />}
      {tab === 'Executive report' && <ExecutiveReport result={result} />}
      {tab === 'Audit record' && <Audit r={result} />}
    </div>
  );
}
