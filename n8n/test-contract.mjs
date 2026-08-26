/**
 * Contract test for the workflow's final output.
 *
 *   npm run contract:test
 *
 * Runs the full node chain locally - deterministic Code nodes for real, LLM
 * stages replaced by fixed stubs - and asserts that "Assemble Final Assessment"
 * produces a payload matching the AssessmentResult contract in src/types.ts.
 *
 * Two things this catches that the engine test does not:
 *   1. drift between the assembly node and the TypeScript contract the UI renders
 *   2. whether the assessment still completes when an LLM stage returns garbage
 *
 * The stubs are deliberately minimal and are NOT shipped to the frontend. They
 * exist so the contract can be tested without spending tokens; the application
 * itself has no canned results anywhere.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const scenario = JSON.parse(readFileSync(join(ROOT, 'src/data/scenarios.json'), 'utf8'))[0];

function runCodeNode(file, inputItems, nodeOutputs) {
  const src = readFileSync(join(HERE, 'code', file), 'utf8');
  const $input = { first: () => inputItems[0], all: () => inputItems, last: () => inputItems.at(-1) };
  const $ = (name) => {
    if (!(name in nodeOutputs)) throw new Error(`Referenced node is unexecuted: "${name}"`);
    return { first: () => ({ json: nodeOutputs[name] }), all: () => [{ json: nodeOutputs[name] }] };
  };
  return new Function('$input', '$', '$env', src)($input, $, {})[0].json;
}

/** Shape of an OpenAI node result when jsonOutput is enabled. */
const wrap = (content) => ({ message: { content } });

function buildStubs(malformed = false) {
  if (malformed) {
    return {
      'AI Risk Analyst': wrap('not json at all'),
      'Agentic AI Security Analyst': wrap({ unexpected: true }),
      'Governance Mapping Agent': wrap(null),
      'Remediation Narrative Agent': wrap('{ broken'),
      'Executive Summary Agent': wrap(undefined),
    };
  }
  return {
    'AI Risk Analyst': wrap({
      risk_factors: [
        {
          title: 'Customer personal data processed by an external provider under unestablished terms',
          category: 'Privacy',
          severity: 'HIGH',
          finding: 'The agent submits customer account records and billing history to a third-party platform whose training and retention terms are recorded as unknown at intake.',
          business_impact: 'Customer data may be retained or reused outside the organisation with no contractual limit.',
          recommendation: 'Obtain and record the provider data-use terms before approval.',
        },
        {
          title: 'Unreviewed outbound communication to customers',
          category: 'Business',
          severity: 'HIGH',
          finding: 'The agent composes and sends customer-facing replies with no review step.',
          business_impact: 'An incorrect or inappropriate reply reaches the customer directly and cannot be recalled.',
          recommendation: 'Sample-review outbound replies and gate credits above a threshold.',
        },
      ],
    }),
    'Agentic AI Security Analyst': wrap({
      dimensions: [
        { dimension: 'Agent Identity', status: 'WEAK', severity: 'MODERATE', observation: 'A dedicated service account is used.', risk: 'Actions are attributable to the service, not to individual agent runs.', recommendation: 'Emit a per-run correlation identifier alongside the service identity.' },
        { dimension: 'Least Privilege', status: 'ABSENT', severity: 'CRITICAL', observation: 'The agent holds the same application role as a human analyst.', risk: 'A misclassified ticket can drive a write to any record the support role can reach.', recommendation: 'Scope the agent role to the support queue with create-only ticket permissions.' },
        { dimension: 'Human Oversight', status: 'ABSENT', severity: 'CRITICAL', observation: 'No approval gate exists for any action.', risk: 'Incorrect credits and customer replies take effect with no review.', recommendation: 'Require approval for credits and for first-contact replies.' },
        { dimension: 'Prompt Injection', status: 'WEAK', severity: 'HIGH', observation: 'Ticket text is placed directly into the model context.', risk: 'A crafted ticket could instruct the agent to issue a credit or leak another customer record.', recommendation: 'Isolate ticket content from instructions and allowlist tool calls per intent.' },
      ],
    }),
    'Governance Mapping Agent': wrap({
      mappings: [
        { control_id: 'AIC-02', risk: 'The agent can write to production customer records beyond its stated task.', rationale: 'Authorization scope is the control that bounds what a misclassification can reach.' },
        { control_id: 'AIC-03', risk: 'High-impact customer-facing actions take effect unreviewed.', rationale: 'Human oversight is the compensating control where autonomy exceeds verification capability.' },
      ],
    }),
    'TPRM Vendor Analyst': wrap({
      vendor: 'Aurora AI Inc.',
      vendor_risk_band: 'HIGH',
      critical_findings: ['Data-use and retention terms for submitted customer data are not established.'],
      missing_evidence: ['SOC 2 Type II report', 'Subprocessor list', 'AI-specific security addendum'],
      recommended_questions: [
        'Do you train, fine-tune or evaluate models on customer submissions, and can that be contractually disabled?',
        'What is the retention period for prompts, tool call arguments and model outputs?',
        'Which subprocessors receive customer content, and in which jurisdictions?',
      ],
      remediation: ['Execute an AI addendum covering training use and retention before go-live.'],
    }),
    'Remediation Narrative Agent': wrap({
      actions: [
        { id: 'REM-AIC-02', control_id: 'AIC-02', action: 'Replace the shared support application role with an agent-specific role scoped to the tier-1 queue: read ticket, append public comment, set status. Remove write access to customer account records.', rationale: 'The agent currently holds every permission a human analyst holds, far beyond its stated task.', business_impact: 'Limits what an incorrect classification can change to the ticket itself.' },
        { id: 'REM-AIC-03', control_id: 'AIC-03', action: 'Require explicit human approval for any account credit and for the first outbound reply on a ticket.', rationale: 'No action the agent takes is currently reviewed before it reaches a customer.', business_impact: 'Stops incorrect credits and inappropriate replies from reaching customers.' },
      ],
    }),
    'Executive Summary Agent': wrap({
      primary_risk: 'The support assistant can change customer records and issue account credits without anyone reviewing the action, using the same broad permissions a human analyst holds.',
      top_risks: [
        'Agent permissions far exceed its stated task',
        'No human review before customer-facing actions',
        'Ticket content can influence agent behaviour',
        'Provider data-use terms not established',
      ],
      top_recommendations: [
        'Scope the agent role to the tier-1 queue',
        'Require approval for credits and first replies',
        'Isolate untrusted ticket content from instructions',
        'Execute an AI addendum with the provider',
      ],
      business_narrative:
        'The Aurora Support Resolution Agent resolves tier-1 support tickets end to end, including sending customer replies and issuing account credits. It does this with the same system permissions a human support analyst holds and without any review before an action takes effect, so a single misclassified ticket can change a customer record or move money. Ticket text also reaches the model directly, which means a customer can influence what the agent does. Roughly 45,000 customers are in scope, and the provider has not established what happens to the data submitted to it. The organisation should scope the agent permissions and add approval gates for credits and first replies before this is approved.',
    }),
  };
}

function runPipeline({ malformed = false, thirdParty = true } = {}) {
  const nodeOutputs = {};
  const input = { ...scenario.input, third_party: thirdParty, hosting: thirdParty ? 'third_party' : 'internal' };

  const norm = runCodeNode('01-normalize-input.js', [{ json: { body: input } }], nodeOutputs);
  nodeOutputs['Normalize Input'] = norm;

  Object.assign(nodeOutputs, buildStubs(malformed));
  if (!thirdParty) delete nodeOutputs['TPRM Vendor Analyst'];

  nodeOutputs['Control Gap Analysis'] = runCodeNode('02-control-gap-analysis.js', [{ json: norm }], nodeOutputs);
  nodeOutputs['Evidence Gap Analysis'] = runCodeNode('03-evidence-gap-analysis.js', [{ json: norm }], nodeOutputs);
  nodeOutputs['Deterministic Risk Engine'] = runCodeNode('04-risk-engine.js', [{ json: norm }], nodeOutputs);
  nodeOutputs['Risk Prioritization'] = runCodeNode('05-prioritize.js', [{ json: norm }], nodeOutputs);

  return runCodeNode('06-assemble-final.js', [{ json: norm }], nodeOutputs);
}

/* ------------------------------------------------------------- assertions */

let failures = 0;
const assert = (label, cond, detail = '') => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${cond || !detail ? '' : ' -> ' + detail}`);
  if (!cond) failures++;
};

console.log('\n=== Happy path (third-party system, well-formed LLM output) ===');
const ok = runPipeline();

const REQUIRED_KEYS = [
  'assessment_id', 'generated_at', 'schema_version', 'system', 'risk', 'findings',
  'agentic_analysis', 'governance_mappings', 'control_gaps', 'evidence_gaps',
  'remediation_plan', 'tprm', 'executive_summary', 'audit_record', 'disclaimer',
];
assert('every AssessmentResult key is present', REQUIRED_KEYS.every((k) => k in ok), REQUIRED_KEYS.filter((k) => !(k in ok)).join(', '));
assert('schema_version is 1.0.0', ok.schema_version === '1.0.0');
assert('all eleven agentic dimensions are returned', ok.agentic_analysis.length === 11, String(ok.agentic_analysis.length));
assert('the TPRM branch populated a vendor result', ok.tprm !== null && ok.tprm.recommended_questions.length > 0);
assert('every governance mapping is flagged illustrative', ok.governance_mappings.every((g) => g.illustrative === true));
assert('no governance mapping invented a framework reference', ok.governance_mappings.every((g) => typeof g.framework_reference === 'string' && g.framework_reference.length > 0));
assert('the executive summary risk band matches the engine', ok.executive_summary.overall_risk === ok.risk.band);
assert('findings are ordered most severe first', ok.findings.length > 1 && ['CRITICAL', 'HIGH'].includes(ok.findings[0].severity));
assert('every finding declares its source', ok.findings.every((f) => ['ai', 'deterministic'].includes(f.source)));
assert('the audit record records every completed stage', ok.audit_record.stages_completed.length >= 8, String(ok.audit_record.stages_completed.length));
assert('no LLM stage was recorded as degraded', ok.audit_record.degraded_stages.length === 0, ok.audit_record.degraded_stages.join(', '));
assert('a HIGH/CRITICAL assessment is not auto-approved', !['HIGH', 'CRITICAL'].includes(ok.risk.band) || ok.audit_record.final_status === 'PENDING_HUMAN_GOVERNANCE_REVIEW');

console.log('\n=== LLM severity cannot exceed the deterministic band by more than one step ===');
const BANDS = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];
assert(
  'no AI finding is more than one band above the overall risk band',
  ok.findings.filter((f) => f.source === 'ai').every((f) => BANDS.indexOf(f.severity) <= BANDS.indexOf(ok.risk.band) + 1)
);

console.log('\n=== Degraded path (every LLM stage returns malformed output) ===');
const bad = runPipeline({ malformed: true });
assert('the assessment still completes', Boolean(bad.assessment_id && bad.risk));
assert('the deterministic risk score is unchanged', bad.risk.score === ok.risk.score, `${bad.risk.score} vs ${ok.risk.score}`);
assert('the control gaps are unchanged', bad.control_gaps.length === ok.control_gaps.length);
assert('the remediation plan still has actions and SLAs', bad.remediation_plan.length > 0 && bad.remediation_plan.every((i) => i.action && i.sla));
assert(
  'stages that returned unparseable output are recorded as degraded',
  ['AI Risk Analyst', 'Governance Mapping Agent', 'Remediation Narrative Agent'].every((s) =>
    bad.audit_record.degraded_stages.includes(s)
  ),
  bad.audit_record.degraded_stages.join(', ')
);
assert(
  'a stage that returns valid JSON of the wrong shape degrades to UNKNOWN rather than inventing content',
  bad.agentic_analysis.length === 11 && bad.agentic_analysis.every((d) => d.status === 'UNKNOWN')
);
assert(
  'no LLM prose leaks into a degraded assessment as if it were analysis',
  bad.findings.every((f) => f.source === 'deterministic')
);

console.log('\n=== Internal system (TPRM branch does not run) ===');
const internal = runPipeline({ thirdParty: false });
assert('tprm is null when the branch did not execute', internal.tprm === null);
assert('the assessment still completes', Boolean(internal.assessment_id && internal.risk.band));

/* --------------------------------------------------- write contract sample */

mkdirSync(join(HERE, 'fixtures'), { recursive: true });
writeFileSync(join(HERE, 'fixtures', 'sample-response.json'), JSON.stringify(ok, null, 2) + '\n');
console.log('\nWrote n8n/fixtures/sample-response.json (documents the response contract; not used by the app).');

console.log(failures === 0 ? '\nContract test passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
