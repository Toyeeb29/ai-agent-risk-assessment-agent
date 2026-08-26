# Screenshots

Drop the images below into this folder using these exact filenames — the README
and the docs reference them by name.

Capture at a wide viewport (1600px+) so text stays legible when GitHub scales
the image down.

| Filename | What to capture | Why it earns its place |
|---|---|---|
| `workflow-canvas.png` | The full n8n canvas after a successful run, all nodes green | Proves the workflow is real and self-hosted, not a diagram |
| `results-overview.png` | Results dashboard, **Overview** tab, support-agent scenario | The 36/64 score with its full Impact × Likelihood × Exposure derivation |
| `control-gaps.png` | Results dashboard, **Control gaps** tab | Shows rule-derived statuses across the 13-control catalog |
| `executive-report.png` | Results dashboard, **Executive report** tab | The business-language deliverable a CISO would actually read |
| `governance-mapping.png` | Results dashboard, **Governance mapping** tab | The illustrative framework crosswalk, with its disclaimer visible |
| `determinism.png` | Two smoke-test runs side by side | Different finding counts, identical 36/64 — the core claim, evidenced |

## The determinism screenshot

This is the most valuable image in the repo and the least obvious to capture.
Run the same scenario twice and put the two terminal outputs next to each other:

```bash
node n8n/smoke-test.mjs http://localhost:5678/webhook/ai-risk-assessment
node n8n/smoke-test.mjs http://localhost:5678/webhook/ai-risk-assessment
```

The `Findings` count will differ between runs because the LLM stages are
non-deterministic. `Risk score` and `Impact × Likelihood × Exposure` will not,
because no model touches them. That contrast is the entire argument of the
project in one image.

## Before committing

Check every screenshot for real data. The demo scenarios are synthetic, but a
browser window can leak a bookmark bar, a tab title, a local path, or an n8n
credential name. Crop tightly.
