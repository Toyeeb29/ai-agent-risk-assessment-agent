/**
 * Builds the importable n8n workflow JSON from the reviewable source files in
 * n8n/code/*.js and n8n/prompts/*.md.
 *
 *   npm run workflow:build
 *
 * Why a build step: n8n exports Code nodes as one giant escaped JSON string,
 * which is unreviewable in a pull request and impossible to lint. Keeping the
 * engine as real .js files and the prompts as real .md files means the logic
 * that decides risk can be diffed, reviewed and unit-tested like any other code.
 * The generated JSON is a build artefact - edit the sources, not the JSON.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'ai-agent-risk-assessment.workflow.json');

const MODEL = process.env.AIRA_MODEL || 'gpt-4o-mini';
/**
 * Optional: your n8n OpenAI credential ID, so the import arrives ready to run.
 * Find it in the URL when you open the credential in n8n:
 *   https://your-n8n/home/credentials/<THIS-PART>
 * Left unset, the LLM nodes import with no credential and you attach one by hand.
 */
const OPENAI_CREDENTIAL_ID = process.env.AIRA_OPENAI_CREDENTIAL_ID || '';
const OPENAI_CREDENTIAL_NAME = process.env.AIRA_OPENAI_CREDENTIAL_NAME || 'OpenAi account';

// A credential ID copied from documentation is worse than no credential ID: it
// imports as a reference to something that does not exist, which n8n reports as
// a node issue with no hint that the ID itself is the problem. Fail loudly here.
const PLACEHOLDER_IDS = [
  'abc123xyz',
  'replace_with_your_credential_id',
  'your-credential-id',
  'your_credential_id',
  '<id>',
  'id',
];
if (OPENAI_CREDENTIAL_ID && PLACEHOLDER_IDS.includes(OPENAI_CREDENTIAL_ID.toLowerCase())) {
  console.error(`\n  AIRA_OPENAI_CREDENTIAL_ID is set to "${OPENAI_CREDENTIAL_ID}", which is an example`);
  console.error('  value from the documentation, not a real n8n credential ID.\n');
  console.error('  To find yours: open n8n -> Credentials -> click your OpenAI credential.');
  console.error('  The ID is the last segment of the browser URL:');
  console.error('      http://localhost:5678/home/credentials/K3mQ8vTn2LpXwR7a');
  console.error('                                             ^^^^^^^^^^^^^^^^\n');
  console.error('  Or just build without it and pick the credential in each of the 6 LLM');
  console.error('  nodes after import:\n');
  console.error('      node n8n/build-workflow.mjs\n');
  process.exit(1);
}
const WEBHOOK_PATH = process.env.AIRA_WEBHOOK_PATH || 'ai-risk-assessment';
/** Set to your portfolio origin in production, e.g. https://portfolio.example.com */
const ALLOWED_ORIGINS = process.env.AIRA_ALLOWED_ORIGINS || '*';

const code = (f) => readFileSync(join(HERE, 'code', f), 'utf8');

function prompt(f) {
  const raw = readFileSync(join(HERE, 'prompts', f), 'utf8');
  const afterSystem = raw.split(/^===SYSTEM===$/m);
  if (afterSystem.length !== 2) throw new Error(`${f}: missing ===SYSTEM=== marker`);
  const parts = afterSystem[1].split(/^===USER===$/m);
  if (parts.length !== 2) throw new Error(`${f}: missing ===USER=== marker`);
  return { system: parts[0].trim(), user: parts[1].trim() };
}

/* ------------------------------------------------------------ node helpers */

let idc = 0;
const nid = (name) => `n${String(++idc).padStart(2, '0')}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

const nodes = [];
const connections = {};

function add(node) {
  nodes.push({ id: nid(node.name), ...node });
  return node.name;
}

function connect(from, to, outputIndex = 0) {
  connections[from] = connections[from] || { main: [] };
  while (connections[from].main.length <= outputIndex) connections[from].main.push([]);
  connections[from].main[outputIndex].push({ node: to, type: 'main', index: 0 });
}

function codeNode(name, file, position, notes) {
  return add({
    name,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position,
    notes,
    parameters: { mode: 'runOnceForAllItems', jsCode: code(file) },
  });
}

function aiNode(name, file, position, notes) {
  const p = prompt(file);
  const node = {
    name,
    type: '@n8n/n8n-nodes-langchain.openAi',
    typeVersion: 1.8,
    position,
    notes,
    parameters: {
      // mode 'id' rather than 'list': a list-mode resource locator asks n8n to
      // validate the value against the provider's model list, which it cannot do
      // before a credential is attached. That makes every LLM node import as
      // "invalid" and blocks execution with "The workflow has issues".
      modelId: { __rl: true, value: MODEL, mode: 'id' },
      messages: {
        values: [
          { role: 'system', content: p.system },
          { role: 'user', content: p.user.startsWith('=') ? p.user : '=' + p.user },
        ],
      },
      jsonOutput: true,
      options: { temperature: 0.2, maxTokens: 3000 },
    },
    onError: 'continueRegularOutput',
    retryOnFail: true,
    maxTries: 2,
  };

  // Only emit a credentials block when a real ID was supplied. A placeholder ID
  // imports as a dangling reference, which n8n also flags as a node issue.
  if (OPENAI_CREDENTIAL_ID) {
    node.credentials = { openAiApi: { id: OPENAI_CREDENTIAL_ID, name: OPENAI_CREDENTIAL_NAME } };
  }

  return add(node);
}

/* ------------------------------------------------------------------ graph */

const X = (n) => 260 + n * 220;
const Y = 300;

const webhook = add({
  name: 'Webhook - AI Risk Assessment',
  type: 'n8n-nodes-base.webhook',
  typeVersion: 2,
  position: [X(0), Y],
  webhookId: 'ai-risk-assessment-webhook',
  notes:
    'Entry point. The portfolio frontend POSTs the assessment here (VITE_N8N_AI_RISK_WEBHOOK). ' +
    'Set allowedOrigins to your portfolio origin in production, and enable header auth if the endpoint is not public by design.',
  parameters: {
    httpMethod: 'POST',
    path: WEBHOOK_PATH,
    responseMode: 'responseNode',
    options: { allowedOrigins: ALLOWED_ORIGINS },
  },
});

const normalize = codeNode(
  'Normalize Input',
  '01-normalize-input.js',
  [X(1), Y],
  'STAGE 1 - Intake. Validates and normalizes the submission and derives the six agent risk modifiers. No LLM involved: this is the trust boundary.'
);

const validIf = add({
  name: 'Valid Input?',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [X(2), Y],
  notes: 'Fail fast on malformed input before any token is spent.',
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [
        {
          id: 'valid-check',
          leftValue: '={{ $json.valid }}',
          rightValue: '',
          operator: { type: 'boolean', operation: 'true', singleValue: true },
        },
      ],
      combinator: 'and',
    },
    options: {},
  },
});

const respondError = add({
  name: 'Respond - Validation Error',
  type: 'n8n-nodes-base.respondToWebhook',
  typeVersion: 1.1,
  position: [X(3), Y + 200],
  notes: 'HTTP 400 with the field-level validation errors. The frontend renders these next to the form.',
  parameters: {
    respondWith: 'json',
    responseBody: '={{ JSON.stringify($json) }}',
    options: { responseCode: 400 },
  },
});

const riskAnalyst = aiNode(
  'AI Risk Analyst',
  '01-ai-risk-analyst.md',
  [X(3), Y - 120],
  'STAGE 2 - LLM. Qualitative risk analysis across seven domains. Produces analysis and language only; it does not set the score.'
);

const agenticAnalyst = aiNode(
  'Agentic AI Security Analyst',
  '02-agentic-security-analyst.md',
  [X(4), Y - 120],
  'STAGE 3 - LLM. Dedicated agentic security review across eleven dimensions (identity, authorization, tool access, least privilege, autonomy, oversight, prompt injection, tool abuse, auditability, monitoring, failure handling).'
);

const controlGaps = codeNode(
  'Control Gap Analysis',
  '02-control-gap-analysis.js',
  [X(5), Y - 120],
  'STAGE 5 - Deterministic. Rule-based control catalog evaluation. PRESENT / PARTIAL / GAP is decided here, never by a model.'
);

const evidenceGaps = codeNode(
  'Evidence Gap Analysis',
  '03-evidence-gap-analysis.js',
  [X(6), Y - 120],
  'STAGE 6 - Deterministic. What the GRC team must request before an approval decision, with owner and risk.'
);

const govMapping = aiNode(
  'Governance Mapping Agent',
  '03-governance-mapping.md',
  [X(7), Y - 120],
  'STAGE 4 - LLM (constrained). Framework references come from the control catalog; the model writes only the risk statement and rationale. No model-generated control IDs.'
);

const riskEngine = codeNode(
  'Deterministic Risk Engine',
  '04-risk-engine.js',
  [X(8), Y - 120],
  'STAGE 7 - Deterministic. Risk Score = Impact x Likelihood x Exposure (1-64) plus per-domain scores. Same input always produces the same score.'
);

const prioritize = codeNode(
  'Risk Prioritization',
  '05-prioritize.js',
  [X(9), Y - 120],
  'STAGE 8a - Deterministic. Assigns priority, SLA, owner and the governance-review decision by rule.'
);

const thirdPartyIf = add({
  name: 'Third Party?',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [X(10), Y - 120],
  notes: 'Optional TPRM branch. Runs the vendor analysis only when the system depends on an external provider.',
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [
        {
          id: 'third-party-check',
          leftValue: "={{ $('Normalize Input').first().json.input.third_party }}",
          rightValue: '',
          operator: { type: 'boolean', operation: 'true', singleValue: true },
        },
      ],
      combinator: 'and',
    },
    options: {},
  },
});

const tprm = aiNode(
  'TPRM Vendor Analyst',
  '04-tprm-vendor-analyst.md',
  [X(11), Y - 260],
  'OPTIONAL BRANCH - LLM. Lightweight third-party AI risk assessment: vendor risk, critical findings, missing evidence, questionnaire questions.'
);

const remediation = aiNode(
  'Remediation Narrative Agent',
  '05-remediation-narrative.md',
  [X(12), Y - 120],
  'STAGE 8b - LLM. Writes the wording of each remediation action. Priority and SLA were fixed upstream and are not writable here.'
);

const execSummary = aiNode(
  'Executive Summary Agent',
  '06-executive-summary.md',
  [X(13), Y - 120],
  'STAGE 9 - LLM. Translates the technical position into business language. States the deterministic risk band; it cannot change it.'
);

const assemble = codeNode(
  'Assemble Final Assessment',
  '06-assemble-final.js',
  [X(14), Y - 120],
  'STAGE 10 - Deterministic. Merges deterministic and LLM outputs into the AssessmentResult contract and writes the audit record. Degrades gracefully if an LLM stage returns malformed JSON.'
);

const respondOk = add({
  name: 'Respond - Assessment',
  type: 'n8n-nodes-base.respondToWebhook',
  typeVersion: 1.1,
  position: [X(15), Y - 120],
  notes: 'Returns the AssessmentResult JSON the portfolio renders. Nothing on the results screen is computed in the browser.',
  parameters: {
    respondWith: 'json',
    responseBody: '={{ JSON.stringify($json) }}',
    options: { responseCode: 200 },
  },
});

/* ------------------------------------------------------------ connections */

connect(webhook, normalize);
connect(normalize, validIf);
connect(validIf, riskAnalyst, 0); // true
connect(validIf, respondError, 1); // false
connect(riskAnalyst, agenticAnalyst);
connect(agenticAnalyst, controlGaps);
connect(controlGaps, evidenceGaps);
connect(evidenceGaps, govMapping);
connect(govMapping, riskEngine);
connect(riskEngine, prioritize);
connect(prioritize, thirdPartyIf);
connect(thirdPartyIf, tprm, 0); // true  -> TPRM branch
connect(thirdPartyIf, remediation, 1); // false -> skip TPRM
connect(tprm, remediation);
connect(remediation, execSummary);
connect(execSummary, assemble);
connect(assemble, respondOk);

/* ----------------------------------------------------------------- output */

const workflow = {
  name: 'AI Agent Risk Assessment Agent',
  nodes,
  connections,
  active: false,
  settings: {
    executionOrder: 'v1',
    saveManualExecutions: true,
    saveExecutionProgress: true,
    executionTimeout: 300,
  },
  tags: [],
  meta: {
    instanceId: 'self-hosted',
    description:
      'AI Governance & GRC automation for agentic AI systems. Deterministic risk scoring with LLM-assisted analysis. Generated from n8n/code/*.js and n8n/prompts/*.md - do not edit this file directly.',
  },
  pinData: {},
};

writeFileSync(OUT, JSON.stringify(workflow, null, 2) + '\n');

console.log(`Built ${OUT}`);
console.log(`  nodes: ${nodes.length}`);
console.log(`  model: ${MODEL}`);
console.log(`  webhook path: /webhook/${WEBHOOK_PATH}`);
console.log(`  allowed origins: ${ALLOWED_ORIGINS}`);
console.log(
  OPENAI_CREDENTIAL_ID
    ? `  openai credential: ${OPENAI_CREDENTIAL_ID} (pre-attached to all 6 LLM nodes)`
    : '  openai credential: not set - attach one to each of the 6 LLM nodes after import\n' +
      '                     (or rebuild with AIRA_OPENAI_CREDENTIAL_ID=<id> to pre-attach)'
);
