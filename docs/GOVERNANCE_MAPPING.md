# Governance mapping and control catalog

> **Illustrative mapping.** The references below show how each control relates to
> published governance frameworks so that a GRC team can slot findings into an
> existing programme. They are **not a certified crosswalk**, they are not endorsed
> by any standards body, and nothing in this project constitutes a claim of
> compliance with NIST AI RMF, NIST AI 600-1, ISO/IEC 42001, OWASP, or any other
> standard. Validate every mapping against your own control library before use.

## Why the mapping is deterministic

Framework references are the single most dangerous thing to let a language model
generate in a GRC artefact. A fabricated `MANAGE 4.7` reads exactly like a real one
to the person reviewing the report, and it will be copied into a control library and
cited in an audit. So in this workflow the model never emits one.

The catalog below is fixed in
[`n8n/code/02-control-gap-analysis.js`](../n8n/code/02-control-gap-analysis.js).
The **Governance Mapping Agent** receives each control with its reference already
attached and is asked for exactly two things: a one-sentence risk statement and a
rationale. Its system prompt forbids inventing, renumbering or altering any
reference. The assembly node then rebuilds each mapping from the catalog, using the
model's text only in the `risk` and `rationale` fields.

The output shape the frontend renders:

```
Risk  →  Governance area  →  Recommended control  →  Required evidence
```

---

## Control catalog

| ID | Control | Governance area | Illustrative framework reference | Required evidence |
|---|---|---|---|---|
| AIC-01 | AI agent identity and authentication | Identity & Access Management | NIST AI RMF GOVERN 2.1; OWASP LLM Top 10 — LLM06 Excessive Agency | Agent authorization model |
| AIC-02 | Least privilege for AI agent tool access | Authorization | NIST AI RMF MANAGE 2.2; OWASP LLM Top 10 — LLM06 Excessive Agency | IAM policy / access control configuration |
| AIC-03 | Human approval for high-impact agent actions | Human Oversight | NIST AI RMF GOVERN 3.2, MANAGE 2.4; NIST AI 600-1 — Human-AI Configuration | Human approval workflow documentation |
| AIC-04 | Agent activity logging and auditability | Auditability | NIST AI RMF MEASURE 2.8, MANAGE 4.1 | Logging configuration |
| AIC-05 | Behavioural monitoring and anomaly detection | Monitoring & Detection | NIST AI RMF MEASURE 3.1, MANAGE 4.1 | Monitoring configuration |
| AIC-06 | Secrets management for agent credentials | Security Engineering | NIST AI RMF MEASURE 2.7; NIST AI 600-1 — Information Security | Secrets management configuration |
| AIC-07 | Prompt injection resistance and input validation | AI Security | OWASP LLM Top 10 — LLM01 Prompt Injection; NIST AI 600-1 — Information Security | Architecture diagram / data flow diagram |
| AIC-08 | Tool permission matrix / documented tool authorization | Authorization | NIST AI RMF MAP 1.1, MANAGE 2.2 | Tool permission matrix |
| AIC-09 | Network egress restriction | Security Engineering | NIST AI RMF MEASURE 2.7 | Network / egress configuration |
| AIC-10 | Data minimisation, retention and training-use controls | Privacy | NIST AI RMF MEASURE 2.10; NIST AI 600-1 — Data Privacy | Data retention policy / privacy assessment |
| AIC-11 | Third-party AI risk assessment | Third-Party Risk Management | NIST AI RMF GOVERN 6.1, MANAGE 3.1; NIST AI 600-1 — Value Chain and Component Integration | Vendor security documentation / SOC 2 report |
| AIC-12 | Failure handling, rollback and agent disengagement | Resilience | NIST AI RMF MANAGE 2.3, MANAGE 2.4 | Incident response procedure |
| AIC-13 | AI system documentation and pre-deployment risk assessment | AI Governance | NIST AI RMF GOVERN 1.3, MAP 2.2, MAP 5.1 | Model documentation / AI risk assessment |

---

## How status is decided

Each control has an `evaluate()` function — a pure rule over the normalised intake.
There is no scoring, no threshold and no model involved.

**PRESENT** — the intake establishes a control that meaningfully addresses this.
**PARTIAL** — a control exists but is insufficient for this system's privilege or autonomy, or the claim has not been evidenced.
**GAP** — no control is described and the risk is live.

Two examples, quoted from the catalog:

```js
// AIC-02 — Least privilege for AI agent tool access
if (!a.tool_access) return { status: 'PRESENT', reason: 'No tool access, so no privileges to scope.' };
if (['none', 'shared_role'].includes(a.authorization)) return { status: 'GAP',  reason: '...' };
if (a.authorization === 'role_based' && (a.can_delete_data || a.can_execute_transactions))
                                        return { status: 'GAP',  reason: '...' };
if (a.authorization === 'role_based')   return { status: 'PARTIAL', reason: '...' };
return { status: 'PRESENT', reason: 'Agent permissions are scoped to least privilege.' };
```

```js
// AIC-03 — Human approval for high-impact agent actions
const highImpactCapable = a.can_modify_data || a.can_delete_data
                       || a.can_execute_transactions || a.can_send_communications;
if (!highImpactCapable)                 return { status: 'PRESENT', reason: '...' };
if (a.human_approval === 'never')       return { status: 'GAP',     reason: '...' };
if (a.human_approval === 'high_impact_only' && a.autonomy === 'fully_autonomous')
                                        return { status: 'PARTIAL', reason: '...' };
return { status: 'PRESENT', reason: '...' };
```

Note what AIC-03 does with `high_impact_only` on a fully autonomous agent: it marks
it PARTIAL, because the agent is classifying impact itself. That is the kind of
judgement a control catalog can encode once and apply consistently, and it is the
reason this stage is rules rather than prose.

---

## Evidence catalog

Fourteen artefacts, filtered by relevance to the system being assessed. Implemented
in [`n8n/code/03-evidence-gap-analysis.js`](../n8n/code/03-evidence-gap-analysis.js).

| Evidence | Owner | Risk | In scope when |
|---|---|---|---|
| Architecture documentation | Engineering | MODERATE | Always |
| Data flow diagram | Engineering | HIGH | Sensitive/personal data, or the system reads data |
| Agent authorization model | Engineering / IAM | CRITICAL | System is an agent |
| Tool permission matrix | Engineering | CRITICAL | Agent has tool access |
| IAM policy / access control configuration | IAM / Platform | HIGH | Always |
| Human approval workflow documentation | Business Owner | CRITICAL | Agent can write, delete, transact or communicate |
| Logging configuration | Engineering / SecOps | HIGH | Always |
| Monitoring configuration | SecOps | HIGH | Always |
| Vendor security documentation / SOC 2 | TPRM | HIGH | Third-party dependency |
| Privacy assessment (DPIA / PIA) | Privacy | HIGH | Personal information processed |
| Data retention and deletion policy | Privacy / Legal | MODERATE | Sensitive or personal data processed |
| Model documentation (model / system card) | AI Engineering | MODERATE | Always |
| AI risk assessment (pre-deployment sign-off) | GRC | HIGH | Always |
| Incident response procedure covering AI/agent failure | SecOps | HIGH | Always |

`PROVIDED` is deliberately hard to earn. At intake almost nothing has been uploaded,
so most artefacts are honestly reported as `MISSING` rather than assumed present.
An assessment that quietly assumes evidence exists is worse than one that asks for it.

---

## Extending the catalog

Adding a control means adding one object to `CATALOG` in
`02-control-gap-analysis.js` with a `control_id`, `governance_area`,
`framework_reference`, `required_evidence`, `base_severity` and an `evaluate()`
function. Governance mapping, evidence gaps, remediation items and domain scoring
all pick it up automatically. Then run `npm run engine:test` and
`npm run contract:test`, and `npm run workflow:build` to regenerate the importable
workflow.
