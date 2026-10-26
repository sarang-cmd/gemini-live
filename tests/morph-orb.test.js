import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENT = path.join(ROOT, 'src/components/ui/ai-thinking-orb-and-input.tsx');
const CSS = path.join(ROOT, 'src/index.css');

const source = readFileSync(COMPONENT, 'utf8');
const css = readFileSync(CSS, 'utf8');

test('the orb component lives where shadcn expects it', () => {
  assert.ok(
    /import\s+['"]\.\.\/\.\.\/index\.css['"]/.test(source),
    'the component must import the app stylesheet',
  );
  assert.match(source, /export function MorphOrb/);
  assert.match(source, /export default MorphOrb/);
});

test('the component publishes every documented custom property', () => {
  const actorVars = [
    '--w',
    '--h',
    '--r',
    '--oGlow',
    '--oHalo',
    '--oPill',
    '--oBall',
    '--oGreen',
    '--oCard',
    '--oRing',
    '--oInput',
    '--oAur',
    '--gs',
    '--cs',
    '--hOp',
    '--dotS',
    '--bloom',
  ];

  for (const name of actorVars) {
    assert.ok(source.includes(`'${name}'`), `the component never writes ${name}`);
    assert.ok(css.includes(`var(${name}`), `the stylesheet never reads ${name}`);
  }

  assert.ok(source.includes("'--sOp'"), 'the status opacity is missing');
  assert.ok(source.includes("'--sTy'"), 'the status offset is missing');
  assert.ok(source.includes("'--oCenter'"), 'the halo opacity is missing');
  assert.ok(source.includes("'--inScale'"), 'the input scale is missing');
  assert.ok(source.includes("'--wp'"), 'the word progress is missing');
});

test('the phase machine covers the whole timeline', () => {
  for (const phase of [
    'idle',
    'launch',
    'assemble',
    'think',
    'resolve',
    'condense',
    'unfold',
    'answered',
    'reset',
  ]) {
    assert.ok(source.includes(`'${phase}'`), `the ${phase} phase is missing`);
  }
});

test('the orb paints every layer the stylesheet knows about', () => {
  for (const className of [
    'mo-root',
    'mo-bg',
    'mo-halo',
    'mo-mover',
    'mo-trail',
    'mo-actor',
    'mo-underglow',
    'mo-halo-green',
    'mo-surface',
    'mo-aurora',
    'mo-ball',
    'mo-green',
    'mo-card',
    'mo-ring',
    'mo-input',
    'mo-spark',
    'mo-field',
    'mo-send',
    'mo-orb',
    'mo-pulse',
    'mo-answer',
    'mo-a-head',
    'mo-a-dot',
    'mo-a-body',
    'mo-w',
    'mo-status',
    'mo-lab',
    'mo-in',
    'mo-out',
    'mo-reset',
    'mo-live',
    'mo-debug',
  ]) {
    assert.ok(source.includes(className), `the component never renders .${className}`);
    assert.ok(css.includes(`.${className}`), `the stylesheet has no .${className} rule`);
  }
});

test('the comet trail is six ghosts', () => {
  assert.match(source, /const TRAIL = 6;/);
  assert.match(source, /Array\.from\(\{ length: TRAIL \}\)/);
});

test('the canvas is 220 pixels wide', () => {
  assert.match(source, /const CANVAS = 220;/);
  assert.match(css, /\.mo-orb\s*\{[^}]*width:\s*220px/);
  assert.match(css, /\.mo-orb\s*\{[^}]*height:\s*220px/);
});

test('the stylesheet ships the keyframes the animation needs', () => {
  for (const keyframe of ['mo-drift', 'mo-in', 'mo-out', 'mo-pulse', 'mo-rise']) {
    assert.ok(css.includes(`@keyframes ${keyframe}`), `@keyframes ${keyframe} is missing`);
  }
});

test('the reset button only shows once the answer is on screen', () => {
  assert.match(css, /\.mo-root\[data-phase='answered'\]\s+\.mo-reset/);
  assert.match(source, /data-phase=\{phase\}/);
});

test('the answer words are revealed one by one', () => {
  assert.match(source, /className="mo-w"/);
  assert.match(source, /setProperty\('--i'/);
  assert.match(source, /setProperty\('--wp'/);
  assert.match(css, /\.mo-w\s*\{[^}]*var\(--wp/);
});

test('escape aborts the pending request', () => {
  assert.match(source, /event\.key !== 'Escape'/);
  assert.ok(source.includes('rt.abort?.abort()'), 'escape does not abort the request');
});
