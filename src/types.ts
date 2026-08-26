/**
 * Shared contract between the portfolio frontend and the self-hosted n8n workflow.
 *
 * The frontend NEVER computes risk. It serialises an `AssessmentInput`, POSTs it to
 * the n8n webhook, and renders whatever `AssessmentResult` comes back. Every number,
 * band, gap and sentence on the results screen originates in n8n.
 *
 * Keep this file in sync with `n8n/code/01-normalize-input.js` (input) and
 * `n8n/code/06-assemble-final.js` (output). `schema_version` guards drift.
 */

export const SCHEMA_VERSION = '1.0.0';

/* -------------------------------------------------------------------------- */
/* Input                                                                       */
/* -------------------------------------------------------------------------- */

export type AiType =
  | 'genai_assistant'
  | 'ai_agent'
  | 'llm_application'
  | 'ml_model'
  | 'ai_saas_feature';

export type Hosting = 'internal' | 'third_party';

export type TrainingDataUsage =
  | 'none'
  | 'vendor_trains_on_data'
  | 'used_internally_for_tuning'
  | 'unknown';

export type Autonomy =
  | 'none'
  | 'suggest_only'
  | 'human_in_the_loop'
  | 'semi_autonomous'
  | 'fully_autonomous';

export type HumanApproval = 'always' | 'high_impact_only' | 'never';

export type Authentication =
  | 'none'
  | 'shared_api_key'
  | 'service_account'
  | 'oauth_delegated'
  | 'workload_identity';

export type Authorization =
  | 'none'
  | 'shared_role'
  | 'role_based'
  | 'least_privilege_scoped';

export type Logging = 'none' | 'partial' | 'comprehensive';
export type Monitoring = 'none' | 'basic' | 'alerting' | 'behavioral';
export type SecretsManagement = 'hardcoded' | 'env_vars' | 'secrets_manager';
export type NetworkAccess = 'internal_only' | 'egress_restricted' | 'unrestricted_internet';
export type BusinessImpact = 'low' | 'moderate' | 'high' | 'critical';
export type RegulatorySensitivity = 'none' | 'moderate' | 'high';

export interface AssessmentInput {
  schema_version: string;

  /* Basic information */
  system_name: string;
  business_owner: string;
  department: string;
  business_purpose: string;
  description: string;

  /* AI information */
  ai_type: AiType;
  model_provider: string;
  hosting: Hosting;
  data_processed: string[];
  sensitive_data: boolean;
  personal_information: boolean;
  training_data_usage: TrainingDataUsage;

  /* Agentic information */
  is_agent: boolean;
  tool_access: boolean;
  tools: string[];
  can_read_data: boolean;
  can_modify_data: boolean;
  can_delete_data: boolean;
  can_send_communications: boolean;
  can_execute_transactions: boolean;
  can_call_external_apis: boolean;
  autonomy: Autonomy;
  human_approval: HumanApproval;

  /* Security */
  authentication: Authentication;
  authorization: Authorization;
  logging: Logging;
  monitoring: Monitoring;
  secrets_management: SecretsManagement;
  network_access: NetworkAccess;

  /* Governance */
  business_impact: BusinessImpact;
  affected_users: number;
  regulatory_sensitivity: RegulatorySensitivity;
  regulatory_context: string[];
  third_party: boolean;
  vendor_name: string;
}

/* -------------------------------------------------------------------------- */
/* Output                                                                      */
/* -------------------------------------------------------------------------- */

export type RiskBand = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type Severity = RiskBand;
export type ControlStatus = 'PRESENT' | 'PARTIAL' | 'GAP';
export type EvidenceStatus = 'PROVIDED' | 'PARTIAL' | 'MISSING';
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ScoreFactor {
  /** 1-4 */
  value: number;
  label: string;
  drivers: string[];
}

export interface RiskModifiers {
  autonomy: number;
  tool_privilege: number;
  data_sensitivity: number;
  external_exposure: number;
  human_impact: number;
  third_party_dependency: number;
}

export interface DomainScore {
  domain: 'Privacy' | 'Security' | 'Agentic Risk' | 'TPRM' | 'Governance' | 'Model Risk';
  score: number; // 0-100
  band: RiskBand;
  drivers: string[];
}

export interface RiskAssessmentScore {
  score: number; // 1-64
  max_score: number; // 64
  band: RiskBand;
  factors: {
    impact: ScoreFactor;
    likelihood: ScoreFactor;
    exposure: ScoreFactor;
  };
  modifiers: RiskModifiers;
  domains: DomainScore[];
  methodology: {
    formula: string;
    bands: { band: RiskBand; range: string }[];
    engine_version: string;
  };
}

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  category: string;
  finding: string;
  business_impact: string;
  recommendation: string;
  /** 'ai' = LLM-generated narrative, 'deterministic' = rule-derived */
  source: 'ai' | 'deterministic';
  agentic_dimension?: string;
}

export interface AgenticDimensionResult {
  dimension: string;
  status: 'ADEQUATE' | 'WEAK' | 'ABSENT' | 'UNKNOWN';
  observation: string;
  risk: string;
  recommendation: string;
}

export interface GovernanceMapping {
  id: string;
  risk: string;
  governance_area: string;
  framework_reference: string;
  recommended_control: string;
  required_evidence: string;
  rationale: string;
  /** Always true: mappings are illustrative, not a certified crosswalk. */
  illustrative: boolean;
}

export interface ControlGap {
  control_id: string;
  control: string;
  status: ControlStatus;
  severity: Severity;
  reason: string;
  recommendation: string;
  governance_area: string;
}

export interface EvidenceGap {
  evidence: string;
  status: EvidenceStatus;
  risk: Severity;
  owner: string;
  why_required: string;
}

export interface RemediationItem {
  id: string;
  priority: Priority;
  sla: 'Immediate' | '30 days' | '60 days' | '90 days';
  action: string;
  rationale: string;
  owner: string;
  linked_controls: string[];
}

export interface TprmResult {
  vendor: string;
  vendor_risk_band: RiskBand;
  critical_findings: string[];
  missing_evidence: string[];
  recommended_questions: string[];
  remediation: string[];
}

export interface ExecutiveSummary {
  overall_risk: RiskBand;
  primary_risk: string;
  top_risks: string[];
  top_recommendations: string[];
  business_narrative: string;
  recommended_decision:
    | 'APPROVE'
    | 'APPROVE_WITH_CONDITIONS'
    | 'REQUIRES_GOVERNANCE_REVIEW'
    | 'DO_NOT_APPROVE';
  human_review_required: boolean;
}

export interface AuditRecord {
  assessment_id: string;
  timestamp: string;
  system: string;
  engine_version: string;
  schema_version: string;
  input_fingerprint: string;
  ai_model: string;
  stages_completed: string[];
  /** LLM stages that returned malformed output; deterministic content was retained. */
  degraded_stages: string[];
  risk_score: number;
  risk_band: RiskBand;
  control_gap_count: number;
  evidence_gap_count: number;
  final_status: string;
}

export interface AssessmentResult {
  assessment_id: string;
  generated_at: string;
  schema_version: string;
  system: {
    name: string;
    owner: string;
    department: string;
    purpose: string;
    ai_type: AiType;
    model_provider: string;
    hosting: Hosting;
    is_agent: boolean;
    third_party: boolean;
  };
  risk: RiskAssessmentScore;
  findings: Finding[];
  agentic_analysis: AgenticDimensionResult[];
  governance_mappings: GovernanceMapping[];
  control_gaps: ControlGap[];
  evidence_gaps: EvidenceGap[];
  remediation_plan: RemediationItem[];
  tprm: TprmResult | null;
  executive_summary: ExecutiveSummary;
  audit_record: AuditRecord;
  disclaimer: string;
}

/* -------------------------------------------------------------------------- */
/* Transport                                                                   */
/* -------------------------------------------------------------------------- */

export interface AssessmentErrorResponse {
  ok: false;
  error: string;
  details?: string[];
  assessment_id?: string;
}

export type AssessmentResponse = AssessmentResult | AssessmentErrorResponse;

export function isErrorResponse(r: AssessmentResponse): r is AssessmentErrorResponse {
  return (r as AssessmentErrorResponse).ok === false;
}
