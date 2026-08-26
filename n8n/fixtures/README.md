# Fixtures

`sample-response.json` documents the shape of the `AssessmentResult` payload that the
workflow returns. It is **generated** by `npm run contract:test`, which runs the real
deterministic Code nodes with stubbed LLM stages.

It exists so that:

- the response contract can be read without standing up n8n
- `src/types.ts` can be checked against a concrete payload
- a reviewer can see what "the frontend renders exactly this" means

**It is not imported by the application.** The frontend has no canned results and no
fallback data path — if n8n is not reachable, the assessment screen reports an error.
Regenerate this file rather than editing it by hand.
