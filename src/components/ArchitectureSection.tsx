import { Card, Pipeline, Section } from './ui';
import { webhookHost, isConfigured } from '../services/n8nClient';

const STEPS: { label: string; kind: 'ai' | 'det' | 'io' }[] = [
  { label: 'Assessment input (portfolio form)', kind: 'io' },
  { label: 'n8n webhook', kind: 'io' },
  { label: 'Input validation & normalisation', kind: 'det' },
  { label: 'AI risk analysis (7 domains)', kind: 'ai' },
  { label: 'Agentic AI security analysis (11 dimensions)', kind: 'ai' },
  { label: 'Control gap analysis (13-control catalog)', kind: 'det' },
  { label: 'Evidence gap analysis', kind: 'det' },
  { label: 'Governance mapping (rationale only)', kind: 'ai' },
  { label: 'Deterministic risk scoring', kind: 'det' },
  { label: 'Risk prioritisation & SLA assignment', kind: 'det' },
  { label: 'TPRM vendor branch (conditional)', kind: 'ai' },
  { label: 'Remediation narrative', kind: 'ai' },
  { label: 'Executive summary', kind: 'ai' },
  { label: 'Assembly + audit record', kind: 'det' },
];

function Diagram() {
  const box = (x: number, y: number, w: number, h: number, label: string, sub: string, color: string) => (
    <g key={label}>
      <rect x={x} y={y} width={w} height={h} rx="8" fill="#0f172a" stroke={color} strokeWidth="1.5" />
      <text x={x + w / 2} y={y + h / 2 - 4} textAnchor="middle" fill="#e6edf7" fontSize="12.5" fontWeight="600">
        {label}
      </text>
      <text x={x + w / 2} y={y + h / 2 + 13} textAnchor="middle" fill="#64748b" fontSize="10.5" fontFamily="ui-monospace, monospace">
        {sub}
      </text>
    </g>
  );

  const arrow = (x1: number, y1: number, x2: number, y2: number) => (
    <line key={`${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#334155" strokeWidth="1.5" markerEnd="url(#ah)" />
  );

  return (
    <svg viewBox="0 0 760 470" style={{ width: '100%', height: 'auto' }} role="img" aria-label="System architecture">
      <defs>
        <marker id="ah" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L7,3 L0,6 z" fill="#334155" />
        </marker>
      </defs>

      {box(290, 10, 180, 44, 'GRC analyst', 'browser', '#334155')}
      {arrow(380, 54, 380, 74)}
      {box(270, 76, 220, 46, 'Portfolio UI', 'React + Vite (static)', '#38bdf8')}
      {arrow(380, 122, 380, 146)}

      <text x={392} y={140} fill="#64748b" fontSize="10" fontFamily="ui-monospace, monospace">
        HTTPS POST · CORS-restricted · no credentials
      </text>

      {box(240, 148, 280, 52, 'SELF-HOSTED n8n', 'webhook → 17-node workflow', '#38bdf8')}

      {arrow(330, 200, 210, 232)}
      {arrow(430, 200, 550, 232)}

      {box(60, 234, 300, 70, 'AI analysis', 'risk · agentic security · TPRM · narrative', '#38bdf8')}
      {box(400, 234, 300, 70, 'Deterministic logic', 'control gaps · evidence · scoring · SLA', '#34d399')}

      <text x={210} y={322} textAnchor="middle" fill="#64748b" fontSize="10.5" fontFamily="ui-monospace, monospace">
        wording &amp; judgement
      </text>
      <text x={550} y={322} textAnchor="middle" fill="#64748b" fontSize="10.5" fontFamily="ui-monospace, monospace">
        every number &amp; status
      </text>

      {arrow(210, 330, 355, 356)}
      {arrow(550, 330, 405, 356)}

      {box(270, 358, 220, 46, 'Final assessment', 'AssessmentResult JSON', '#38bdf8')}
      {arrow(380, 404, 380, 424)}
      {box(270, 426, 220, 40, 'Audit record', 'ID · fingerprint · stages · status', '#334155')}
    </svg>
  );
}

export default function ArchitectureSection() {
  return (
    <Section
      id="architecture"
      eyebrow="Architecture"
      title="Self-hosted n8n is the orchestration layer"
      lede={
        <>
          The portfolio is a static frontend. It holds no logic, no scoring, no keys and no cached results — it
          serialises the intake, POSTs it to a webhook on a self-hosted n8n instance
          {isConfigured() ? ` (${webhookHost()})` : ''}, and renders the JSON that comes back. Every number on
          the results screen was computed inside n8n.
        </>
      }
    >
      <Card>
        <Diagram />
      </Card>

      <div className="grid c2" style={{ marginTop: 22 }}>
        <Card>
          <h3>Workflow stages</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 6 }}>
            Fourteen stages across seventeen n8n nodes. The colour of each stage is the point of the whole
            design.
          </p>
          <div style={{ marginTop: 16 }}>
            <Pipeline steps={STEPS} />
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card>
            <h3 style={{ color: 'var(--low)' }}>What the rules decide</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 8 }}>
              The risk score, the risk band, every control status, every evidence status, every severity,
              every remediation priority and SLA, and whether the assessment must go to human governance
              review. All of it from published rules over the normalised intake.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 0 }}>
              The same submission always produces the same score. That is what makes the output defensible in
              a review meeting — and testable: <code>npm run engine:test</code> runs the scoring engine
              outside n8n and asserts it.
            </p>
          </Card>

          <Card>
            <h3 style={{ color: 'var(--accent)' }}>What the LLM decides</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 8 }}>
              Analysis and language. What could go wrong and why, how an agent's authority could be misused,
              how to phrase a remediation instruction, how to translate a technical position into business
              risk.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 0 }}>
              Notably, the LLM never emits a framework citation. Control IDs and framework references come
              from a fixed catalog; the model writes only the rationale. A hallucinated control reference in a
              GRC artefact is indistinguishable from a real one to the person reading it.
            </p>
          </Card>
        </div>
      </div>
    </Section>
  );
}
