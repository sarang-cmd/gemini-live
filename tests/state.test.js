import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STATES,
  createStateMachine,
  canTransition,
  stateLabel,
  stateHint,
} from '../shared/state.js';

test('the happy path walks idle → connecting → listening → thinking → speaking', () => {
  const seen = [];
  const machine = createStateMachine((next) => seen.push(next));

  assert.equal(machine.state, STATES.IDLE);
  assert.equal(machine.set(STATES.CONNECTING), true);
  assert.equal(machine.set(STATES.LISTENING), true);
  assert.equal(machine.set(STATES.THINKING), true);
  assert.equal(machine.set(STATES.SPEAKING), true);

  assert.deepEqual(seen, [
    STATES.CONNECTING,
    STATES.LISTENING,
    STATES.THINKING,
    STATES.SPEAKING,
  ]);
});

test('illegal transitions are rejected', () => {
  const machine = createStateMachine();
  assert.equal(machine.set(STATES.SPEAKING), false);
  assert.equal(machine.state, STATES.IDLE);
});

test('setting the same state is a no-op', () => {
  let calls = 0;
  const machine = createStateMachine(() => {
    calls += 1;
  });
  machine.set(STATES.IDLE);
  assert.equal(calls, 0);
});

test('an interruption drops back to listening', () => {
  const machine = createStateMachine();
  machine.set(STATES.CONNECTING);
  machine.set(STATES.LISTENING);
  machine.set(STATES.THINKING);
  machine.set(STATES.SPEAKING);
  assert.equal(machine.set(STATES.LISTENING), true);
  assert.equal(machine.state, STATES.LISTENING);
});

test('reset forces a state for error recovery', () => {
  const machine = createStateMachine();
  machine.set(STATES.CONNECTING);
  machine.reset(STATES.IDLE);
  assert.equal(machine.state, STATES.IDLE);
});

test('transition table matches the documented flow', () => {
  assert.equal(canTransition(STATES.IDLE, STATES.CONNECTING), true);
  assert.equal(canTransition(STATES.IDLE, STATES.SPEAKING), false);
  assert.equal(canTransition(STATES.SPEAKING, STATES.LISTENING), true);
  assert.equal(canTransition(STATES.ERROR, STATES.IDLE), true);
});

test('labels and hints exist for every state', () => {
  for (const state of Object.values(STATES)) {
    assert.ok(stateLabel(state).length > 0);
    assert.ok(stateHint(state).length > 0);
  }
});
