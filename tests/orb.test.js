/**
 * Headless tests for the orb renderer.
 *
 * A stub 2D context records the colours it is asked to paint, so the tests can
 * assert that the orb reacts to state changes and to live audio levels.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const gradientStops = [];

function makeContext() {
  const calls = { fill: 0, stroke: 0, gradients: 0, dash: null };

  return {
    calls,
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    setTransform() {},
    clearRect() {},
    beginPath() {},
    arc() {},
    fill() {
      calls.fill += 1;
    },
    stroke() {
      calls.stroke += 1;
    },
    setLineDash(pattern) {
      calls.dash = pattern;
    },
    createRadialGradient(x0, y0, r0, x1, y1, r1) {
      calls.gradients += 1;
      const stops = [];
      gradientStops.push(stops);
      return {
        addColorStop(offset, color) {
          stops.push({ offset, color });
        },
      };
    },
  };
}

function installDom() {
  const context = makeContext();
  const canvas = {
    width: 300,
    height: 300,
    getContext: () => context,
    getBoundingClientRect: () => ({ width: 300, height: 300 }),
  };

  globalThis.window = {
    devicePixelRatio: 2,
    addEventListener() {},
  };
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};

  return { canvas, context };
}

test('the orb renders every state without throwing', async () => {
  const { canvas, context } = installDom();
  const { Orb } = await import('../public/js/orb.js');

  const orb = new Orb(canvas);
  const states = ['idle', 'connecting', 'listening', 'thinking', 'speaking', 'error'];

  for (const state of states) {
    orb.setState(state);
    context.calls.fill = 0;
    orb._draw(1.5);
    assert.ok(context.calls.fill > 5, `${state} did not draw the blobs`);
    assert.ok(context.calls.gradients > 5, `${state} did not build the gradients`);
  }
});

test('the orb responds to the audio level', async () => {
  const { canvas, context } = installDom();
  const { Orb } = await import('../public/js/orb.js');

  const orb = new Orb(canvas);
  orb.setState('speaking');

  // Run the animation forward so the smoothed levels settle.
  for (let i = 0; i < 30; i += 1) {
    orb.setLevels({ output: 0 });
    orb._draw(i / 60);
  }
  const quiet = orb.energy;

  for (let i = 0; i < 60; i += 1) {
    orb.setLevels({ output: 0.9 });
    orb._draw(i / 60);
  }
  const loud = orb.energy;

  assert.ok(loud > quiet + 0.2, `energy did not grow (${quiet} → ${loud})`);
  assert.ok(context.calls.fill > 0);
});

test('the orb changes hue with the conversation state', async () => {
  const { canvas } = installDom();
  const { Orb } = await import('../public/js/orb.js');

  const orb = new Orb(canvas);
  const hueOf = (state) => {
    orb.setState(state);
    for (let i = 0; i < 40; i += 1) orb._draw(i / 60);
    const last = gradientStops[gradientStops.length - 1][0].color;
    return Number(last.match(/hsla?\((\d+)/)?.[1]);
  };

  const idle = hueOf('idle');
  const speaking = hueOf('speaking');
  assert.notEqual(idle, speaking, 'the orb should change colour between states');
});

test('the orb honours prefers-reduced-motion', async () => {
  const { canvas } = installDom();
  globalThis.matchMedia = () => ({ matches: true });
  const { Orb } = await import('../public/js/orb.js');

  const orb = new Orb(canvas);
  assert.equal(orb.reducedMotion, true);
  orb.setState('speaking');
  orb._draw(1);
});
