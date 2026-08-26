/**
 * STAGE 6 - EVIDENCE GAP ANALYSIS  (deterministic)
 * n8n Code node (Run Once for All Items).
 *
 * Answers the question a GRC analyst actually has to answer before approval:
 * "what do I need to ask this team for?"
 *
 * Status is derived from the intake and from the control-gap results, never
 * from an LLM. Evidence the intake cannot speak to is honestly marked MISSING
 * rather than assumed present - an assessment that quietly assumes evidence
 * exists is worse than one that asks.
 */

const norm = $('Normalize Input').first().json;
const a = norm.input;
const controls = $('Control Gap Analysis').first().json.control_gaps;

const controlStatus = (id) => (controls.find((c) => c.control_id === id) || {}).status || 'GAP';

/**
 * Evidence catalog.
 * required(): is this artefact in scope for this system at all?
 * status():   PROVIDED | PARTIAL | MISSING
 *
 * At intake almost nothing has been *uploaded*, so "PROVIDED" is reserved for
 * artefacts the intake itself substantiates (e.g. a described architecture).
 */
const CATALOG = [
  {
    evidence: 'Architecture documentation',
    owner: 'Engineering',
    risk: 'MODERATE',
    why_required: 'Establishes trust boundaries, where model context comes from, and which systems the AI can reach.',
    required: () => true,
    status: () => (a.description && a.description.length >= 200 ? 'PARTIAL' : 'MISSING'),
  },
  {
    evidence: 'Data flow diagram',
    owner: 'Engineering',
    risk: 'HIGH',
    why_required: 'Shows what data enters the model context and where model output travels, which drives both privacy and injection analysis.',
    required: () => a.sensitive_data || a.personal_information || a.can_read_data,
    status: () => 'MISSING',
  },
  {
    evidence: 'Agent authorization model',
    owner: 'Engineering / IAM',
    risk: 'CRITICAL',
    why_required: 'Defines how the agent is identified and what identity its actions execute under.',
    required: () => a.is_agent,
    status: () => (controlStatus('AIC-01') === 'PRESENT' ? 'PARTIAL' : 'MISSING'),
  },
  {
    evidence: 'Tool permission matrix',
    owner: 'Engineering',
    risk: 'CRITICAL',
    why_required: 'Maps each tool the agent can invoke to the specific actions it is permitted to perform.',
    required: () => a.tool_access,
    status: () => (controlStatus('AIC-08') === 'PRESENT' ? 'PROVIDED' : 'MISSING'),
  },
  {
    evidence: 'IAM policy / access control configuration',
    owner: 'IAM / Platform',
    risk: 'HIGH',
    why_required: 'Substantiates the least-privilege claim made at intake.',
    required: () => true,
    status: () => (controlStatus('AIC-02') === 'PRESENT' ? 'PARTIAL' : 'MISSING'),
  },
  {
    evidence: 'Human approval workflow documentation',
    owner: 'Business Owner',
    risk: 'CRITICAL',
    why_required: 'Shows where a person is required in the loop and what they see before approving.',
    required: () =>
      a.can_modify_data || a.can_delete_data || a.can_execute_transactions || a.can_send_communications,
    status: () => (a.human_approval === 'always' ? 'PARTIAL' : 'MISSING'),
  },
  {
    evidence: 'Logging configuration',
    owner: 'Engineering / SecOps',
    risk: 'HIGH',
    why_required: 'Determines whether agent behaviour can be reconstructed during an investigation.',
    required: () => true,
    status: () => (a.logging === 'comprehensive' ? 'PARTIAL' : 'MISSING'),
  },
  {
    evidence: 'Monitoring configuration',
    owner: 'SecOps',
    risk: 'HIGH',
    why_required: 'Determines whether abnormal agent behaviour would be detected.',
    required: () => true,
    status: () => (a.monitoring === 'behavioral' ? 'PARTIAL' : 'MISSING'),
  },
  {
    evidence: 'Vendor security documentation / SOC 2 report',
    owner: 'TPRM',
    risk: 'HIGH',
    why_required: 'Baseline assurance over the provider handling the organisation’s data.',
    required: () => a.third_party,
    status: () => 'MISSING',
  },
  {
    evidence: 'Privacy assessment (DPIA / PIA)',
    owner: 'Privacy',
    risk: 'HIGH',
    why_required: 'Required where personal data is processed by an automated system that can act on it.',
    required: () => a.personal_information,
    status: () => 'MISSING',
  },
  {
    evidence: 'Data retention and deletion policy',
    owner: 'Privacy / Legal',
    risk: 'MODERATE',
    why_required: 'Establishes how long prompts, outputs and tool results are retained by the provider and internally.',
    required: () => a.sensitive_data || a.personal_information,
    status: () => 'MISSING',
  },
  {
    evidence: 'Model documentation (model card / system card)',
    owner: 'AI Engineering',
    risk: 'MODERATE',
    why_required: 'Documents intended use, known limitations and evaluation results for the underlying model.',
    required: () => true,
    status: () => 'MISSING',
  },
  {
    evidence: 'AI risk assessment (pre-deployment sign-off)',
    owner: 'GRC',
    risk: 'HIGH',
    why_required: 'The formal, human-approved record that this system was assessed and accepted before deployment.',
    required: () => true,
    status: () => 'MISSING',
  },
  {
    evidence: 'Incident response procedure covering AI/agent failure',
    owner: 'SecOps',
    risk: 'HIGH',
    why_required: 'Defines how an incorrect or manipulated agent action is detected, halted and reversed.',
    required: () => true,
    status: () => 'MISSING',
  },
];

const riskOrder = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3 };
const statusOrder = { MISSING: 0, PARTIAL: 1, PROVIDED: 2 };

const evidence_gaps = CATALOG.filter((e) => e.required()).map((e) => ({
  evidence: e.evidence,
  status: e.status(),
  risk: e.risk,
  owner: e.owner,
  why_required: e.why_required,
}));

evidence_gaps.sort(
  (x, y) => statusOrder[x.status] - statusOrder[y.status] || riskOrder[x.risk] - riskOrder[y.risk]
);

return [
  {
    json: {
      evidence_gaps,
      evidence_summary: {
        total: evidence_gaps.length,
        missing: evidence_gaps.filter((e) => e.status === 'MISSING').length,
        partial: evidence_gaps.filter((e) => e.status === 'PARTIAL').length,
        provided: evidence_gaps.filter((e) => e.status === 'PROVIDED').length,
      },
    },
  },
];
