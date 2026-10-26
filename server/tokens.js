/**
 * Ephemeral token minting.
 *
 * The browser must never see the long-lived API key. Instead our server asks
 * Google for a short-lived token that can open exactly one Live session:
 *
 *   POST https://generativelanguage.googleapis.com/v1beta/auth_tokens
 *   x-goog-api-key: $GEMINI_API_KEY
 *
 * By default the token is *not* locked to a model. Locking (`liveConnectConstraints`)
 * is stricter but the constraint check compares against the wire setup frame, so
 * it stays opt-in via GEMINI_LOCK_TOKENS=true.
 */
import { LIVE_API_VERSION } from '../shared/protocol.js';

const AUTH_TOKENS_URL = `https://generativelanguage.googleapis.com/${LIVE_API_VERSION}/auth_tokens`;

export class TokenError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'TokenError';
    this.status = status;
  }
}

/**
 * @param {object} options
 * @param {string} options.apiKey
 * @param {string} [options.model]        model the token should be locked to
 * @param {number} [options.ttlMinutes]   how long the session may live (default 30)
 * @param {number} [options.newSessionSeconds] window to *start* a session (default 60)
 * @param {boolean} [options.lock]        attach liveConnectConstraints
 */
export async function createEphemeralToken({
  apiKey,
  model,
  ttlMinutes = 30,
  newSessionSeconds = 60,
  lock = false,
} = {}) {
  if (!apiKey) {
    throw new TokenError(
      'No GEMINI_API_KEY is configured on the server. Add it to .env or use the "my API key" transport.',
      503,
    );
  }

  const payload = {
    uses: 1,
    expireTime: new Date(Date.now() + ttlMinutes * 60_000).toISOString(),
    newSessionExpireTime: new Date(Date.now() + newSessionSeconds * 1_000).toISOString(),
  };

  if (lock && model) {
    payload.liveConnectConstraints = {
      model: model.startsWith('models/') ? model : `models/${model}`,
      config: { responseModalities: ['AUDIO'] },
    };
  }

  let response;
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
    throw new TokenError(
      `Could not reach the Gemini API (${err.message}). Check this machine's network access.`,
    );
  }

  const body = await response.text();
  let json = {};
  try {
    json = JSON.parse(body);
  } catch {
    /* keep the raw text for the error message */
  }

  if (!response.ok) {
    const message =
      json?.error?.message || `Ephemeral token request failed with status ${response.status}.`;
    throw new TokenError(message, response.status === 400 || response.status === 401 ? 400 : 502);
  }

  if (!json.name) {
    throw new TokenError('The Gemini API did not return an ephemeral token.');
  }

  return {
    token: json.name,
    expiresAt: json.expireTime || payload.expireTime,
    newSessionExpiresAt: json.newSessionExpireTime || payload.newSessionExpireTime,
  };
}
