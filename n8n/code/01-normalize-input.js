/**
 * STAGE 1 - INTAKE: Validate & Normalize Input
 * n8n Code node (Run Once for All Items). Input: Webhook node.
 *
 * Responsibilities:
 *   - reject malformed submissions before a single token is spent on an LLM
 *   - coerce every field to a known enum / boolean / number (no free-text enums)
 *   - derive the six agent risk modifiers used by the deterministic risk engine
 *   - mint the assessment ID and an input fingerprint for the audit record
 *
 * NOTHING here calls an LLM. This is the trust boundary of the workflow.
 */

const ENGINE_VERSION = '1.0.0';
const SCHEMA_VERSION = '1.0.0';

const ENUMS = {
  ai_type: ['genai_assistant', 'ai_agent', 'llm_application', 'ml_model', 'ai_saas_feature'],
  hosting: ['internal', 'third_party'],
  training_data_usage: ['none', 'vendor_trains_on_data', 'used_internally_for_tuning', 'unknown'],
  autonomy: ['none', 'suggest_only', 'human_in_the_loop', 'semi_autonomous', 'fully_autonomous'],
  human_approval: ['always', 'high_impact_only', 'never'],
  authentication: ['none', 'shared_api_key', 'service_account', 'oauth_delegated', 'workload_identity'],
  authorization: ['none', 'shared_role', 'role_based', 'least_privilege_scoped'],
  logging: ['none', 'partial', 'comprehensive'],
  monitoring: ['none', 'basic', 'alerting', 'behavioral'],
  secrets_management: ['hardcoded', 'env_vars', 'secrets_manager'],
  network_access: ['internal_only', 'egress_restricted', 'unrestricted_internet'],
  business_impact: ['low', 'moderate', 'high', 'critical'],
  regulatory_sensitivity: ['none', 'moderate', 'high'],
};

const REQUIRED_TEXT = ['system_name', 'business_owner', 'department', 'business_purpose'];

/* ------------------------------------------------------------------ helpers */

function str(v, max = 2000) {
  if (v === null || v === undefined) return '';
  // Strip control characters so nothing can smuggle formatting into a prompt.
  return String(v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
}

function bool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return ['true', 'yes', '1'].includes(v.toLowerCase());
  return Boolean(v);
}

function num(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function list(v, maxItems = 25) {
  if (Array.isArray(v)) return v.map((x) => str(x, 120)).filter(Boolean).slice(0, maxItems);
  if (typeof v === 'string' && v.trim()) {
    return v.split(/[,;\n]/).map((x) => str(x, 120)).filter(Boolean).slice(0, maxItems);
  }
  return [];
}

function enumOf(field, v, fallback) {
  const allowed = ENUMS[field];
  const candidate = str(v, 60).toLowerCase().replace(/[\s-]+/g, '_');
  return allowed.includes(candidate) ? candidate : fallback;
}

function clamp4(n) {
  return Math.max(0, Math.min(4, n));
}

function fingerprint(obj) {
  // Small, dependency-free FNV-1a hash. Enough to detect "same input, same run"
  // in the audit record; it is not a security control.
  const s = JSON.stringify(obj);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return 'fp_' + h.toString(16).padStart(8, '0');
}

/* -------------------------------------------------------------------- input */

const raw = $input.first().json.body ?? $input.first().json ?? {};
const errors = [];

for (const field of REQUIRED_TEXT) {
  if (!str(raw[field])) errors.push(`Missing required field: ${field}`);
}
if (!ENUMS.ai_type.includes(str(raw.ai_type).toLowerCase())) {
  errors.push(`ai_type must be one of: ${ENUMS.ai_type.join(', ')}`);
}

if (errors.length) {
  return [
    {
      json: {
        valid: false,
        ok: false,
        error: 'Assessment input failed validation',
        details: errors,
        schema_version: SCHEMA_VERSION,
      },
    },
  ];
}

/* ---------------------------------------------------------------- normalize */

const input = {
  schema_version: SCHEMA_VERSION,

  system_name: str(raw.system_name, 160),
  business_owner: str(raw.business_owner, 160),
  department: str(raw.department, 160),
  business_purpose: str(raw.business_purpose, 1200),
  description: str(raw.description, 4000),

  ai_type: enumOf('ai_type', raw.ai_type, 'llm_application'),
  model_provider: str(raw.model_provider, 160) || 'Not specified',
  hosting: enumOf('hosting', raw.hosting, 'third_party'),
  data_processed: list(raw.data_processed),
  sensitive_data: bool(raw.sensitive_data),
  personal_information: bool(raw.personal_information),
  training_data_usage: enumOf('training_data_usage', raw.training_data_usage, 'unknown'),

  is_agent: bool(raw.is_agent),
  tool_access: bool(raw.tool_access),
  tools: list(raw.tools),
  can_read_data: bool(raw.can_read_data),
  can_modify_data: bool(raw.can_modify_data),
  can_delete_data: bool(raw.can_delete_data),
  can_send_communications: bool(raw.can_send_communications),
  can_execute_transactions: bool(raw.can_execute_transactions),
  can_call_external_apis: bool(raw.can_call_external_apis),
  autonomy: enumOf('autonomy', raw.autonomy, 'none'),
  human_approval: enumOf('human_approval', raw.human_approval, 'never'),

  authentication: enumOf('authentication', raw.authentication, 'none'),
  authorization: enumOf('authorization', raw.authorization, 'none'),
  logging: enumOf('logging', raw.logging, 'none'),
  monitoring: enumOf('monitoring', raw.monitoring, 'none'),
  secrets_management: enumOf('secrets_management', raw.secrets_management, 'env_vars'),
  network_access: enumOf('network_access', raw.network_access, 'egress_restricted'),

  business_impact: enumOf('business_impact', raw.business_impact, 'moderate'),
  affected_users: num(raw.affected_users, 0, 100000000, 0),
  regulatory_sensitivity: enumOf('regulatory_sensitivity', raw.regulatory_sensitivity, 'none'),
  regulatory_context: list(raw.regulatory_context, 12),
  third_party: bool(raw.third_party) || enumOf('hosting', raw.hosting, 'third_party') === 'third_party',
  vendor_name: str(raw.vendor_name, 160),
};

// A non-agent system cannot have agent capabilities. Normalising this here stops
// contradictory intake data from inflating the agentic score downstream.
if (!input.is_agent) {
  input.tool_access = false;
  input.tools = [];
  input.can_modify_data = false;
  input.can_delete_data = false;
  input.can_execute_transactions = false;
  input.can_send_communications = false;
  input.autonomy = input.autonomy === 'none' ? 'none' : 'suggest_only';
}
if (!input.tool_access) input.tools = [];

/* --------------------------------------------------- agent risk modifiers */
/* Each modifier is 0-4. They are the documented, auditable inputs to the      */
/* Impact x Likelihood x Exposure calculation in stage 7.                      */

const AUTONOMY_SCALE = {
  none: 0,
  suggest_only: 1,
  human_in_the_loop: 2,
  semi_autonomous: 3,
  fully_autonomous: 4,
};

const modifiers = {
  autonomy: AUTONOMY_SCALE[input.autonomy],

  tool_privilege: clamp4(
    (input.can_modify_data ? 1 : 0) +
      (input.can_delete_data ? 1 : 0) +
      (input.can_execute_transactions ? 1 : 0) +
      (input.can_send_communications ? 1 : 0)
  ),

  data_sensitivity: clamp4(
    (input.sensitive_data ? 2 : 0) +
      (input.personal_information ? 1 : 0) +
      (['vendor_trains_on_data', 'unknown'].includes(input.training_data_usage) ? 1 : 0)
  ),

  external_exposure: clamp4(
    (input.can_call_external_apis ? 1 : 0) +
      (input.network_access === 'unrestricted_internet' ? 1 : 0) +
      (input.hosting === 'third_party' ? 1 : 0) +
      (input.can_send_communications ? 1 : 0)
  ),

  human_impact: clamp4(
    { low: 1, moderate: 2, high: 3, critical: 4 }[input.business_impact] +
      (input.affected_users >= 1000 ? 1 : 0)
  ),

  third_party_dependency: clamp4(
    input.third_party
      ? 2 +
          (input.training_data_usage === 'vendor_trains_on_data' ? 1 : 0) +
          (input.regulatory_sensitivity === 'high' ? 1 : 0)
      : 0
  ),
};

/* ------------------------------------------------------------------ output */

const now = new Date();
const assessmentId =
  'AIRA-' +
  now.toISOString().slice(0, 10).replace(/-/g, '') +
  '-' +
  Math.random().toString(36).slice(2, 8).toUpperCase();

return [
  {
    json: {
      valid: true,
      assessment_id: assessmentId,
      generated_at: now.toISOString(),
      engine_version: ENGINE_VERSION,
      schema_version: SCHEMA_VERSION,
      input_fingerprint: fingerprint(input),
      input,
      modifiers,
    },
  },
];
