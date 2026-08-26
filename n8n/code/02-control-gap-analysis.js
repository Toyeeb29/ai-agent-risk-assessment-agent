/**
 * STAGE 5 - CONTROL GAP ANALYSIS  (deterministic)
 * n8n Code node (Run Once for All Items).
 *
 * Control status is decided by RULES over the normalized intake, never by an LLM.
 * A control catalog with hallucinated IDs or invented statuses is worthless to a
 * GRC team, so the LLM is kept out of this stage entirely. Each control carries
 * its own governance area, illustrative framework reference and required evidence,
 * which stage 4 (Governance Mapping) and stage 6 (Evidence Gaps) reuse.
 *
 * status: PRESENT | PARTIAL | GAP
 * severity of a GAP is fixed per control and only escalated by intake facts.
 */

const norm = $('Normalize Input').first().json;
const a = norm.input;

const SEV = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];
const escalate = (sev, steps = 1) =>
  SEV[Math.min(SEV.length - 1, SEV.indexOf(sev) + steps)];

/**
 * Control catalog.
 * evaluate() returns { status, reason } — the only place a status is decided.
 */
const CATALOG = [
  {
    control_id: 'AIC-01',
    control: 'AI agent identity and authentication',
    governance_area: 'Identity & Access Management',
    framework_reference: 'NIST AI RMF GOVERN 2.1; OWASP LLM Top 10 - LLM06 Excessive Agency',
    required_evidence: 'Agent authorization model',
    base_severity: 'HIGH',
    evaluate: () => {
      if (a.authentication === 'none') {
        return { status: 'GAP', reason: 'The AI system authenticates to downstream systems with no distinct identity, so its actions cannot be attributed to it.' };
      }
      if (a.authentication === 'shared_api_key') {
        return { status: 'PARTIAL', reason: 'A shared API key is used. The identity is not unique to the agent and cannot be revoked without affecting other consumers.' };
      }
      if (a.authentication === 'service_account') {
        return { status: 'PARTIAL', reason: 'A service account provides an identity but does not by itself distinguish agent-initiated actions from other automation.' };
      }
      return { status: 'PRESENT', reason: `Agent identity is established via ${a.authentication.replace(/_/g, ' ')}.` };
    },
  },
  {
    control_id: 'AIC-02',
    control: 'Least privilege for AI agent tool access',
    governance_area: 'Authorization',
    framework_reference: 'NIST AI RMF MANAGE 2.2; OWASP LLM Top 10 - LLM06 Excessive Agency',
    required_evidence: 'IAM policy / access control configuration',
    base_severity: 'CRITICAL',
    evaluate: () => {
      if (!a.tool_access) return { status: 'PRESENT', reason: 'The system has no tool access, so no agent privileges exist to scope.' };
      if (['none', 'shared_role'].includes(a.authorization)) {
        return { status: 'GAP', reason: `The agent operates under ${a.authorization === 'none' ? 'no defined authorization model' : 'a shared role'} while holding ${a.tools.length} tool integration(s). Its effective permissions exceed what its task requires.` };
      }
      if (a.authorization === 'role_based' && (a.can_delete_data || a.can_execute_transactions)) {
        return { status: 'GAP', reason: 'Role-based access is in place, but the agent retains destructive or transactional permissions that are not scoped to individual tasks.' };
      }
      if (a.authorization === 'role_based') {
        return { status: 'PARTIAL', reason: 'Role-based access exists but permissions are not scoped per tool or per action.' };
      }
      return { status: 'PRESENT', reason: 'Agent permissions are scoped to least privilege.' };
    },
  },
  {
    control_id: 'AIC-03',
    control: 'Human approval for high-impact agent actions',
    governance_area: 'Human Oversight',
    framework_reference: 'NIST AI RMF GOVERN 3.2, MANAGE 2.4; NIST AI 600-1 - Human-AI Configuration',
    required_evidence: 'Human approval workflow documentation',
    base_severity: 'CRITICAL',
    evaluate: () => {
      const highImpactCapable =
        a.can_modify_data || a.can_delete_data || a.can_execute_transactions || a.can_send_communications;
      if (!highImpactCapable) return { status: 'PRESENT', reason: 'The system performs no write, transactional or outbound-communication actions.' };
      if (a.human_approval === 'never') {
        return { status: 'GAP', reason: 'The agent performs high-impact actions with no human approval gate at any point in the flow.' };
      }
      if (a.human_approval === 'high_impact_only' && a.autonomy === 'fully_autonomous') {
        return { status: 'PARTIAL', reason: 'Approval is required for high-impact actions, but the agent otherwise operates fully autonomously and classifies impact itself.' };
      }
      return { status: 'PRESENT', reason: `Human approval is required (${a.human_approval.replace(/_/g, ' ')}).` };
    },
  },
  {
    control_id: 'AIC-04',
    control: 'Agent activity logging and auditability',
    governance_area: 'Auditability',
    framework_reference: 'NIST AI RMF MEASURE 2.8, MANAGE 4.1',
    required_evidence: 'Logging configuration',
    base_severity: 'HIGH',
    evaluate: () => {
      if (a.logging === 'none') return { status: 'GAP', reason: 'No logging of agent reasoning, tool invocations or outcomes exists, so agent behaviour cannot be reconstructed after an incident.' };
      if (a.logging === 'partial') return { status: 'PARTIAL', reason: 'Partial logging exists. Tool inputs, outputs and decision context may not be recoverable end to end.' };
      return { status: 'PRESENT', reason: 'Comprehensive logging of agent activity is in place.' };
    },
  },
  {
    control_id: 'AIC-05',
    control: 'Behavioural monitoring and anomaly detection',
    governance_area: 'Monitoring & Detection',
    framework_reference: 'NIST AI RMF MEASURE 3.1, MANAGE 4.1',
    required_evidence: 'Monitoring configuration',
    base_severity: 'HIGH',
    evaluate: () => {
      if (a.monitoring === 'none') return { status: 'GAP', reason: 'No monitoring exists, so abnormal agent behaviour would not be detected until it caused visible harm.' };
      if (a.monitoring === 'basic') return { status: 'PARTIAL', reason: 'Basic availability monitoring exists but there is no detection of anomalous agent behaviour or tool-use patterns.' };
      if (a.monitoring === 'alerting') return { status: 'PARTIAL', reason: 'Alerting is configured on failures but not on behavioural deviation (e.g. unusual tool sequences or volume).' };
      return { status: 'PRESENT', reason: 'Behavioural monitoring of agent activity is in place.' };
    },
  },
  {
    control_id: 'AIC-06',
    control: 'Secrets management for agent credentials',
    governance_area: 'Security Engineering',
    framework_reference: 'NIST AI RMF MEASURE 2.7; NIST AI 600-1 - Information Security',
    required_evidence: 'Secrets management configuration',
    base_severity: 'HIGH',
    evaluate: () => {
      if (a.secrets_management === 'hardcoded') return { status: 'GAP', reason: 'Credentials used by the AI system are hardcoded, which prevents rotation and increases the blast radius of a leak.' };
      if (a.secrets_management === 'env_vars') return { status: 'PARTIAL', reason: 'Credentials are held in environment variables. Rotation and access auditing are limited.' };
      return { status: 'PRESENT', reason: 'Credentials are held in a managed secrets store.' };
    },
  },
  {
    control_id: 'AIC-07',
    control: 'Prompt injection resistance and input validation',
    governance_area: 'AI Security',
    framework_reference: 'OWASP LLM Top 10 - LLM01 Prompt Injection; NIST AI 600-1 - Information Security',
    required_evidence: 'Architecture diagram / data flow diagram',
    base_severity: 'CRITICAL',
    evaluate: () => {
      const untrustedInput = a.can_call_external_apis || a.can_read_data || a.data_processed.length > 0;
      if (!untrustedInput) return { status: 'PARTIAL', reason: 'Untrusted input surface not established at intake. Confirm what content reaches the model context.' };
      if (a.is_agent && a.authorization !== 'least_privilege_scoped' && a.human_approval === 'never') {
        return { status: 'GAP', reason: 'The agent ingests content it does not control, holds broad permissions and requires no approval. Injected instructions in that content could drive real actions.' };
      }
      if (a.is_agent) {
        return { status: 'PARTIAL', reason: 'The agent ingests content it does not fully control. Injection defences (content isolation, output validation, tool-call allowlisting) are not evidenced at intake.' };
      }
      return { status: 'PARTIAL', reason: 'The system processes external content. Input handling and output validation should be evidenced.' };
    },
  },
  {
    control_id: 'AIC-08',
    control: 'Tool permission matrix / documented tool authorization',
    governance_area: 'Authorization',
    framework_reference: 'NIST AI RMF MAP 1.1, MANAGE 2.2',
    required_evidence: 'Tool permission matrix',
    base_severity: 'HIGH',
    evaluate: () => {
      if (!a.tool_access) return { status: 'PRESENT', reason: 'No tools are integrated, so no permission matrix is required.' };
      if (a.authorization === 'least_privilege_scoped') return { status: 'PARTIAL', reason: 'Scoped permissions are claimed but a per-tool permission matrix has not been provided as evidence.' };
      return { status: 'GAP', reason: `The agent can invoke ${a.tools.length} tool(s) (${a.tools.slice(0, 4).join(', ')}${a.tools.length > 4 ? ', ...' : ''}) without a documented matrix of which action each tool is permitted to perform.` };
    },
  },
  {
    control_id: 'AIC-09',
    control: 'Network egress restriction',
    governance_area: 'Security Engineering',
    framework_reference: 'NIST AI RMF MEASURE 2.7',
    required_evidence: 'Network / egress configuration',
    base_severity: 'MODERATE',
    evaluate: () => {
      if (a.network_access === 'unrestricted_internet') return { status: 'GAP', reason: 'The AI system has unrestricted outbound network access, which broadens both the data exfiltration path and the untrusted content it can reach.' };
      if (a.network_access === 'egress_restricted') return { status: 'PARTIAL', reason: 'Egress is restricted but the allowlist has not been evidenced.' };
      return { status: 'PRESENT', reason: 'The system operates without outbound internet access.' };
    },
  },
  {
    control_id: 'AIC-10',
    control: 'Data minimisation, retention and training-use controls',
    governance_area: 'Privacy',
    framework_reference: 'NIST AI RMF MEASURE 2.10; NIST AI 600-1 - Data Privacy',
    required_evidence: 'Data retention policy / privacy assessment',
    base_severity: 'HIGH',
    evaluate: () => {
      if (!a.sensitive_data && !a.personal_information) return { status: 'PRESENT', reason: 'No sensitive or personal data is processed by the system as described.' };
      if (a.training_data_usage === 'vendor_trains_on_data') return { status: 'GAP', reason: 'Sensitive or personal data is processed and the provider trains on submitted data, creating an uncontrolled secondary use.' };
      if (a.training_data_usage === 'unknown') return { status: 'GAP', reason: 'Sensitive or personal data is processed and it is not established whether the provider retains or trains on it.' };
      return { status: 'PARTIAL', reason: 'Sensitive or personal data is processed. Retention periods and deletion mechanics have not been evidenced.' };
    },
  },
  {
    control_id: 'AIC-11',
    control: 'Third-party AI risk assessment',
    governance_area: 'Third-Party Risk Management',
    framework_reference: 'NIST AI RMF GOVERN 6.1, MANAGE 3.1; NIST AI 600-1 - Value Chain and Component Integration',
    required_evidence: 'Vendor security documentation / SOC 2 report',
    base_severity: 'HIGH',
    evaluate: () => {
      if (!a.third_party) return { status: 'PRESENT', reason: 'The system is internally hosted with no external AI provider in scope.' };
      return { status: 'GAP', reason: `The system depends on ${a.vendor_name || a.model_provider || 'an external provider'}. A completed AI-specific vendor risk assessment has not been provided.` };
    },
  },
  {
    control_id: 'AIC-12',
    control: 'Failure handling, rollback and agent disengagement',
    governance_area: 'Resilience',
    framework_reference: 'NIST AI RMF MANAGE 2.3, MANAGE 2.4',
    required_evidence: 'Incident response procedure',
    base_severity: 'HIGH',
    evaluate: () => {
      const autonomous = ['semi_autonomous', 'fully_autonomous'].includes(a.autonomy);
      if (!a.is_agent) return { status: 'PARTIAL', reason: 'Error handling for incorrect model output has not been evidenced.' };
      if (autonomous && a.human_approval === 'never') return { status: 'GAP', reason: 'The agent acts autonomously with no approval gate and no evidenced ability to halt, reverse or contain an incorrect action.' };
      if (autonomous) return { status: 'PARTIAL', reason: 'The agent acts with meaningful autonomy. A documented disengagement and rollback path has not been evidenced.' };
      return { status: 'PARTIAL', reason: 'Rollback behaviour for incorrect agent actions has not been evidenced.' };
    },
  },
  {
    control_id: 'AIC-13',
    control: 'AI system documentation and pre-deployment risk assessment',
    governance_area: 'AI Governance',
    framework_reference: 'NIST AI RMF GOVERN 1.3, MAP 2.2, MAP 5.1',
    required_evidence: 'Model documentation / AI risk assessment',
    base_severity: 'MODERATE',
    evaluate: () => {
      if (!a.description || a.description.length < 80) {
        return { status: 'GAP', reason: 'The system description provided at intake is too thin to support a documented risk determination.' };
      }
      return { status: 'PARTIAL', reason: 'A description was provided at intake, but formal model documentation and a signed-off risk assessment have not been supplied.' };
    },
  },
];

/* --------------------------------------------------------------- evaluate */

const control_gaps = CATALOG.map((c) => {
  const { status, reason } = c.evaluate();

  let severity = c.base_severity;
  if (status === 'PRESENT') severity = 'LOW';
  else if (status === 'PARTIAL') severity = SEV[Math.max(0, SEV.indexOf(c.base_severity) - 1)];

  // Escalation: a gap matters more when the blast radius is larger.
  if (status === 'GAP') {
    if (a.business_impact === 'critical' || a.regulatory_sensitivity === 'high') {
      severity = escalate(severity);
    }
    if (norm.modifiers.autonomy >= 3 && norm.modifiers.tool_privilege >= 2) {
      severity = escalate(severity);
    }
  }

  return {
    control_id: c.control_id,
    control: c.control,
    status,
    severity,
    reason,
    recommendation: '', // filled by the Remediation stage
    governance_area: c.governance_area,
    framework_reference: c.framework_reference,
    required_evidence: c.required_evidence,
  };
});

const order = { GAP: 0, PARTIAL: 1, PRESENT: 2 };
const sevOrder = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3 };
control_gaps.sort(
  (x, y) => order[x.status] - order[y.status] || sevOrder[x.severity] - sevOrder[y.severity]
);

return [
  {
    json: {
      control_gaps,
      control_summary: {
        total: control_gaps.length,
        gaps: control_gaps.filter((c) => c.status === 'GAP').length,
        partial: control_gaps.filter((c) => c.status === 'PARTIAL').length,
        present: control_gaps.filter((c) => c.status === 'PRESENT').length,
      },
    },
  },
];
