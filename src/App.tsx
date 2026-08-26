import { useRef, useState } from 'react';
import type { AssessmentInput, AssessmentResult } from './types';
import { EMPTY_INPUT } from './data/formSchema';
import scenarios from './data/scenarios.json';
import { N8nConfigError, N8nRequestError, isConfigured, runAssessment, webhookHost } from './services/n8nClient';

import Hero from './components/Hero';
import ProblemSection from './components/ProblemSection';
import ArchitectureSection from './components/ArchitectureSection';
import AssessmentForm from './components/AssessmentForm';
import Results from './components/Results';
import AssessmentProgress from './components/AssessmentProgress';
import ValueAndSecurity from './components/ValueAndSecurity';
import { Section } from './components/ui';

const NAV = [
  ['Problem', '#problem'],
  ['Architecture', '#architecture'],
  ['Live assessment', '#assess'],
  ['Business value', '#value'],
  ['Security', '#security'],
];

export default function App() {
  const [input, setInput] = useState<AssessmentInput>(() => scenarios[0].input as AssessmentInput);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; details?: string[] } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await runAssessment(input);
      setResult(r);
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (err) {
      if (err instanceof N8nRequestError) setError({ message: err.message, details: err.details });
      else if (err instanceof N8nConfigError) setError({ message: err.message });
      else setError({ message: (err as Error).message || 'Unexpected error.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="nav noprint">
        <div className="wrap">
          <span className="brand">AI Agent Risk Assessment Agent</span>
          <nav>
            {NAV.map(([label, href]) => (
              <a href={href} key={href}>
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <Hero />
      <ProblemSection />
      <ArchitectureSection />

      <Section
        id="assess"
        alt
        eyebrow="Live assessment"
        title="Run a real assessment"
        lede={
          <>
            This form posts to a self-hosted n8n instance and renders exactly what comes back. Nothing on the
            results screen is computed in the browser and no result is stored in this page — if the workflow is
            not running, there is nothing to show.
          </>
        }
      >
        {!isConfigured() && (
          <div className="note warn" style={{ marginBottom: 22 }}>
            <strong>n8n webhook not configured.</strong> Set <code>VITE_N8N_AI_RISK_WEBHOOK</code> in{' '}
            <code>.env</code> to your self-hosted n8n webhook URL, import{' '}
            <code>n8n/ai-agent-risk-assessment.workflow.json</code>, activate the workflow, and restart the dev
            server. See <code>docs/N8N_SETUP.md</code>.
          </div>
        )}

        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <AssessmentForm
            value={input}
            onChange={setInput}
            onSubmit={submit}
            onLoadScenario={(v) => {
              setInput(v);
              setResult(null);
              setError(null);
            }}
            onReset={() => {
              setInput(EMPTY_INPUT);
              setResult(null);
              setError(null);
            }}
            busy={busy}
          />
        </div>

        <div ref={resultsRef} style={{ scrollMarginTop: 76 }}>
          {(busy || result) && (
            <div style={{ marginTop: busy ? 0 : 34 }}>
              <AssessmentProgress running={busy} result={result} host={webhookHost()} />
            </div>
          )}

          {error && (
            <div className="note err" style={{ marginTop: 22 }}>
              <strong>Assessment did not complete.</strong>
              <p style={{ margin: '6px 0 0' }}>{error.message}</p>
              {error.details && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                  {error.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {result && (
            <div style={{ marginTop: 34 }}>
              <Results result={result} />
            </div>
          )}
        </div>
      </Section>

      <ValueAndSecurity />

      <footer className="foot noprint">
        <div className="wrap">
          <p style={{ margin: 0 }}>
            AI Agent Risk Assessment Agent — AI Governance &amp; GRC automation for agentic AI systems.
            Orchestrated by self-hosted n8n. Demo data is synthetic.
          </p>
          <p style={{ margin: '8px 0 0' }}>
            This tool supports human governance review. It does not replace it, and it does not certify
            compliance with any standard.
          </p>
        </div>
      </footer>
    </>
  );
}
