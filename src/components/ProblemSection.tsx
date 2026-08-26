import { Card, Section } from './ui';

const TRADITIONAL = [
  'Questionnaire sent to the requesting team',
  'Responses copied into a spreadsheet',
  'Manual security review',
  'Manual framework mapping',
  'Evidence requested by email, chased for weeks',
  'Risk report written by hand',
];

const AUTOMATED = [
  'Structured AI assessment intake',
  'Self-hosted n8n receives and validates it',
  'AI risk analysis + agentic security analysis',
  'Governance mapping from a fixed control catalog',
  'Control and evidence gaps derived by rule',
  'Deterministic risk engine scores it',
  'Prioritised remediation + executive report',
];

function Column({
  title,
  tone,
  time,
  steps,
  foot,
}: {
  title: string;
  tone: string;
  time: string;
  steps: string[];
  foot: string;
}) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h3 style={{ color: tone }}>{title}</h3>
        <span className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
          {time}
        </span>
      </div>
      <ol style={{ margin: '16px 0 0', paddingLeft: 0, listStyle: 'none' }}>
        {steps.map((s, i) => (
          <li key={s} style={{ display: 'flex', gap: 11, padding: '7px 0', fontSize: '0.89rem' }}>
            <span className="mono" style={{ color: 'var(--text-dim)', fontSize: '0.72rem', paddingTop: 3 }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <p style={{ marginTop: 16, marginBottom: 0, fontSize: '0.85rem', color: 'var(--text-dim)' }}>{foot}</p>
    </Card>
  );
}

export default function ProblemSection() {
  return (
    <Section
      id="problem"
      alt
      eyebrow="The problem"
      title="Every AI system arrives with the same four questions"
      lede={
        <>
          Organisations are adopting generative AI, assistants, agents, AI-powered SaaS and autonomous
          workflows faster than governance functions can assess them. For each one, a GRC analyst has to
          answer: <em>what could go wrong, what controls should exist, what evidence do we need, and does this
          need human governance review before approval?</em> The first pass through those questions is
          repetitive, judgement-light and slow — which is exactly the work worth automating.
        </>
      }
    >
      <div className="grid c2">
        <Column
          title="Traditional first-pass assessment"
          tone="var(--high)"
          time="days to weeks"
          steps={TRADITIONAL}
          foot="Inconsistent between analysts, hard to audit, and the framework mapping is redone from scratch every time."
        />
        <Column
          title="Automated first-pass assessment"
          tone="var(--accent)"
          time="under two minutes"
          steps={AUTOMATED}
          foot="Consistent, reproducible, and every score traceable to a published rule. The approval decision still belongs to a person."
        />
      </div>

      <div className="note" style={{ marginTop: 26 }}>
        <strong>What this does not do.</strong> It does not approve AI systems, replace a security review, or
        certify compliance with any standard. It produces a consistent, evidence-aware first pass so that
        human reviewers spend their time on judgement instead of transcription.
      </div>
    </Section>
  );
}
