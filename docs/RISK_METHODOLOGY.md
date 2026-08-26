# Risk methodology

Every number in an assessment is produced by the rules on this page. No language
model contributes to any score, band, status, severity, priority or SLA. The same
submission always produces the same result, and `npm run engine:test` asserts it.

The weights below are a defensible starting point, not an industry standard. They
are published precisely so that a risk committee can argue with them and tune them
for their own risk appetite. Changing a weight changes `engine_version`, which is
recorded in every audit record.

Implementation: [`n8n/code/01-normalize-input.js`](../n8n/code/01-normalize-input.js)
and [`n8n/code/04-risk-engine.js`](../n8n/code/04-risk-engine.js).

---

## 1. The formula

```
Risk Score = Impact (1-4) × Likelihood (1-4) × Exposure (1-4)
Range: 1 - 64
```

| Band | Score | Meaning |
|---|---|---|
| LOW | 1 – 10 | No blocking issues found in the automated pass |
| MODERATE | 11 – 24 | Approve with conditions; gaps are addressable pre-deployment |
| HIGH | 25 – 47 | Requires human governance review before approval |
| CRITICAL | 48 – 64 | Do not approve in current form |

Multiplication rather than addition is deliberate. A system with severe impact but
no realistic likelihood and no exposure should not score the same as one where all
three are moderate. Multiplication also means a genuinely contained system cannot
accumulate a high score from paperwork gaps alone.

---

## 2. The six agent risk modifiers

Derived at intake, each on a 0–4 scale, and carried through the whole assessment so
a reader can see exactly what drove the score. These are the agent-specific inputs
that distinguish this from a generic third-party risk questionnaire.

### Autonomy

| Intake value | Modifier |
|---|---|
| `none` — a person triggers every action | 0 |
| `suggest_only` | 1 |
| `human_in_the_loop` | 2 |
| `semi_autonomous` | 3 |
| `fully_autonomous` | 4 |

### Tool privilege

One point each, capped at 4: can modify data, can delete data, can execute
transactions, can send communications. Zero when the system has no tool access.

### Data sensitivity

`sensitive_data` +2 · `personal_information` +1 · training/retention use is
`vendor_trains_on_data` or `unknown` +1. Capped at 4.

### External exposure

One point each, capped at 4: calls external APIs · unrestricted outbound internet ·
third-party hosted · can send outbound communications.

### Human impact

Business impact `low`/`moderate`/`high`/`critical` → 1/2/3/4, plus 1 if 1,000 or
more users are affected. Capped at 4.

### Third-party dependency

Zero if internally hosted with no vendor. Otherwise 2, plus 1 if the provider trains
on submitted data, plus 1 if regulatory sensitivity is high. Capped at 4.

---

## 3. Impact (1–4)

```
impact_raw = data_sensitivity + human_impact + tool_privilege   (0 - 12)
```

| impact_raw | Impact |
|---|---|
| 0 – 2 | 1 (Low) |
| 3 – 5 | 2 (Moderate) |
| 6 – 8 | 3 (High) |
| 9 – 12 | 4 (Severe) |

Impact answers: *if this goes wrong, how bad is it?* It combines what data is at
stake, how many people are affected, and how consequential the actions the system
can take are.

---

## 4. Likelihood (1–4)

Likelihood answers: *given the controls that actually exist, how likely is a bad
outcome?* It is the only factor driven by control weakness, which is why improving
controls moves the score and restating the business case does not.

### Control weakness score (0 – 15)

| Field | Weight |
|---|---|
| `authentication` | none 2 · shared_api_key 1 · service_account 1 · oauth_delegated 0 · workload_identity 0 |
| `authorization` | none 3 · shared_role 2 · role_based 1 · least_privilege_scoped 0 |
| `logging` | none 2 · partial 1 · comprehensive 0 |
| `monitoring` | none 2 · basic 1 · alerting 1 · behavioral 0 |
| `secrets_management` | hardcoded 2 · env_vars 1 · secrets_manager 0 |
| `human_approval` | never 2 · high_impact_only 1 · always 0 |

Plus **+2 prompt injection surface** when the system is an agent and either calls
external APIs or reads data — that is, when content the organisation does not author
reaches the model context. Maximum 17.

```
likelihood_raw = control_weakness + autonomy   (0 - 19)
```

| likelihood_raw | Likelihood |
|---|---|
| 0 – 3 | 1 |
| 4 – 7 | 2 |
| 8 – 11 | 3 |
| 12 – 19 | 4 |

Autonomy is added rather than multiplied because a weak control on an unsupervised
agent and a weak control on a supervised one are not the same risk, but they are not
orders of magnitude apart either.

---

## 5. Exposure (1–4)

```
exposure_raw = external_exposure + third_party_dependency
             + (network_access is unrestricted_internet ? 1 : 0)     (0 - 9)
```

| exposure_raw | Exposure |
|---|---|
| 0 – 1 | 1 |
| 2 – 3 | 2 |
| 4 – 6 | 3 |
| 7 – 9 | 4 |

Exposure answers: *how much reachable surface does this create?* An internally
hosted, network-isolated model has very little regardless of how sensitive its data
is; a third-party agent with outbound internet access has a great deal.

---

## 6. Domain scores (0–100)

The overall score says how much risk there is. The domain scores say where it sits,
which is what actually routes an assessment to the right reviewer. Bands: LOW < 25,
MODERATE < 50, HIGH < 75, CRITICAL ≥ 75.

| Domain | Weighted drivers |
|---|---|
| **Privacy** | personal information 30 · sensitive data 25 · provider trains on data 20 (or unknown 15) · high regulatory sensitivity 15 (moderate 8) · can send communications 10 · data-minimisation control gap 10 |
| **Security** | control weakness × 6 · unrestricted egress 15 · hardcoded secrets 10 · prompt injection surface 12 · 6 per security control gap (AIC-01, 06, 07, 09) |
| **Agentic Risk** | autonomy × 15 · tool privilege × 12 · no approval gate 20 (high-impact only 8) · calls external APIs 8 · no monitoring 10 · delete permissions 8. Non-agents score a flat 15 (5 for traditional ML). |
| **TPRM** | external provider 30 · trains on data 20 (or terms unknown 12) · sensitive/personal data leaves the org 18 · no vendor AI assessment 15 · supports a high/critical business process 10. Internal systems score a flat 10. |
| **Governance** | business impact 10/25/40/55 · high regulatory sensitivity 15 (moderate 8) · ≥1,000 affected users 10 · no pre-deployment documentation 12 · no oversight gate 12 · not auditable 8 |

---

## 7. Remediation priority and SLA

Priority is the control's severity, not the LLM's opinion.

| Control severity | Priority | SLA |
|---|---|---|
| CRITICAL | CRITICAL | Immediate |
| HIGH | HIGH | 30 days |
| MODERATE | MEDIUM | 60 days |
| LOW | LOW | 90 days |

**Compounding rule.** A gap in authorization, human oversight or auditability is
raised one priority step when `autonomy ≥ 3` **and** `tool_privilege ≥ 2`. An
unsupervised, privileged agent turns a control gap into an operational one.

**Severity escalation at the control layer.** A GAP is escalated one severity step
when business impact is critical or regulatory sensitivity is high, and again when
autonomy ≥ 3 and tool privilege ≥ 2.

---

## 8. Governance decision

```
CRITICAL band                 -> DO_NOT_APPROVE
HIGH band, or any CRITICAL gap -> REQUIRES_GOVERNANCE_REVIEW
MODERATE band                 -> APPROVE_WITH_CONDITIONS
LOW band                      -> APPROVE
```

Human governance review is required when **any** of the following is true: the band
is HIGH or CRITICAL; there is at least one CRITICAL control gap; regulatory
sensitivity is high; or autonomy ≥ 3 with tool privilege ≥ 2.

`APPROVE` means "the automated pass found no blocking issues". The workflow never
approves anything. A person records the decision.

---

## 9. Worked examples

Produced by `npm run engine:test` against the three synthetic scenarios.

| Scenario | I | L | E | Score | Band | Decision |
|---|---|---|---|---|---|---|
| Read-only internal policy assistant | 1 | 1 | 1 | **1 / 64** | LOW | No blocking issues |
| Semi-autonomous infrastructure agent | 3 | 3 | 3 | **27 / 64** | HIGH | Requires governance review |
| Autonomous third-party support agent | 4 | 3 | 3 | **36 / 64** | HIGH | Requires governance review |
| Adversarial test case | 4 | 4 | 4 | **64 / 64** | CRITICAL | Do not approve |

The adversarial case is the ceiling: every one of the six modifiers at 4/4, eleven of
thirteen controls in GAP, thirteen of fourteen evidence artefacts missing. It is included
precisely because a scoring model that cannot reach its own ceiling on a genuinely terrible
configuration is not calibrated. The engine test asserts the four scenarios stay strictly
ordered, so a weight change that collapses the spread fails the build.

The support agent scores higher than the infrastructure agent despite better platform
hygiene, because it is fully autonomous, touches personal data, and has no approval
gate on customer-facing actions. That is the discrimination the model is built for:
it scores *authority and oversight*, not engineering maturity.

---

## 10. Where the LLM is allowed to influence anything

Nowhere in this document. Its outputs are constrained downstream:

- An AI-generated finding severity is capped at one band above the deterministic
  overall band. A model cannot declare CRITICAL on a LOW-scored system.
- Framework references and control IDs are never model-generated.
- The executive summary is given the band and told to state it, not derive it.
- If an LLM stage returns malformed output, the assessment completes on
  deterministic content alone and the stage is recorded in `degraded_stages`.
