/**
 * Gemini provider — ephemeral tokens for the Live API.
 *
 * The renderer opens the Live WebSocket itself (lowest latency), but it never
 * sees the long-lived API key: the main process mints a single-use token.
 *
 *   POST https://generativelanguage.googleapis.com/v1beta/auth_tokens
 *   x-goog-api-key: $GEMINI_API_KEY
 */
import { LIVE_API_VERSION } from '../../shared/protocol.js';

const AUTH_TOKENS_URL = `https://generativelanguage.googleapis.com/${LIVE_API_VERSION}/auth_tokens`;

export class GeminiError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
  }
}

export interface EphemeralToken {
  token: string;
  expiresAt: string;
  newSessionExpiresAt: string;
}

/**
 * Mint a token that can open exactly one Live session.
 */
export async function createEphemeralToken({
  apiKey,
  ttlMinutes = 30,
  newSessionSeconds = 60,
}: {
  apiKey: string;
  ttlMinutes?: number;
  newSessionSeconds?: number;
}): Promise<EphemeralToken> {
  if (!apiKey) {
    throw new GeminiError(
      'No Gemini API key is configured. Add one in Settings or set GEMINI_API_KEY.',
      400,
    );
  }

  const payload = {
    uses: 1,
    expireTime: new Date(Date.now() + ttlMinutes * 60_000).toISOString(),
    newSessionExpireTime: new Date(Date.now() + newSessionSeconds * 1_000).toISOString(),
  };

  let response: Response;
  try {
    response = await fetch(AUTH_TOKENS_URL, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new GeminiError(
      `Could not reach the Gemini API (${(err as Error).message}). Check this machine's network access.`,
    );
  }

  const raw = await response.text();
  let json: { name?: string; expireTime?: string; newSessionExpireTime?: string } = {};
  try {
    json = JSON.parse(raw);
  } catch {
    /* keep the raw text for the error message */
  }

  if (!response.ok) {
    const parsed = JSON.parse(raw || '{}') as { error?: { message?: string } };
    throw new GeminiError(
      parsed?.error?.message || `Ephemeral token request failed with status ${response.status}.`,
      response.status === 400 || response.status === 401 ? 400 : 502,
    );
  }

  if (!json.name) {
    throw new GeminiError('The Gemini API did not return an ephemeral token.');
  }

  return {
    token: json.name,
    expiresAt: json.expireTime || payload.expireTime,
    newSessionExpiresAt: json.newSessionExpireTime || payload.newSessionExpireTime,
  };
}
