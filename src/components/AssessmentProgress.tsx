import { useEffect, useState } from 'react';
import type { AssessmentResult } from '../types';
import { Card } from './ui';

/**
 * Honest progress for a workflow that reports once.
 *
 * The n8n webhook uses responseMode: responseNode, so the workflow returns a
 * single response when the whole run finishes. There is no event stream, and
 * polling n8n's executions API would require an API key in the browser — which
 * would put a credential in a public bundle.
 *
 * So this component never claims a stage finished before it did. While the
 * request is in flight every stage reads WAITING. When the response arrives,
 * each stage is resolved from `audit_record.stages_completed` and
 * `degraded_stages` — the workflow's own account of what actually ran.
 */

interface Stage {
  /** Must match the n8n node name exactly - that is what the audit record reports. */
  node: string;
  label: string;
  kind: 'llm' | 'rules';
  /** Only runs when the assessed system depends on a third party. */
  conditional?: boolean;
}

const STAGES: Stage[] = [
  { node: 'AI Risk Analyst', label: 'AI risk analysis', kind: 'llm' },
  { node: 'Agentic AI Security Analyst', label: 'Agentic risk analysis', kind: 'llm' },
  { node: 'Control Gap Analysis', label: 'Control analysis', kind: 'rules' },
  { node: 'Evidence Gap Analysis', label: 'Evidence analysis', kind: 'rules' },
  { node: 'Governance Mapping Agent', label: 'Governance mapping', kind: 'llm' },
  { node: 'Deterministic Risk Engine', label: 'Deterministic risk scoring', kind: 'rules' },
  { node: 'Risk Prioritization', label: 'Prioritisation and SLAs', kind: 'rules' },
  { node: 'TPRM Vendor Analyst', label: 'Third-party risk analysis', kind: 'llm', conditional: true },
  { node: 'Remediation Narrative Agent', label: 'Remediation plan', kind: 'llm' },
  { node: 'Executive Summary Agent', label: 'Executive summary', kind: 'llm' },
];

type StageState = 'waiting' | 'done' | 'degraded' | 'skipped';

const MARK: Record<StageState, string> = {
  waiting: '·',
  done: '✓',
  degraded: '!',
  skipped: '–',
};

const STATE_LABEL: Record<StageState, string> = {
  waiting: 'Waiting',
  done: 'Completed',
  degraded: 'Degraded',
  skipped: 'Not run',
};

function Elapsed() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setS((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="mono" aria-label={`${s} seconds elapsed`}>
      {String(Math.floor(s / 60)).padStart(2, '0')}:{String(s % 60).padStart(2, '0')}
    </span>
  );
}

export default function AssessmentProgress({
  running,
  result,
  host,
}: {
  running: boolean;
  result: AssessmentResult | null;
  host: string;
}) {
  const completed = result?.audit_record.stages_completed ?? [];
  const degraded = result?.audit_record.degraded_stages ?? [];

  const stateOf = (stage: Stage): StageState => {
    if (running || !result) return 'waiting';
    if (degraded.includes(stage.node)) return 'degraded';
    if (completed.includes(stage.node)) return 'done';
    return 'skipped';
  };

  const doneCount = STAGES.filter((s) => stateOf(s) === 'done').length;

  return (
    <Card>
      <div className="prog-head">
        <div>
          <h3 style={{ fontSize: '1rem' }}>Workflow stages</h3>
          <p className="prog-sub">
            {running ? (
              <>
                Submitted to <span className="mono">{host}</span>. The workflow reports once, when the
                whole run completes — so nothing below is marked done until n8n says it is.
              </>
            ) : result ? (
              <>
                Resolved from the assessment's own audit record — {doneCount} stage
                {doneCount === 1 ? '' : 's'} completed.
              </>
            ) : (
              <>The ten stages this assessment runs on self-hosted n8n.</>
            )}
          </p>
        </div>
        {running && (
          <span className="prog-timer">
            <span className="spinner" aria-hidden="true" /> <Elapsed />
          </span>
        )}
      </div>

      <ol className="prog-list">
        {STAGES.map((stage) => {
          const st = stateOf(stage);
          return (
            <li key={stage.node} className={`prog-row ${st}`}>
              <span className="prog-mark" aria-hidden="true">
                {MARK[st]}
              </span>
              <span className="prog-label">
                {stage.label}
                {stage.conditional && st === 'skipped' && (
                  <span className="prog-note"> — no third-party dependency in scope</span>
                )}
                {st === 'degraded' && (
                  <span className="prog-note"> — malformed output, deterministic content retained</span>
                )}
              </span>
              <span className={`prog-kind ${stage.kind}`}>{stage.kind === 'llm' ? 'LLM' : 'RULES'}</span>
              <span className="prog-state">{STATE_LABEL[st]}</span>
            </li>
          );
        })}
      </ol>

      {running && (
        <p className="prog-foot">
          Five to six sequential model calls plus the deterministic engine. Typically 30–90 seconds.
        </p>
      )}
    </Card>
  );
}
