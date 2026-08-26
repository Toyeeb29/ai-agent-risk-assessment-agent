import { Card, Section } from './ui';

const VALUE = [
  {
    who: 'GRC team',
    points: [
      'Removes the repetitive first pass — transcription, framework lookup, evidence listing',
      'Standardises how AI risk is analysed across requesting teams',
      'Produces the evidence request list automatically, with named owners',
      'Two analysts assessing the same system get the same score',
    ],
  },
  {
    who: 'Security team',
    points: [
      'Surfaces excessive agent privileges against the stated business purpose',
      'Highlights tool authorization risk and missing permission boundaries',
      'Identifies monitoring and auditability gaps specific to agent behaviour',
      'Names the agentic attack surface: injection, tool abuse, excessive agency',
    ],
  },
  {
    who: 'Leadership',
    points: [
      'Converts technical AI risk into business language on one page',
      'Gives a prioritised remediation plan with owners and time-bound SLAs',
      'Improves visibility into what AI is actually being adopted, and how fast',
      'Creates an auditable record of what was assessed and when',
    ],
  },
];

const SECURITY = [
  ['Transport', 'All traffic to the self-hosted n8n webhook is HTTPS. The webhook enforces an origin allowlist rather than accepting requests from anywhere.'],
  ['No secrets in the frontend', 'Anything prefixed VITE_ is compiled into the public bundle. The only value the frontend holds is the webhook URL. No API key, model credential or n8n credential is ever shipped to the browser.'],
  ['Credential handling', 'The LLM provider credential exists only inside n8n, referenced by credential ID. It is never in the workflow JSON, the repository, or the browser.'],
  ['Input validation', 'The first node after the webhook validates required fields, coerces every enum to a known value, strips control characters and clamps numbers. Malformed submissions are rejected with HTTP 400 before a single token is spent.'],
  ['Prompt injection handling', 'Every prompt states that the intake is untrusted data, not instruction. Out-of-enum values fall back to safe defaults rather than reaching the model, and a submission containing directive text is reported as a finding rather than obeyed.'],
  ['Output validation', 'LLM output is parsed defensively. A model can never raise a severity more than one band above the deterministic overall band, and can never emit a control ID or framework reference — those come from a fixed catalog.'],
  ['Least privilege', 'The workflow reads nothing and writes nothing outside itself. It has no database credential, no cloud role and no mailbox.'],
  ['Synthetic demo data', 'The public demo ships fictional systems only. No real vendor, customer or employee data appears anywhere in this repository.'],
  ['Audit logging', 'Every run produces an assessment ID, timestamp, input fingerprint, engine version and completed-stage list. n8n execution history provides the second record.'],
  ['Rate limiting', 'The webhook is intended to sit behind a reverse proxy with rate limiting, since each request triggers several paid LLM calls. Guidance is in docs/SECURITY.md.'],
];

const LIMITATIONS = [
  'This is a first-pass assessment tool. It does not approve AI systems and does not replace a security review, a penetration test, or a privacy assessment.',
  'It assesses what the requesting team declares at intake. It does not verify any claim against a live system — that is precisely why it produces an evidence request list.',
  'Framework mappings are illustrative. They are not a certified crosswalk and carry no claim of compliance with NIST AI RMF, ISO/IEC 42001, or any other standard.',
  'The scoring model is a defensible starting point, not an industry standard. Weights and thresholds are published so an organisation can argue with them and tune them.',
  'The LLM stages are non-deterministic. Their wording varies between runs; the score does not.',
];

export default function ValueAndSecurity() {
  return (
    <>
      <Section
        id="value"
        alt
        eyebrow="Business value"
        title="What this actually changes"
        lede="No invented ROI figures. The value is consistency, coverage and the removal of transcription work — not a percentage on a slide."
      >
        <div className="grid c3">
          {VALUE.map((v) => (
            <Card key={v.who}>
              <h3>{v.who}</h3>
              <ul style={{ margin: '12px 0 0', paddingLeft: 18, color: 'var(--text-muted)', fontSize: '0.89rem' }}>
                {v.points.map((p) => (
                  <li key={p} style={{ marginBottom: 7 }}>
                    {p}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        id="security"
        eyebrow="Security architecture"
        title="A tool that assesses AI security should survive its own assessment"
        lede="The controls below are the ones this workflow would be asked about if it were submitted through its own intake form."
      >
        <div className="grid c2">
          {SECURITY.map(([title, body]) => (
            <Card key={title} className="tight">
              <h3 style={{ fontSize: '0.95rem', color: 'var(--accent)' }}>{title}</h3>
              <p style={{ margin: '7px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>{body}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        id="limitations"
        alt
        eyebrow="Limitations"
        title="What this does not claim"
        lede="Stating the boundaries is part of the deliverable. An assessment tool that overstates its own authority is itself a governance risk."
      >
        <Card>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-muted)' }}>
            {LIMITATIONS.map((l) => (
              <li key={l} style={{ marginBottom: 10 }}>
                {l}
              </li>
            ))}
          </ul>
        </Card>
      </Section>
    </>
  );
}
