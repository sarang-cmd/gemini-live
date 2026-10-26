/**
 * The configuration store.
 *
 * API keys live in the main process only — the renderer never receives a raw
 * key. It asks the main process to mint an ephemeral Gemini token or to call
 * Groq on its behalf.
 *
 * Precedence: `config.json` in the Electron user-data directory wins over the
 * environment, which wins over the built-in defaults.
 */
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

import {
  DEFAULTS,
  mergeConfig,
  publicConfig,
  type HaloConfig,
  type Provider,
} from './config-core.js';

export type { HaloConfig, Provider } from './config-core.js';
export { DEFAULTS, publicConfig } from './config-core.js';

let cache: HaloConfig | null = null;
let overridePath: string | null = null;

/** Point the store at another file — used by the tests. */
export function setConfigPath(target: string | null): void {
  overridePath = target;
  cache = null;
}

function file(): string {
  if (overridePath) return overridePath;
  return path.join(app.getPath('userData'), 'config.json');
}

function envKey(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

/** Read the persisted configuration, merged over the defaults and the env. */
export function getConfig(): HaloConfig {
  if (cache) return cache;

  let stored: Partial<HaloConfig> = {};
  try {
    const raw = fs.readFileSync(file(), 'utf8');
    stored = JSON.parse(raw) as Partial<HaloConfig>;
  } catch {
    stored = {};
  }

  cache = mergeConfig(DEFAULTS, stored);
  cache.geminiKey =
    cache.geminiKey || envKey('GEMINI_API_KEY') || envKey('GOOGLE_API_KEY');
  cache.groqKey = cache.groqKey || envKey('GROQ_API_KEY');

  return cache;
}

/** Merge a patch into the configuration and persist it. */
export function setConfig(patch: Partial<HaloConfig>): HaloConfig {
  const next = mergeConfig(getConfig(), patch);
  cache = next;

  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  } catch (err) {
    console.error('[halo] could not persist the configuration', err);
  }

  return next;
}

/** The configuration as the renderer is allowed to see it — no secrets. */
export function publicView(config: HaloConfig = getConfig()) {
  return publicConfig(config);
}
