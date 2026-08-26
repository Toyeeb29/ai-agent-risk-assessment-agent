/**
 * STAGE 7 - DETERMINISTIC RISK ENGINE
 * n8n Code node (Run Once for All Items).
 *
 * The LLM does not decide the risk score. This node does, from the normalized
 * intake and the deterministic control-gap results only. Same input in, same
 * score out, every time - which is what makes the assessment defensible.
 *
 *   Overall risk score = Impact x Likelihood x Exposure      (1 - 64)
 *
 * Each of the three factors is 1-4 and is derived from the six agent risk
 * modifiers produced at intake plus the observed control weaknesses:
 *
 *   Impact      <- data_sensitivity, human_impact, tool_privilege
 *   Likelihood  <- control weakness score + autonomy
 *   Exposure    <- external_exposure, third_party_dependency, network access
 *
 * Bands:  1-10 LOW | 11-24 MODERATE | 25-47 HIGH | 48-64 CRITICAL
 *
 * Domain scores (0-100) are computed separately so the dashboard can show
 * *where* the risk sits, not just how much of it there is.
 */

const norm = $('Normalize Input').first().json;
const a = norm.input;
const m = norm.modifiers;
const controls = $('Control Gap Analysis').first().json.control_gaps;

const ENGINE_VERSION = norm.engine_version;

const bucket = (value, thresholds) => {
  for (let i = 0; i < thresholds.length; i++) if (value <= thresholds[i]) return i + 1;
  return thresholds.length + 1;
};

const band100 = (s) => (s >= 75 ? 'CRITICAL' : s >= 50 ? 'HIGH' : s >= 25 ? 'MODERATE' : 'LOW');
const cap100 = (n) => Math.max(0, Math.min(100, Math.round(n)));

/* ------------------------------------------------------- control weakness */
/* Weighted, published weights. A weakness point is a missing or partial      */
/* control that makes a bad outcome MORE LIKELY (not more severe).            */

const WEAKNESS_WEIGHTS = {
  authentication: { none: 2, shared_api_key: 1, service_account: 1, oauth_delegated: 0, workload_identity: 0 },
  authorization: { none: 3, shared_role: 2, role_based: 1, least_privilege_scoped: 0 },
  logging: { none: 2, partial: 1, comprehensive: 0 },
  monitoring: { none: 2, basic: 1, alerting: 1, behavioral: 0 },
  secrets_management: { hardcoded: 2, env_vars: 1, secrets_manager: 0 },
  human_approval: { never: 2, high_impact_only: 1, always: 0 },
};

let weakness = 0;
const weaknessDrivers = [];
for (const [field, scale] of Object.entries(WEAKNESS_WEIGHTS)) {
  const points = scale[a[field]] ?? 0;
  weakness += points;
  if (points > 0) {
    weaknessDrivers.push(`${field.replace(/_/g, ' ')}: ${String(a[field]).replace(/_/g, ' ')} (+${points})`);
  }
}

// Prompt-injection surface: the agent consumes content it does not author.
const injectionSurface = a.is_agent && (a.can_call_external_apis || a.can_read_data);
if (injectionSurface) {
  weakness += 2;
  weaknessDrivers.push('agent ingests content it does not control - prompt injection surface (+2)');
}

/* --------------------------------------------------------------- factors */

// IMPACT - how bad is it if this goes wrong?
const impactRaw = m.data_sensitivity + m.human_impact + m.tool_privilege; // 0-12
const impact = bucket(impactRaw, [2, 5, 8]); // 1-4
const impactDrivers = [
  `Data sensitivity modifier: ${m.data_sensitivity}/4`,
  `Human impact modifier: ${m.human_impact}/4`,
  `Tool privilege modifier: ${m.tool_privilege}/4`,
  `Combined ${impactRaw}/12 -> Impact ${impact}/4`,
];

// LIKELIHOOD - how likely is a bad outcome, given the controls actually present?
const likelihoodRaw = weakness + m.autonomy; // 0-19
const likelihood = bucket(likelihoodRaw, [3, 7, 11]); // 1-4
const likelihoodDrivers = [
  ...weaknessDrivers,
  `Autonomy modifier: ${m.autonomy}/4`,
  `Combined ${likelihoodRaw}/19 -> Likelihood ${likelihood}/4`,
];

// EXPOSURE - how much reachable surface does this create?
const exposureRaw =
  m.external_exposure +
  m.third_party_dependency +
  (a.network_access === 'unrestricted_internet' ? 1 : 0); // 0-9
const exposure = bucket(exposureRaw, [1, 3, 6]); // 1-4
const exposureDrivers = [
  `External exposure modifier: ${m.external_exposure}/4`,
  `Third-party dependency modifier: ${m.third_party_dependency}/4`,
  `Network access: ${a.network_access.replace(/_/g, ' ')}`,
  `Combined ${exposureRaw}/9 -> Exposure ${exposure}/4`,
];

const score = impact * likelihood * exposure; // 1-64
const band = score >= 48 ? 'CRITICAL' : score >= 25 ? 'HIGH' : score >= 11 ? 'MODERATE' : 'LOW';

/* --------------------------------------------------------- domain scores */

const gapCount = (ids) =>
  controls.filter((c) => ids.includes(c.control_id) && c.status === 'GAP').length;

const domains = [];

/* Privacy */
{
  const drivers = [];
  let s = 0;
  if (a.personal_information) { s += 30; drivers.push('Processes personal information'); }
  if (a.sensitive_data) { s += 25; drivers.push('Processes sensitive data'); }
  if (a.training_data_usage === 'vendor_trains_on_data') { s += 20; drivers.push('Provider trains on submitted data'); }
  else if (a.training_data_usage === 'unknown') { s += 15; drivers.push('Training/retention use of submitted data unknown'); }
  if (a.regulatory_sensitivity === 'high') { s += 15; drivers.push('High regulatory sensitivity'); }
  else if (a.regulatory_sensitivity === 'moderate') { s += 8; drivers.push('Moderate regulatory sensitivity'); }
  if (a.can_send_communications) { s += 10; drivers.push('Can send outbound communications containing processed data'); }
  if (gapCount(['AIC-10'])) { s += 10; drivers.push('Data minimisation / retention control gap'); }
  if (!drivers.length) drivers.push('No personal or sensitive data identified at intake');
  domains.push({ domain: 'Privacy', score: cap100(s), band: band100(cap100(s)), drivers });
}

/* Security */
{
  const drivers = [];
  let s = weakness * 6;
  drivers.push(`Control weakness score ${weakness}/17`);
  if (a.network_access === 'unrestricted_internet') { s += 15; drivers.push('Unrestricted outbound network access'); }
  if (a.secrets_management === 'hardcoded') { s += 10; drivers.push('Hardcoded credentials'); }
  if (injectionSurface) { s += 12; drivers.push('Prompt injection surface present'); }
  if (gapCount(['AIC-01', 'AIC-06', 'AIC-07', 'AIC-09'])) {
    s += gapCount(['AIC-01', 'AIC-06', 'AIC-07', 'AIC-09']) * 6;
    drivers.push(`${gapCount(['AIC-01', 'AIC-06', 'AIC-07', 'AIC-09'])} security control gap(s)`);
  }
  domains.push({ domain: 'Security', score: cap100(s), band: band100(cap100(s)), drivers });
}

/* Agentic Risk */
{
  const drivers = [];
  let s = 0;
  if (!a.is_agent) {
    s = a.ai_type === 'ml_model' ? 5 : 15;
    drivers.push('Not registered as an AI agent - no autonomous tool use in scope');
  } else {
    s += m.autonomy * 15; drivers.push(`Autonomy level: ${a.autonomy.replace(/_/g, ' ')} (${m.autonomy}/4)`);
    s += m.tool_privilege * 12; drivers.push(`Tool privilege: ${m.tool_privilege}/4`);
    if (a.human_approval === 'never') { s += 20; drivers.push('No human approval gate'); }
    else if (a.human_approval === 'high_impact_only') { s += 8; drivers.push('Approval limited to self-classified high-impact actions'); }
    if (a.can_call_external_apis) { s += 8; drivers.push('Calls external APIs'); }
    if (a.monitoring === 'none') { s += 10; drivers.push('No behavioural monitoring of agent activity'); }
    if (a.can_delete_data) { s += 8; drivers.push('Holds delete permissions'); }
  }
  domains.push({ domain: 'Agentic Risk', score: cap100(s), band: band100(cap100(s)), drivers });
}

/* TPRM */
{
  const drivers = [];
  let s = 0;
  if (!a.third_party) {
    s = 10;
    drivers.push('Internally hosted - no external AI provider in scope');
  } else {
    s += 30; drivers.push(`External provider in scope: ${a.vendor_name || a.model_provider}`);
    if (a.training_data_usage === 'vendor_trains_on_data') { s += 20; drivers.push('Provider trains on submitted data'); }
    else if (a.training_data_usage === 'unknown') { s += 12; drivers.push('Provider data-use terms not established'); }
    if (a.sensitive_data || a.personal_information) { s += 18; drivers.push('Sensitive or personal data leaves the organisation'); }
    if (gapCount(['AIC-11'])) { s += 15; drivers.push('No completed AI-specific vendor risk assessment'); }
    if (a.business_impact === 'critical' || a.business_impact === 'high') { s += 10; drivers.push('Provider supports a high-impact business process'); }
  }
  domains.push({ domain: 'TPRM', score: cap100(s), band: band100(cap100(s)), drivers });
}

/* Governance */
{
  const drivers = [];
  let s = 0;
  s += { low: 10, moderate: 25, high: 40, critical: 55 }[a.business_impact];
  drivers.push(`Business impact: ${a.business_impact}`);
  if (a.regulatory_sensitivity === 'high') { s += 15; drivers.push('High regulatory sensitivity'); }
  else if (a.regulatory_sensitivity === 'moderate') { s += 8; drivers.push('Moderate regulatory sensitivity'); }
  if (a.affected_users >= 1000) { s += 10; drivers.push(`${a.affected_users.toLocaleString()} affected users`); }
  if (gapCount(['AIC-13'])) { s += 12; drivers.push('No pre-deployment AI risk documentation'); }
  if (gapCount(['AIC-03'])) { s += 12; drivers.push('No human oversight gate defined'); }
  if (gapCount(['AIC-04'])) { s += 8; drivers.push('Agent activity not auditable'); }
  domains.push({ domain: 'Governance', score: cap100(s), band: band100(cap100(s)), drivers });
}

/* ---------------------------------------------------------------- output */

const LABELS = { 1: 'Low', 2: 'Moderate', 3: 'High', 4: 'Severe' };

return [
  {
    json: {
      risk: {
        score,
        max_score: 64,
        band,
        factors: {
          impact: { value: impact, label: LABELS[impact], drivers: impactDrivers },
          likelihood: { value: likelihood, label: LABELS[likelihood], drivers: likelihoodDrivers },
          exposure: { value: exposure, label: LABELS[exposure], drivers: exposureDrivers },
        },
        modifiers: m,
        domains,
        methodology: {
          formula: 'Risk Score = Impact (1-4) x Likelihood (1-4) x Exposure (1-4), range 1-64',
          bands: [
            { band: 'LOW', range: '1-10' },
            { band: 'MODERATE', range: '11-24' },
            { band: 'HIGH', range: '25-47' },
            { band: 'CRITICAL', range: '48-64' },
          ],
          engine_version: ENGINE_VERSION,
        },
      },
      weakness_score: weakness,
    },
  },
];
