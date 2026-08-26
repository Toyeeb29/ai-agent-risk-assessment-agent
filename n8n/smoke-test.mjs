/**
 * Posts a synthetic scenario to your self-hosted n8n webhook and prints a summary.
 *
 *   node n8n/smoke-test.mjs <webhook-url> [scenario-id]
 *   node n8n/smoke-test.mjs <webhook-url> [scenario-id] --compare
 *   npm run smoke -- <webhook-url> [scenario-id]
 *
 * --compare runs the SAME assessment twice against the live workflow and prints the
 * two results side by side. The LLM stages are non-deterministic, so the finding count
 * usually differs between runs. The risk score cannot differ, because no model output
 * reaches it. That contrast is the project's central claim, demonstrated rather than
 * asserted - and it needs no shell piping, which Git Bash on Windows handles badly.
 *
 * Why this exists instead of a curl command: pasting multi-line JSON into a shell
 * is the single most common way to "break" this workflow that has nothing to do
 * with the workflow. Git Bash on Windows, PowerShell and cmd.exe each mangle
 * quotes and line continuations differently. This script builds the payload in
 * Node, so the shell never touches the JSON.
 *
 * Zero dependencies and no install required - it uses only Node 18+ built-ins.
 *
 * Scenario IDs: support-agent (default) | internal-assistant | devops-agent
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const scenarios = JSON.parse(readFileSync(join(HERE, '..', 'src/data/scenarios.json'), 'utf8'));

const argv = process.argv.slice(2);
const COMPARE = argv.includes('--compare');
const positional = argv.filter((a) => !a.startsWith('--'));
const url = positional[0];
const scenarioId = positional[1] || 'support-agent';

if (!url) {
  console.error('\nUsage: node n8n/smoke-test.mjs <webhook-url> [scenario-id] [--compare]\n');
  console.error('  scenario-id: ' + scenarios.map((s) => s.id).join(' | '));
  console.error('\nExample:');
  console.error('  node n8n/smoke-test.mjs http://localhost:5678/webhook-test/ai-risk-assessment\n');
  process.exit(1);
}

const scenario = scenarios.find((s) => s.id === scenarioId);
if (!scenario) {
  console.error(`\nUnknown scenario "${scenarioId}". Available: ${scenarios.map((s) => s.id).join(', ')}\n`);
  process.exit(1);
}

const isTestUrl = url.includes('/webhook-test/');

/* -------------------------------------------------------------- one request */

/** Posts the scenario once and returns { body, elapsed }. Exits on failure. */
async function runOnce(label) {
  if (label) console.log(`\n  ${label}`);
  const started = Date.now();

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario.input),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (err) {
    console.error(`  Could not reach n8n: ${err.message}`);
    console.error('  Check that n8n is running and the URL host/port are correct.\n');
    process.exit(1);
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const text = await res.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    console.error(`  HTTP ${res.status} - response was not JSON:\n`);
    console.error(text.slice(0, 600));
    process.exit(1);
  }

  if (res.status === 404 && /not registered/i.test(body.message || '')) {
    console.error('  HTTP 404 - the test webhook is not listening.\n');
    console.error('  Fix: on the n8n canvas click "Execute workflow" (bottom centre),');
    console.error('  wait for "Waiting for trigger event", then run this command again.');
    console.error('  A test webhook accepts ONE request per click.\n');
    process.exit(1);
  }

  if (!res.ok) {
    console.error(`  HTTP ${res.status}: ${body.error || body.message || 'request failed'}`);
    if (Array.isArray(body.details)) body.details.forEach((d) => console.error(`    - ${d}`));
    console.error('');
    process.exit(1);
  }

  if (!body.risk || !body.assessment_id) {
    console.error('  n8n responded, but the payload is not an AssessmentResult.');
    console.error('  Check the output of the "Assemble Final Assessment" node.\n');
    console.error(JSON.stringify(body, null, 2).slice(0, 800));
    process.exit(1);
  }

  return { body, elapsed };
}

/* ---------------------------------------------------------- compare mode */

if (COMPARE) {
  console.log(`\n  DETERMINISM CHECK`);
  console.log(`  ${scenario.label}`);
  console.log(`  Two live runs of the same input against ${url}`);
  console.log('\n  This takes 2-3 minutes - each run is a full pass through the workflow.');

  const a = await runOnce('Run 1 of 2 - submitting...');
  const b = await runOnce('Run 2 of 2 - submitting...');

  const fmt = (v) => String(v).padStart(9);
  const row = (label, x, y) => console.log(`  ${label.padEnd(22)}${fmt(x)}${fmt(y)}`);

  console.log('\n  ' + '-'.repeat(42));
  console.log(`  ${''.padEnd(22)}${fmt('Run 1')}${fmt('Run 2')}`);
  console.log('  ' + '-'.repeat(42));
  row('Findings (by model)', a.body.findings.length, b.body.findings.length);
  row('Risk score', `${a.body.risk.score}/64`, `${b.body.risk.score}/64`);
  row('Band', a.body.risk.band, b.body.risk.band);
  row(
    'I x L x E',
    `${a.body.risk.factors.impact.value}x${a.body.risk.factors.likelihood.value}x${a.body.risk.factors.exposure.value}`,
    `${b.body.risk.factors.impact.value}x${b.body.risk.factors.likelihood.value}x${b.body.risk.factors.exposure.value}`
  );
  row(
    'Control gaps',
    a.body.control_gaps.filter((c) => c.status === 'GAP').length,
    b.body.control_gaps.filter((c) => c.status === 'GAP').length
  );
  console.log('  ' + '-'.repeat(42));

  const scoreStable = a.body.risk.score === b.body.risk.score && a.body.risk.band === b.body.risk.band;
  const modelVaried = a.body.findings.length !== b.body.findings.length;

  console.log('');
  if (scoreStable) {
    console.log('  Risk score identical across both runs.');
    console.log(
      modelVaried
        ? '  Model output differed. The score did not, because no model output reaches it.'
        : '  Model output happened to match this time; run again to see it vary.'
    );
  } else {
    console.log('  SCORE DIFFERED BETWEEN RUNS - this should be impossible.');
    console.log('  Check that no LLM node feeds the Deterministic Risk Engine.');
  }
  console.log(`\n  Assessment IDs: ${a.body.assessment_id} / ${b.body.assessment_id}\n`);
  process.exit(scoreStable ? 0 : 1);
}

/* ----------------------------------------------------------- single report */

console.log(`\n  POST   ${url}`);
console.log(`  Case   ${scenario.label}`);
if (isTestUrl) {
  console.log('  Note   Test URL detected - the workflow must be listening.');
  console.log('         Click "Execute workflow" on the n8n canvas first, then re-run this.');
}
console.log('\n  Waiting for n8n (the workflow runs 5-6 sequential LLM calls)...');

const { body, elapsed } = await runOnce();

const r = body.risk;
const gaps = body.control_gaps.filter((c) => c.status === 'GAP').length;
const missing = body.evidence_gaps.filter((e) => e.status === 'MISSING').length;

console.log(`\n  ASSESSMENT COMPLETE in ${elapsed}s\n`);
console.log(`  ${body.system.name}`);
console.log(`  ${body.assessment_id}\n`);
console.log(`  Risk score        ${r.score} / ${r.max_score}   ${r.band}`);
console.log(`  Calculation       Impact ${r.factors.impact.value} x Likelihood ${r.factors.likelihood.value} x Exposure ${r.factors.exposure.value}`);
console.log(`  Decision          ${body.executive_summary.recommended_decision.replace(/_/g, ' ')}`);
console.log(`  Control gaps      ${gaps}`);
console.log(`  Evidence missing  ${missing}`);
console.log(`  Findings          ${body.findings.length}`);
console.log(`  Remediation       ${body.remediation_plan.length} actions`);
console.log(`  TPRM branch       ${body.tprm ? 'ran (' + body.tprm.vendor_risk_band + ')' : 'skipped (internal system)'}`);
console.log('\n  Domains');
r.domains.forEach((d) => console.log(`    ${d.domain.padEnd(14)} ${String(d.score).padStart(3)}/100  ${d.band}`));

const degraded = body.audit_record.degraded_stages || [];
const LLM_STAGES = [
  'AI Risk Analyst',
  'Agentic AI Security Analyst',
  'Governance Mapping Agent',
  'TPRM Vendor Analyst',
  'Remediation Narrative Agent',
  'Executive Summary Agent',
];
const done = body.audit_record.stages_completed;
const llmDone = done.filter((s) => LLM_STAGES.includes(s)).length;
console.log(`\n  Stages completed  ${done.length}  (${llmDone} LLM, ${done.length - llmDone} deterministic)`);
if (degraded.length) {
  console.log(`  Degraded stages   ${degraded.join(', ')}`);
  console.log('                    (assessment completed on deterministic content -');
  console.log('                     check "Output Content as JSON" on those nodes)');
}

if (scenarioId === 'support-agent') {
  const expected = r.score === 36 && r.band === 'HIGH';
  console.log(`\n  Expected 36/64 HIGH for this scenario: ${expected ? 'MATCH - engine is correct' : `MISMATCH - got ${r.score}/${r.band}`}`);
}

console.log('\n  Full JSON written to: n8n/last-response.json\n');

const { writeFileSync } = await import('node:fs');
writeFileSync(join(HERE, 'last-response.json'), JSON.stringify(body, null, 2) + '\n');
