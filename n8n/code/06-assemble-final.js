/**
 * STAGE 10 - ASSEMBLE FINAL ASSESSMENT + AUDIT RECORD
 * n8n Code node (Run Once for All Items). Last node before Respond to Webhook.
 *
 * Merges the deterministic outputs (authoritative for every score, status,
 * severity, priority and SLA) with the LLM outputs (authoritative for nothing
 * except wording) into the single AssessmentResult contract the frontend renders.
 *
 * Defensive by design: if an LLM stage returns malformed JSON, the assessment
 * still completes with the deterministic content intact and the stage recorded
 * as degraded in the audit record. A GRC workflow should not fail closed on
 * prose.
 */

const norm = $('Normalize Input').first().json;
const a = norm.input;

const stages_completed = [];
const degraded_stages = [];

/** Read a node's JSON output, tolerating the OpenAI node's message.content wrapper. */
function aiJson(nodeName, fallback) {
  try {
    const raw = $(nodeName).first().json;
    let payload = raw && raw.message && raw.message.content !== undefined ? raw.message.content : raw;
    if (typeof payload === 'string') payload = JSON.parse(payload);
    if (!payload || typeof payload !== 'object') throw new Error('empty');
    stages_completed.push(nodeName);
    return payload;
  } catch (e) {
    degraded_stages.push(nodeName);
    return fallback;
  }
}

function nodeJson(nodeName, fallback) {
  try {
    const v = $(nodeName).first().json;
    stages_completed.push(nodeName);
    return v;
  } catch (e) {
    degraded_stages.push(nodeName);
    return fallback;
  }
}

const arr = (v) => (Array.isArray(v) ? v : []);
const txt = (v, d = '') => (typeof v === 'string' && v.trim() ? v.trim() : d);
const SEV = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];
const sev = (v, d) => (SEV.includes(String(v).toUpperCase()) ? String(v).toUpperCase() : d);

/* ------------------------------------------------- deterministic sources */

const riskBlock = nodeJson('Deterministic Risk Engine', {}).risk;
const controlBlock = nodeJson('Control Gap Analysis', {});
const evidenceBlock = nodeJson('Evidence Gap Analysis', {});
const prio = nodeJson('Risk Prioritization', {});

const control_gaps = arr(controlBlock.control_gaps);
const evidence_gaps = arr(evidenceBlock.evidence_gaps);
const skeleton = arr(prio.remediation_skeleton);
const govDecision = prio.governance_decision || {};

/* --------------------------------------------------------- LLM sources */

const riskAnalysis = aiJson('AI Risk Analyst', { risk_factors: [] });
const agentic = aiJson('Agentic AI Security Analyst', { dimensions: [] });
const govRationale = aiJson('Governance Mapping Agent', { mappings: [] });
const remediationText = aiJson('Remediation Narrative Agent', { actions: [] });
const execText = aiJson('Executive Summary Agent', {});

let tprm = null;
try {
  const t = $('TPRM Vendor Analyst').first().json;
  let payload = t && t.message && t.message.content !== undefined ? t.message.content : t;
  if (typeof payload === 'string') payload = JSON.parse(payload);
  if (payload && typeof payload === 'object') {
    tprm = {
      vendor: txt(payload.vendor, a.vendor_name || a.model_provider),
      vendor_risk_band: sev(payload.vendor_risk_band, riskBlock.band),
      critical_findings: arr(payload.critical_findings).map((x) => txt(x)).filter(Boolean),
      missing_evidence: arr(payload.missing_evidence).map((x) => txt(x)).filter(Boolean),
      recommended_questions: arr(payload.recommended_questions).map((x) => txt(x)).filter(Boolean),
      remediation: arr(payload.remediation).map((x) => txt(x)).filter(Boolean),
    };
    stages_completed.push('TPRM Vendor Analyst');
  }
} catch (e) {
  // Not a third-party system, or the branch did not execute. Both are fine.
}

/* --------------------------------------------------------------- findings */
/* Deterministic findings (from control gaps) carry the authoritative         */
/* severity. LLM risk factors are added as analysis, capped so a model can    */
/* never assert a severity above the engine's overall band.                   */

const bandIndex = SEV.indexOf(riskBlock.band);

const detFindings = arr(prio.deterministic_findings).map((f) => {
  const narrative = arr(remediationText.actions).find((x) => x && x.control_id === f.control_id) || {};
  return {
    id: f.id,
    title: f.title,
    severity: f.severity,
    category: f.category,
    finding: f.finding,
    business_impact: txt(narrative.business_impact, 'Business impact not generated for this finding.'),
    recommendation: txt(narrative.action, 'See remediation plan.'),
    source: 'deterministic',
  };
});

const aiFindings = arr(riskAnalysis.risk_factors)
  .filter((r) => r && (r.title || r.risk))
  .map((r, i) => {
    let s = sev(r.severity, 'MODERATE');
    if (SEV.indexOf(s) > bandIndex + 1) s = SEV[Math.min(SEV.length - 1, bandIndex + 1)];
    return {
      id: `AF-${String(i + 1).padStart(2, '0')}`,
      title: txt(r.title || r.risk, 'Identified risk'),
      severity: s,
      category: txt(r.category || r.domain, 'AI Risk'),
      finding: txt(r.finding || r.description, ''),
      business_impact: txt(r.business_impact, ''),
      recommendation: txt(r.recommendation, ''),
      source: 'ai',
    };
  })
  .filter((f) => f.finding);

const agenticFindings = arr(agentic.dimensions)
  .filter((d) => d && ['WEAK', 'ABSENT'].includes(String(d.status).toUpperCase()))
  .map((d, i) => ({
    id: `AG-${String(i + 1).padStart(2, '0')}`,
    title: txt(d.dimension, 'Agentic weakness'),
    severity: sev(d.severity, String(d.status).toUpperCase() === 'ABSENT' ? 'HIGH' : 'MODERATE'),
    category: 'Agentic AI Security',
    finding: txt(d.risk || d.observation, ''),
    business_impact: txt(d.business_impact, ''),
    recommendation: txt(d.recommendation, ''),
    source: 'ai',
    agentic_dimension: txt(d.dimension, ''),
  }))
  .filter((f) => f.finding);

const sevOrder = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3 };
const findings = [...detFindings, ...agenticFindings, ...aiFindings].sort(
  (x, y) => sevOrder[x.severity] - sevOrder[y.severity]
);

/* ------------------------------------------------------ agentic analysis */

const DIMENSIONS = [
  'Agent Identity',
  'Authorization',
  'Tool Access',
  'Least Privilege',
  'Autonomy',
  'Human Oversight',
  'Prompt Injection',
  'Tool Abuse',
  'Auditability',
  'Monitoring',
  'Failure Handling',
];

const agentic_analysis = DIMENSIONS.map((dim) => {
  const found =
    arr(agentic.dimensions).find(
      (d) => d && String(d.dimension || '').toLowerCase().includes(dim.toLowerCase().split(' ')[0])
    ) || {};
  const status = String(found.status || '').toUpperCase();
  return {
    dimension: dim,
    status: ['ADEQUATE', 'WEAK', 'ABSENT', 'UNKNOWN'].includes(status) ? status : 'UNKNOWN',
    observation: txt(found.observation, 'Not established from the information provided at intake.'),
    risk: txt(found.risk, ''),
    recommendation: txt(found.recommendation, ''),
  };
});

/* ---------------------------------------------------- governance mappings */
/* Framework references and required evidence come from the control catalog.  */
/* The LLM contributes the rationale sentence only - never a control ID.      */

const governance_mappings = control_gaps
  .filter((c) => c.status !== 'PRESENT')
  .map((c, i) => {
    const r = arr(govRationale.mappings).find((x) => x && x.control_id === c.control_id) || {};
    return {
      id: `GM-${String(i + 1).padStart(2, '0')}`,
      risk: txt(r.risk, c.reason),
      governance_area: c.governance_area,
      framework_reference: c.framework_reference,
      recommended_control: c.control,
      required_evidence: c.required_evidence,
      rationale: txt(r.rationale, 'Mapped from the control catalog based on the intake responses.'),
      illustrative: true,
    };
  });

/* -------------------------------------------------------- remediation plan */

const remediation_plan = skeleton.map((s) => {
  const narrative = arr(remediationText.actions).find((x) => x && x.id === s.id) || {};
  return {
    id: s.id,
    priority: s.priority,
    sla: s.sla,
    action: txt(narrative.action, s.control ? `Remediate: ${s.control}` : 'Remediation action'),
    rationale: txt(narrative.rationale, s.rationale),
    owner: s.owner,
    linked_controls: s.linked_controls,
  };
});

/* ------------------------------------------------------ executive summary */

const topRisks = findings.slice(0, 4).map((f) => f.title);
const topRecs = remediation_plan.slice(0, 4).map((r) => r.action);

const executive_summary = {
  overall_risk: riskBlock.band, // deterministic, never the LLM's
  primary_risk: txt(execText.primary_risk, findings.length ? findings[0].finding : 'No material risk identified.'),
  top_risks: arr(execText.top_risks).map((x) => txt(x)).filter(Boolean).slice(0, 5).length
    ? arr(execText.top_risks).map((x) => txt(x)).filter(Boolean).slice(0, 5)
    : topRisks,
  top_recommendations: arr(execText.top_recommendations).map((x) => txt(x)).filter(Boolean).slice(0, 5).length
    ? arr(execText.top_recommendations).map((x) => txt(x)).filter(Boolean).slice(0, 5)
    : topRecs,
  business_narrative: txt(
    execText.business_narrative,
    `${a.system_name} was assessed at ${riskBlock.band} risk with ${controlBlock.control_summary?.gaps ?? 0} control gap(s) identified.`
  ),
  recommended_decision: govDecision.recommended_decision || 'REQUIRES_GOVERNANCE_REVIEW',
  human_review_required: govDecision.human_review_required !== false,
};

/* ------------------------------------------------------------ audit record */

const audit_record = {
  assessment_id: norm.assessment_id,
  timestamp: norm.generated_at,
  system: a.system_name,
  engine_version: norm.engine_version,
  schema_version: norm.schema_version,
  input_fingerprint: norm.input_fingerprint,
  // $env throws on instances running with N8N_BLOCK_ENV_ACCESS_IN_NODE=true,
  // so the model label is best-effort and never fails the assessment.
  ai_model: (() => {
    try {
      return $env.AIRA_MODEL || 'openai:gpt-4o-mini';
    } catch (e) {
      return 'openai:gpt-4o-mini';
    }
  })(),
  stages_completed,
  degraded_stages,
  risk_score: riskBlock.score,
  risk_band: riskBlock.band,
  control_gap_count: controlBlock.control_summary?.gaps ?? 0,
  evidence_gap_count: evidenceBlock.evidence_summary?.missing ?? 0,
  final_status: executive_summary.human_review_required
    ? 'PENDING_HUMAN_GOVERNANCE_REVIEW'
    : 'COMPLETED_AUTOMATED_ASSESSMENT',
};

/* ----------------------------------------------------------------- result */

return [
  {
    json: {
      assessment_id: norm.assessment_id,
      generated_at: norm.generated_at,
      schema_version: norm.schema_version,
      system: {
        name: a.system_name,
        owner: a.business_owner,
        department: a.department,
        purpose: a.business_purpose,
        ai_type: a.ai_type,
        model_provider: a.model_provider,
        hosting: a.hosting,
        is_agent: a.is_agent,
        third_party: a.third_party,
      },
      risk: riskBlock,
      findings,
      agentic_analysis,
      governance_mappings,
      control_gaps,
      evidence_gaps,
      remediation_plan,
      tprm,
      executive_summary,
      audit_record,
      disclaimer:
        'This is an automated first-pass assessment intended to support, not replace, human governance review. ' +
        'Framework mappings are illustrative and do not constitute certification of compliance with NIST AI RMF, ' +
        'ISO/IEC 42001, or any other standard. All findings require validation against evidence before an approval decision.',
    },
  },
];
