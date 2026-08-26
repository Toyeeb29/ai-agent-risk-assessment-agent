/**
 * Declarative intake schema.
 *
 * The form is generated from this, so the questions a GRC analyst is asked live
 * in one reviewable place rather than being scattered through JSX. Every `name`
 * here must exist in `AssessmentInput` and in the n8n Normalize Input node.
 *
 * `helper` text matters more than it looks: half the value of an intake form is
 * that the person filling it in understands what the question is actually asking.
 */

import type { AssessmentInput } from '../types';

export type FieldKind = 'text' | 'textarea' | 'select' | 'boolean' | 'number' | 'tags';

export interface Field {
  name: keyof AssessmentInput;
  label: string;
  kind: FieldKind;
  helper?: string;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** Only show this field when the predicate passes (e.g. agent-only questions). */
  showIf?: (v: AssessmentInput) => boolean;
}

export interface FieldGroup {
  id: string;
  title: string;
  intro: string;
  fields: Field[];
}

const isAgent = (v: AssessmentInput) => v.is_agent;

export const FORM_GROUPS: FieldGroup[] = [
  {
    id: 'basic',
    title: 'Basic information',
    intro: 'Who owns this system and what is it for. This establishes accountability before anything else.',
    fields: [
      { name: 'system_name', label: 'AI system name', kind: 'text', required: true, placeholder: 'Aurora Support Resolution Agent' },
      { name: 'business_owner', label: 'Business owner', kind: 'text', required: true, helper: 'The named person accountable for this system, not the engineering team.', placeholder: 'D. Okafor, Director of Customer Operations' },
      { name: 'department', label: 'Department', kind: 'text', required: true, placeholder: 'Customer Operations' },
      { name: 'business_purpose', label: 'Business purpose', kind: 'textarea', required: true, helper: 'What business outcome does this system exist to produce?' },
      { name: 'description', label: 'Description', kind: 'textarea', helper: 'How it works: what it reads, what it decides, what it does. The more specific this is, the more useful the assessment.' },
    ],
  },
  {
    id: 'ai',
    title: 'AI information',
    intro: 'What kind of AI this is, whose model it uses, and what data reaches it.',
    fields: [
      {
        name: 'ai_type',
        label: 'AI type',
        kind: 'select',
        required: true,
        options: [
          { value: 'ai_agent', label: 'AI agent (can invoke tools and take actions)' },
          { value: 'genai_assistant', label: 'Generative AI assistant (text in, text out)' },
          { value: 'llm_application', label: 'LLM-backed application feature' },
          { value: 'ai_saas_feature', label: 'AI feature inside a purchased SaaS product' },
          { value: 'ml_model', label: 'Traditional ML model (prediction/classification)' },
        ],
      },
      { name: 'model_provider', label: 'Model / provider', kind: 'text', placeholder: 'OpenAI GPT-4o via vendor SaaS platform' },
      {
        name: 'hosting',
        label: 'Internal or third-party',
        kind: 'select',
        options: [
          { value: 'third_party', label: 'Third-party (model or product hosted outside the organisation)' },
          { value: 'internal', label: 'Internal (self-hosted, inside our boundary)' },
        ],
      },
      { name: 'data_processed', label: 'Data processed', kind: 'tags', helper: 'One data category per line. Be specific: "customer billing history" tells the assessment more than "customer data".' },
      { name: 'sensitive_data', label: 'Processes sensitive data', kind: 'boolean', helper: 'Financial, health, credentials, confidential business data.' },
      { name: 'personal_information', label: 'Processes personal information', kind: 'boolean', helper: 'Any data that identifies or relates to an identifiable person.' },
      {
        name: 'training_data_usage',
        label: 'Model training / data usage',
        kind: 'select',
        helper: 'What happens to the data after it is submitted to the model.',
        options: [
          { value: 'none', label: 'Not used for training or improvement (contractually established)' },
          { value: 'vendor_trains_on_data', label: 'Provider may train on submitted data' },
          { value: 'used_internally_for_tuning', label: 'Used internally for tuning or evaluation' },
          { value: 'unknown', label: 'Not established' },
        ],
      },
    ],
  },
  {
    id: 'agentic',
    title: 'Agentic information',
    intro: 'What the system can actually DO. This section drives the agentic risk analysis and most of the risk score.',
    fields: [
      { name: 'is_agent', label: 'Is this an AI agent?', kind: 'boolean', helper: 'Can it invoke tools or take actions, rather than only producing text for a person to act on?' },
      { name: 'tool_access', label: 'Can it access tools?', kind: 'boolean', showIf: isAgent },
      { name: 'tools', label: 'What tools?', kind: 'tags', helper: 'One per line, with the access level. E.g. "Zendesk API (read/write tickets)".', showIf: (v) => v.is_agent && v.tool_access },
      { name: 'can_read_data', label: 'Can it read data?', kind: 'boolean', showIf: isAgent },
      { name: 'can_modify_data', label: 'Can it modify data?', kind: 'boolean', showIf: isAgent },
      { name: 'can_delete_data', label: 'Can it delete data?', kind: 'boolean', showIf: isAgent },
      { name: 'can_send_communications', label: 'Can it send communications?', kind: 'boolean', helper: 'Email, chat, SMS, or anything else that reaches a person outside the system.', showIf: isAgent },
      { name: 'can_execute_transactions', label: 'Can it execute transactions?', kind: 'boolean', helper: 'Payments, credits, refunds, orders, provisioning.', showIf: isAgent },
      { name: 'can_call_external_apis', label: 'Can it call external APIs?', kind: 'boolean', showIf: isAgent },
      {
        name: 'autonomy',
        label: 'Does it operate autonomously?',
        kind: 'select',
        showIf: isAgent,
        options: [
          { value: 'none', label: 'No autonomy - a person triggers every action' },
          { value: 'suggest_only', label: 'Suggests only - a person performs the action' },
          { value: 'human_in_the_loop', label: 'Human in the loop - acts, but a person confirms each step' },
          { value: 'semi_autonomous', label: 'Semi-autonomous - chains actions, escalates some to a person' },
          { value: 'fully_autonomous', label: 'Fully autonomous - completes tasks end to end unattended' },
        ],
      },
      {
        name: 'human_approval',
        label: 'Is human approval required?',
        kind: 'select',
        showIf: isAgent,
        options: [
          { value: 'always', label: 'Always - every action is approved before it takes effect' },
          { value: 'high_impact_only', label: 'High-impact actions only' },
          { value: 'never', label: 'Never - no approval gate exists' },
        ],
      },
    ],
  },
  {
    id: 'security',
    title: 'Security',
    intro: 'The controls that determine how likely a bad outcome is, and whether anyone would notice.',
    fields: [
      {
        name: 'authentication',
        label: 'Authentication mechanism',
        kind: 'select',
        helper: 'How the AI system proves who it is to the systems it calls.',
        options: [
          { value: 'workload_identity', label: 'Workload identity / federated short-lived credentials' },
          { value: 'oauth_delegated', label: 'OAuth - acts as the requesting user' },
          { value: 'service_account', label: 'Dedicated service account' },
          { value: 'shared_api_key', label: 'Shared API key' },
          { value: 'none', label: 'No distinct identity' },
        ],
      },
      {
        name: 'authorization',
        label: 'Authorization mechanism',
        kind: 'select',
        helper: 'What it is permitted to do once authenticated.',
        options: [
          { value: 'least_privilege_scoped', label: 'Least privilege - scoped per tool and action' },
          { value: 'role_based', label: 'Role-based - holds an application role' },
          { value: 'shared_role', label: 'Shared role with human users or other services' },
          { value: 'none', label: 'No defined authorization model' },
        ],
      },
      {
        name: 'logging',
        label: 'Logging',
        kind: 'select',
        options: [
          { value: 'comprehensive', label: 'Comprehensive - prompts, tool calls, outputs and outcomes' },
          { value: 'partial', label: 'Partial - some activity is logged' },
          { value: 'none', label: 'None' },
        ],
      },
      {
        name: 'monitoring',
        label: 'Monitoring',
        kind: 'select',
        options: [
          { value: 'behavioral', label: 'Behavioural - detects abnormal agent activity patterns' },
          { value: 'alerting', label: 'Alerting on errors and failures' },
          { value: 'basic', label: 'Basic availability monitoring' },
          { value: 'none', label: 'None' },
        ],
      },
      {
        name: 'secrets_management',
        label: 'Secrets management',
        kind: 'select',
        options: [
          { value: 'secrets_manager', label: 'Managed secrets store with rotation' },
          { value: 'env_vars', label: 'Environment variables' },
          { value: 'hardcoded', label: 'Hardcoded in configuration or source' },
        ],
      },
      {
        name: 'network_access',
        label: 'Network access',
        kind: 'select',
        options: [
          { value: 'internal_only', label: 'Internal only - no outbound internet access' },
          { value: 'egress_restricted', label: 'Egress restricted to an allowlist' },
          { value: 'unrestricted_internet', label: 'Unrestricted outbound internet access' },
        ],
      },
    ],
  },
  {
    id: 'governance',
    title: 'Governance',
    intro: 'Blast radius. How much of the business, and how many people, are exposed to this system being wrong.',
    fields: [
      {
        name: 'business_impact',
        label: 'Business impact',
        kind: 'select',
        helper: 'If this system failed or acted incorrectly, how badly would the business be affected?',
        options: [
          { value: 'critical', label: 'Critical - core revenue or safety process' },
          { value: 'high', label: 'High - significant customer or operational impact' },
          { value: 'moderate', label: 'Moderate - contained operational impact' },
          { value: 'low', label: 'Low - limited internal impact' },
        ],
      },
      { name: 'affected_users', label: 'Number of affected users', kind: 'number', helper: 'People whose data or experience this system touches.' },
      {
        name: 'regulatory_sensitivity',
        label: 'Regulatory sensitivity',
        kind: 'select',
        options: [
          { value: 'high', label: 'High - regulated data or automated decisions about people' },
          { value: 'moderate', label: 'Moderate - some regulatory relevance' },
          { value: 'none', label: 'None identified' },
        ],
      },
      { name: 'regulatory_context', label: 'Regulatory context', kind: 'tags', helper: 'One per line. E.g. GDPR, HIPAA, PCI DSS, EU AI Act, SOC 2.' },
      { name: 'third_party', label: 'Vendor involvement', kind: 'boolean', helper: 'Does this system depend on an external provider? Turning this on runs the TPRM branch of the workflow.' },
      { name: 'vendor_name', label: 'Vendor name', kind: 'text', showIf: (v) => v.third_party },
    ],
  },
];

export const EMPTY_INPUT: AssessmentInput = {
  schema_version: '1.0.0',
  system_name: '',
  business_owner: '',
  department: '',
  business_purpose: '',
  description: '',
  ai_type: 'ai_agent',
  model_provider: '',
  hosting: 'third_party',
  data_processed: [],
  sensitive_data: false,
  personal_information: false,
  training_data_usage: 'unknown',
  is_agent: true,
  tool_access: false,
  tools: [],
  can_read_data: false,
  can_modify_data: false,
  can_delete_data: false,
  can_send_communications: false,
  can_execute_transactions: false,
  can_call_external_apis: false,
  autonomy: 'none',
  human_approval: 'always',
  authentication: 'none',
  authorization: 'none',
  logging: 'none',
  monitoring: 'none',
  secrets_management: 'env_vars',
  network_access: 'egress_restricted',
  business_impact: 'moderate',
  affected_users: 0,
  regulatory_sensitivity: 'none',
  regulatory_context: [],
  third_party: true,
  vendor_name: '',
};
