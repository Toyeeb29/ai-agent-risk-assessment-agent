import { webhookHost, isConfigured } from '../services/n8nClient';

const TECH = [
  'Self-Hosted n8n',
  'Agentic AI',
  'AI Governance',
  'GRC',
  'NIST AI RMF',
  'TPRM',
  'Risk Automation',
];

export default function Hero() {
  return (
    <div className="hero">
      <div className="wrap">
        <div className="eyebrow">AI Governance &amp; GRC Automation for Agentic AI Systems</div>
        <h1>AI Agent Risk Assessment Agent</h1>
        <p className="sub">Agentic AI for AI Governance, GRC &amp; Security Risk Assessment</p>
        <p className="lede">
          An AI-assisted risk assessment workflow that evaluates AI agents and AI systems, identifies
          governance and security risks, maps control requirements, identifies evidence gaps, and produces
          prioritised remediation guidance — with every risk score computed by deterministic rules rather
          than by a language model.
        </p>

        <div className="chiprow" style={{ marginTop: 26 }}>
          {TECH.map((t) => (
            <span className="badge accent" key={t}>
              {t}
            </span>
          ))}
        </div>

        <div className="chiprow" style={{ marginTop: 26, alignItems: 'center', gap: 14 }}>
          <a className="btn primary" href="#assess">
            Run a live assessment
          </a>
          <a className="btn" href="#architecture">
            How it works
          </a>
          <span className="mono" style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
            {isConfigured() ? `orchestration: ${webhookHost()}` : 'orchestration: n8n webhook not configured'}
          </span>
        </div>
      </div>
    </div>
  );
}
