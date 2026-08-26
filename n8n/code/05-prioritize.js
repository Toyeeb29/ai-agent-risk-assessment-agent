/**
 * STAGE 8a - RISK PRIORITISATION & REMEDIATION RULES  (deterministic)
 * n8n Code node (Run Once for All Items).
 *
 * Severity, priority and SLA are decided here by rule. The LLM that runs next
 * only writes the *wording* of each remediation action - it never changes the
 * priority, the SLA or the ordering. That separation is what lets a GRC team
 * defend the plan: the same gaps always produce the same priorities.
 *
 * Priority = control severity, escalated when the gap is compounded by
 * autonomy + privilege (an agent that can act unsupervised turns a control
 * gap into an operational one).
 *
 * SLA:  CRITICAL -> Immediate | HIGH -> 30 days | MEDIUM -> 60 days | LOW -> 90 days
 */

const norm = $('Normalize Input').first().json;
const a = norm.input;
const m = norm.modifiers;
const controls = $('Control Gap Analysis').first().json.control_gaps;
const evidence = $('Evidence Gap Analysis').first().json.evidence_gaps;
const riskBlock = $('Deterministic Risk Engine').first().json.risk;

const SEV_TO_PRIORITY = { CRITICAL: 'CRITICAL', HIGH: 'HIGH', MODERATE: 'MEDIUM', LOW: 'LOW' };
const SLA = { CRITICAL: 'Immediate', HIGH: '30 days', MEDIUM: '60 days', LOW: '90 days' };
const PRIORITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const OWNER_BY_AREA = {
  'Identity & Access Management': 'IAM / Platform Engineering',
  Authorization: 'Engineering + Security',
  'Human Oversight': 'Business Owner + GRC',
  Auditability: 'Engineering + SecOps',
  'Monitoring & Detection': 'SecOps',
  'Security Engineering': 'Security Engineering',
  'AI Security': 'Security Engineering + AI Engineering',
  Privacy: 'Privacy Office',
  'Third-Party Risk Management': 'TPRM',
  Resilience: 'Engineering + SecOps',
  'AI Governance': 'GRC / AI Governance',
};

/* ------------------------------------------------- deterministic findings */
/* One finding per control GAP. These are rule-derived, not LLM-derived, and  */
/* are marked as such in the report so a reviewer knows where each came from. */

const deterministic_findings = controls
  .filter((c) => c.status === 'GAP')
  .map((c, i) => ({
    id: `DF-${String(i + 1).padStart(2, '0')}`,
    title: c.control.replace(/^AI agent /, 'Agent ').replace(/^./, (s) => s.toUpperCase()),
    severity: c.severity,
    category: c.governance_area,
    finding: c.reason,
    business_impact: '', // written by the remediation/narrative stage
    recommendation: '',
    source: 'deterministic',
    control_id: c.control_id,
  }));

/* --------------------------------------------------------- remediation set */

const items = [];

// 1. Every control gap becomes a remediation item.
controls
  .filter((c) => c.status === 'GAP' || (c.status === 'PARTIAL' && c.severity !== 'LOW'))
  .forEach((c) => {
    let priority = SEV_TO_PRIORITY[c.severity];

    // Compounding rule: an unsupervised, privileged agent raises the urgency
    // of any authorization / oversight / auditability gap by one step.
    const compounding =
      m.autonomy >= 3 &&
      m.tool_privilege >= 2 &&
      ['Authorization', 'Human Oversight', 'Auditability'].includes(c.governance_area);
    if (compounding && priority !== 'CRITICAL') {
      const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      priority = order[Math.max(0, order.indexOf(priority) - 1)];
    }

    items.push({
      id: `REM-${c.control_id}`,
      priority,
      sla: SLA[priority],
      action: '', // written by the Remediation Narrative agent
      rationale: c.reason,
      owner: OWNER_BY_AREA[c.governance_area] || 'Business Owner',
      linked_controls: [c.control_id],
      control_status: c.status,
      control: c.control,
      governance_area: c.governance_area,
      escalated: compounding,
    });
  });

// 2. Missing CRITICAL/HIGH evidence becomes an evidence-collection item.
const criticalEvidence = evidence.filter((e) => e.status === 'MISSING' && ['CRITICAL', 'HIGH'].includes(e.risk));
if (criticalEvidence.length) {
  const priority = criticalEvidence.some((e) => e.risk === 'CRITICAL') ? 'HIGH' : 'MEDIUM';
  items.push({
    id: 'REM-EVIDENCE',
    priority,
    sla: SLA[priority],
    action: '',
    rationale: `${criticalEvidence.length} high-value evidence artefact(s) required for an approval decision have not been provided: ${criticalEvidence
      .map((e) => e.evidence)
      .join('; ')}.`,
    owner: 'GRC (coordinating with named artefact owners)',
    linked_controls: [],
    control_status: 'GAP',
    control: 'Evidence collection for approval decision',
    governance_area: 'AI Governance',
    escalated: false,
  });
}

items.sort(
  (x, y) => PRIORITY_ORDER[x.priority] - PRIORITY_ORDER[y.priority] || x.id.localeCompare(y.id)
);

/* -------------------------------------------------- governance escalation */
/* Whether this assessment must go to a human governance review board is a    */
/* deterministic decision, not an LLM judgement call.                         */

const criticalGaps = controls.filter((c) => c.status === 'GAP' && c.severity === 'CRITICAL').length;

const human_review_required =
  riskBlock.band === 'CRITICAL' ||
  riskBlock.band === 'HIGH' ||
  criticalGaps > 0 ||
  a.regulatory_sensitivity === 'high' ||
  (m.autonomy >= 3 && m.tool_privilege >= 2);

/**
 * Decision rule - one line per outcome, deliberately simple enough to defend
 * in a review meeting. Note that the workflow never approves anything on its
 * own: APPROVE here means "no blocking issues found in the automated pass",
 * and a person still records the decision.
 */
const recommended_decision =
  riskBlock.band === 'CRITICAL'
    ? 'DO_NOT_APPROVE'
    : riskBlock.band === 'HIGH' || criticalGaps > 0
    ? 'REQUIRES_GOVERNANCE_REVIEW'
    : riskBlock.band === 'MODERATE'
    ? 'APPROVE_WITH_CONDITIONS'
    : 'APPROVE';

const decision_rationale = [
  `Overall risk band: ${riskBlock.band} (${riskBlock.score}/64)`,
  `Critical control gaps: ${criticalGaps}`,
  `Regulatory sensitivity: ${a.regulatory_sensitivity}`,
  `Autonomy ${m.autonomy}/4 with tool privilege ${m.tool_privilege}/4`,
];

return [
  {
    json: {
      deterministic_findings,
      remediation_skeleton: items,
      prioritisation: {
        critical_gaps: criticalGaps,
        total_actions: items.length,
        immediate_actions: items.filter((i) => i.priority === 'CRITICAL').length,
      },
      governance_decision: {
        recommended_decision,
        human_review_required,
        decision_rationale,
      },
    },
  },
];
