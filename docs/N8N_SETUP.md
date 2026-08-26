# Self-hosted n8n setup

This project requires an existing self-hosted n8n instance. It does not install n8n,
it does not use n8n Cloud, and it has no mock backend — if n8n is not running, the
assessment screen returns an error rather than a fabricated result.

---

## 1. Build the workflow JSON

The importable file is a build artefact, generated from the reviewable sources in
`n8n/code/*.js` and `n8n/prompts/*.md`:

```bash
npm install
npm run workflow:build
```

Output: `n8n/ai-agent-risk-assessment.workflow.json` (17 nodes).

Build-time environment variables, all optional:

| Variable | Default | Purpose |
|---|---|---|
| `AIRA_MODEL` | `gpt-4o-mini` | Model ID written into every OpenAI node |
| `AIRA_WEBHOOK_PATH` | `ai-risk-assessment` | Webhook path |
| `AIRA_ALLOWED_ORIGINS` | `*` | CORS allowlist. **Set this to your portfolio origin for production.** |

```bash
AIRA_MODEL=gpt-4o \
AIRA_ALLOWED_ORIGINS=https://your-portfolio.example.com \
npm run workflow:build
```

Never edit the generated JSON directly. Edit the sources and rebuild — that is what
keeps the risk engine reviewable in a pull request and testable outside n8n.

---

## 2. Import into n8n

1. In your n8n instance: **Workflows → ⋯ → Import from File**
2. Select `n8n/ai-agent-risk-assessment.workflow.json`
3. The workflow appears as **AI Agent Risk Assessment Agent**

---

## 3. Attach the OpenAI credential

The generated JSON references a placeholder credential ID
(`REPLACE_WITH_YOUR_CREDENTIAL_ID`). The API key itself is never written to the file
and never leaves your n8n instance.

1. **Credentials → Add credential → OpenAI**, paste your API key, save
2. Open the workflow and select each of the six OpenAI nodes:
   - AI Risk Analyst
   - Agentic AI Security Analyst
   - Governance Mapping Agent
   - TPRM Vendor Analyst
   - Remediation Narrative Agent
   - Executive Summary Agent
3. Choose your credential in the **Credential to connect with** dropdown
4. Confirm the model in the **Model** field (the build writes `gpt-4o-mini` by default)

To use a different provider, replace the six `@n8n/n8n-nodes-langchain.openAi` nodes
with the equivalent chat-model node. The prompts in `n8n/prompts/` are
provider-agnostic; only the node type and the `jsonOutput` setting change.

---

## 4. Activate and copy the webhook URL

1. Open the **Webhook - AI Risk Assessment** node
2. Copy the **Production URL** — it looks like
   `https://your-n8n-domain/webhook/ai-risk-assessment`
3. Toggle the workflow to **Active** (the production URL only responds when active)

While building, the **Test URL** (`/webhook-test/...`) works but only for one request
after you press *Execute workflow* in the editor. If the frontend reports a non-JSON
response, this is almost always why.

---

## 5. Point the frontend at it

```bash
cp .env.example .env
```

```dotenv
VITE_N8N_AI_RISK_WEBHOOK=https://your-n8n-domain/webhook/ai-risk-assessment
VITE_N8N_TIMEOUT_MS=120000
```

```bash
npm run dev
```

Vite reads `.env` at startup, so restart the dev server after changing it. `.env` is
gitignored; `.env.example` is the committed template.

---

## 6. CORS

The browser posts directly to n8n, so n8n has to allow your origin. The webhook node
sets `options.allowedOrigins`, written at build time from `AIRA_ALLOWED_ORIGINS`.

For production, set it to your exact origin rather than `*`:

```bash
AIRA_ALLOWED_ORIGINS=https://your-portfolio.example.com npm run workflow:build
```

If you would rather the browser never talk to n8n directly, put a small server-side
proxy in front of it that holds a shared secret and forwards the request. The service
layer needs no change — point `VITE_N8N_AI_RISK_WEBHOOK` at the proxy instead. See
[SECURITY.md](./SECURITY.md).

---

## 7. Verify

```bash
curl -X POST https://your-n8n-domain/webhook/ai-risk-assessment \
  -H 'Content-Type: application/json' \
  -d '{
    "system_name": "Test Agent",
    "business_owner": "Test Owner",
    "department": "Test",
    "business_purpose": "Smoke test",
    "ai_type": "ai_agent",
    "is_agent": true,
    "autonomy": "fully_autonomous",
    "human_approval": "never"
  }'
```

A well-formed run returns an `AssessmentResult` with `assessment_id`, `risk.score`
and `audit_record`. A malformed submission returns HTTP 400 with a `details` array
naming the missing fields — that response comes from the validation node, before any
LLM call is made.

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Could not reach n8n at …` | Workflow inactive, or origin not allowed | Activate the workflow; rebuild with `AIRA_ALLOWED_ORIGINS` set to your origin |
| Non-JSON response | Test URL used without pressing *Execute workflow* | Use the production URL and activate the workflow |
| `Contract mismatch: … returned none` | An older workflow version is imported | `npm run workflow:build` and re-import |
| Timeout at 120s | Model is slow, or a stage is retrying | Raise `VITE_N8N_TIMEOUT_MS`; check the n8n execution log for the stalled node |
| Stages appear in `degraded_stages` | An LLM returned malformed JSON | Expected behaviour — the assessment completes on deterministic content. Check that `jsonOutput` is enabled on that node |
| Every score comes back identical | The workflow is doing its job | The engine is deterministic; change an intake answer to move the score |

---

## 9. Cost and rate limiting

Each assessment runs five LLM calls (six with the TPRM branch). At `gpt-4o-mini`
prices this is a fraction of a cent per run, but the endpoint is public by default,
so put it behind a reverse proxy with rate limiting before linking it from a public
portfolio. An unauthenticated webhook that triggers six paid API calls per request is
a denial-of-wallet target, and that is worth saying out loud in an interview.
