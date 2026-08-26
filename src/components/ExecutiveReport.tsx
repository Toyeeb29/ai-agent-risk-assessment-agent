import type { AssessmentResult } from '../types';
import { Badge, BAND_COLOR } from './ui';
import { downloadMarkdown } from '../lib/report';

export default function ExecutiveReport({ result: r }: { result: AssessmentResult }) {
  const e = r.executive_summary;

  return (
    <>
      <div className="chiprow noprint" style={{ marginBottom: 18 }}>
        <button className="btn small" type="button" onClick={() => downloadMarkdown(r)}>
          Download report (.md)
        </button>
        <button className="btn small" type="button" onClick={() => window.print()}>
          Print / save as PDF
        </button>
      </div>

      <div className="report">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem' }}>AI System Risk Assessment</h2>
            <p style={{ color: 'var(--text-muted)', margin: '6px 0 0' }}>{r.system.name}</p>
            <p className="mono" style={{ color: 'var(--text-dim)', fontSize: '0.78rem', margin: '4px 0 0' }}>
              {r.assessment_id} · {new Date(r.generated_at).toUTCString()}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ fontSize: '0.7rem', letterSpacing: '0.12em', color: 'var(--text-dim)' }}>
              OVERALL RISK
            </div>
            <div style={{ fontSize: '1.7rem', fontWeight: 700, color: BAND_COLOR[e.overall_risk], fontFamily: 'var(--mono)' }}>
              {e.overall_risk}
            </div>
            <div className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              {r.risk.score} / {r.risk.max_score}
            </div>
          </div>
        </div>

        <h3>1 · Executive summary</h3>
        <p style={{ color: 'var(--text-muted)' }}>{e.business_narrative}</p>

        <h3>2 · Overall risk</h3>
        <p style={{ margin: 0 }}>
          <strong style={{ color: BAND_COLOR[e.overall_risk] }}>{e.overall_risk}</strong> — {r.risk.score} of{' '}
          {r.risk.max_score} (Impact {r.risk.factors.impact.value} × Likelihood {r.risk.factors.likelihood.value}{' '}
          × Exposure {r.risk.factors.exposure.value})
        </p>
        <p style={{ marginTop: 10 }}>
          <Badge value={e.recommended_decision} />{' '}
          {e.human_review_required && <Badge value="HIGH">human governance review required</Badge>}
        </p>

        <h3>3 · Key findings</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
          <strong>Primary risk.</strong> {e.primary_risk}
        </p>
        <ol style={{ color: 'var(--text-muted)' }}>
          {e.top_risks.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>

        <h3>4 · Business impact</h3>
        <ul style={{ color: 'var(--text-muted)' }}>
          {r.risk.domains
            .filter((d) => d.band === 'HIGH' || d.band === 'CRITICAL')
            .map((d) => (
              <li key={d.domain}>
                <strong>{d.domain}</strong> ({d.band}) — {d.drivers.slice(0, 2).join('; ')}
              </li>
            ))}
          {!r.risk.domains.some((d) => d.band === 'HIGH' || d.band === 'CRITICAL') && (
            <li>No domain scored above MODERATE.</li>
          )}
        </ul>

        <h3>5 · Control gaps</h3>
        <ul style={{ color: 'var(--text-muted)' }}>
          {r.control_gaps
            .filter((c) => c.status !== 'PRESENT')
            .map((c) => (
              <li key={c.control_id}>
                <strong>{c.control}</strong> — {c.status} ({c.severity}). {c.reason}
              </li>
            ))}
        </ul>

        <h3>6 · Evidence gaps</h3>
        <ul style={{ color: 'var(--text-muted)' }}>
          {r.evidence_gaps
            .filter((x) => x.status !== 'PROVIDED')
            .map((x) => (
              <li key={x.evidence}>
                <strong>{x.evidence}</strong> — {x.status}, {x.risk} risk. Owner: {x.owner}
              </li>
            ))}
        </ul>

        <h3>7 · Recommended actions</h3>
        {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => {
          const items = r.remediation_plan.filter((i) => i.priority === p);
          if (!items.length) return null;
          return (
            <div key={p} style={{ marginBottom: 12 }}>
              <p style={{ margin: '0 0 4px' }}>
                <Badge value={p} /> <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{items[0].sla}</span>
              </p>
              <ul style={{ color: 'var(--text-muted)' }}>
                {items.map((i) => (
                  <li key={i.id}>{i.action}</li>
                ))}
              </ul>
            </div>
          );
        })}

        <h3>8 · Governance mapping</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          Illustrative mapping — not a certified crosswalk, and not a claim of compliance with any standard.
        </p>
        <ul style={{ color: 'var(--text-muted)' }}>
          {r.governance_mappings.slice(0, 8).map((g) => (
            <li key={g.id}>
              <strong>{g.governance_area}</strong> — {g.recommended_control}{' '}
              <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--accent)' }}>
                ({g.framework_reference})
              </span>
              . Evidence: {g.required_evidence}.
            </li>
          ))}
        </ul>

        {r.tprm && (
          <>
            <h3>8b · Third-party risk</h3>
            <p style={{ margin: 0 }}>
              <strong>{r.tprm.vendor}</strong> — <Badge value={r.tprm.vendor_risk_band} />
            </p>
            {r.tprm.recommended_questions.length > 0 && (
              <>
                <p style={{ margin: '10px 0 4px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                  Questions to send the vendor:
                </p>
                <ul style={{ color: 'var(--text-muted)' }}>
                  {r.tprm.recommended_questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        <h3>9 · Assessment metadata</h3>
        <p className="mono" style={{ fontSize: '0.79rem', color: 'var(--text-dim)', lineHeight: 1.9, marginBottom: 0 }}>
          assessment_id: {r.audit_record.assessment_id}
          <br />
          engine_version: {r.audit_record.engine_version} · schema_version: {r.audit_record.schema_version}
          <br />
          input_fingerprint: {r.audit_record.input_fingerprint}
          <br />
          ai_model: {r.audit_record.ai_model}
          <br />
          stages_completed: {r.audit_record.stages_completed.length}
          <br />
          final_status: {r.audit_record.final_status}
        </p>

        <p style={{ marginTop: 24, marginBottom: 0, fontSize: '0.82rem', color: 'var(--text-dim)', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          {r.disclaimer}
        </p>
      </div>
    </>
  );
}
