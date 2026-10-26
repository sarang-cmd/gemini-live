/**
 * Tiny `.env` loader — keeps the project dependency free.
 * Existing environment variables always win.
 */
import { readFileSync } from 'node:fs';

export function loadEnv(file = '.env') {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return {};
  }

  const loaded = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    if (!key) continue;

    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    loaded[key] = value;
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return loaded;
}
