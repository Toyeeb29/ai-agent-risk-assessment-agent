/**
 * Service layer between the portfolio frontend and the self-hosted n8n instance.
 *
 * This is the ONLY module in the application that performs network I/O and the
 * only place the webhook URL is read. Nothing else in the UI knows n8n exists.
 *
 * Design rules enforced here:
 *   1. The webhook URL is never hardcoded - it comes from VITE_N8N_AI_RISK_WEBHOOK.
 *   2. No credential of any kind is sent from the browser. Anything prefixed
 *      VITE_ is compiled into the public bundle; a secret placed there is a
 *      published secret. Authentication to n8n, where required, is handled
 *      server-side (see docs/SECURITY.md).
 *   3. The frontend does not compute, adjust, infer or cache any risk value.
 *      It transports input and renders output.
 */

import type { AssessmentInput, AssessmentResult } from '../types';
import { SCHEMA_VERSION } from '../types';

const WEBHOOK_URL = import.meta.env.VITE_N8N_AI_RISK_WEBHOOK as string | undefined;
const TIMEOUT_MS = Number(import.meta.env.VITE_N8N_TIMEOUT_MS ?? 120_000);

export class N8nConfigError extends Error {}
export class N8nRequestError extends Error {
  constructor(message: string, readonly status?: number, readonly details?: string[]) {
    super(message);
  }
}

export function isConfigured(): boolean {
  return Boolean(WEBHOOK_URL && /^https?:\/\//.test(WEBHOOK_URL));
}

/** Host only, for display. Never render the full URL, including its path, in the UI. */
export function webhookHost(): string {
  if (!WEBHOOK_URL) return 'not configured';
  try {
    return new URL(WEBHOOK_URL).host;
  } catch {
    return 'invalid URL';
  }
}

/**
 * Runs one assessment against the self-hosted n8n workflow.
 * Resolves with exactly what n8n returned; rejects on transport,
 * timeout, validation (HTTP 400) or contract-version mismatch.
 */
export async function runAssessment(input: AssessmentInput): Promise<AssessmentResult> {
  if (!isConfigured()) {
    throw new N8nConfigError(
      'VITE_N8N_AI_RISK_WEBHOOK is not set. Copy .env.example to .env and point it at your self-hosted n8n webhook.'
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(WEBHOOK_URL as string, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, schema_version: SCHEMA_VERSION }),
      signal: controller.signal,
      // No cookies, no credentials. The webhook is a stateless public endpoint
      // protected at the n8n layer (origin allowlist + rate limiting).
      credentials: 'omit',
      mode: 'cors',
    });
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error).name === 'AbortError') {
      throw new N8nRequestError(
        `The workflow did not respond within ${Math.round(TIMEOUT_MS / 1000)}s. It runs several LLM calls in sequence - check the execution log in n8n.`
      );
    }
    throw new N8nRequestError(
      `Assessment service unavailable. Could not reach the self-hosted n8n instance at ${webhookHost()}. ` +
        `Verify that n8n is running, that the workflow is published, and that this origin is allowed by ` +
        `the webhook's CORS configuration. No assessment is produced when the workflow is unreachable — ` +
        `this application has no fallback results.`
    );
  }
  clearTimeout(timer);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new N8nRequestError(
      `n8n returned a non-JSON response (HTTP ${response.status}). If the workflow is in test mode, click "Execute workflow" in the n8n editor first.`,
      response.status
    );
  }

  if (!response.ok) {
    const body = payload as { error?: string; details?: string[]; message?: string };
    throw new N8nRequestError(
      body?.error || body?.message || `n8n returned HTTP ${response.status}.`,
      response.status,
      body?.details
    );
  }

  const result = payload as AssessmentResult;

  if (!result || typeof result !== 'object' || !result.risk || !result.assessment_id) {
    throw new N8nRequestError(
      'n8n responded, but the payload does not match the AssessmentResult contract. Check the "Assemble Final Assessment" node output.'
    );
  }

  if (result.schema_version !== SCHEMA_VERSION) {
    throw new N8nRequestError(
      `Contract mismatch: the frontend expects schema ${SCHEMA_VERSION} but n8n returned ${result.schema_version || 'none'}. Re-import the workflow.`
    );
  }

  return result;
}
