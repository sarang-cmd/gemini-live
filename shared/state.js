/**
 * Conversation state machine.
 *
 *   idle ──start──▶ connecting ──setup_complete──▶ listening
 *                      │                              │  ▲
 *                      │                              ▼  │
 *                      │                          thinking
 *                      │                              │
 *                      │                              ▼
 *                      └───────────────────────── speaking
 *
 * `interrupted` (the user talked over the model) drops straight back to listening.
 */

export const STATES = Object.freeze({
  IDLE: 'idle',
  CONNECTING: 'connecting',
  LISTENING: 'listening',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
  ERROR: 'error',
});

/** Allowed transitions — used to keep the UI honest. */
const TRANSITIONS = {
  [STATES.IDLE]: [STATES.CONNECTING, STATES.ERROR],
  [STATES.CONNECTING]: [STATES.LISTENING, STATES.ERROR, STATES.IDLE],
  [STATES.LISTENING]: [STATES.THINKING, STATES.SPEAKING, STATES.IDLE, STATES.ERROR],
  [STATES.THINKING]: [STATES.SPEAKING, STATES.LISTENING, STATES.IDLE, STATES.ERROR],
  [STATES.SPEAKING]: [STATES.LISTENING, STATES.THINKING, STATES.IDLE, STATES.ERROR],
  [STATES.ERROR]: [STATES.IDLE, STATES.CONNECTING],
};

export function canTransition(from, to) {
  if (from === to) return true;
  return (TRANSITIONS[from] || []).includes(to);
}

export function createStateMachine(onChange) {
  let state = STATES.IDLE;

  return {
    get state() {
      return state;
    },
    is(...states) {
      return states.includes(state);
    },
    /** Returns true when the transition was applied. */
    set(next, meta) {
      if (next === state) return true;
      if (!canTransition(state, next)) return false;
      const previous = state;
      state = next;
      onChange?.(next, previous, meta);
      return true;
    },
    /** Force a state without checking the transition table (error recovery). */
    reset(next = STATES.IDLE) {
      const previous = state;
      state = next;
      onChange?.(next, previous, { forced: true });
    },
  };
}

/** Human readable label for the stage headline. */
export function stateLabel(state) {
  switch (state) {
    case STATES.CONNECTING:
      return 'Connecting';
    case STATES.LISTENING:
      return 'Listening';
    case STATES.THINKING:
      return 'Thinking';
    case STATES.SPEAKING:
      return 'Speaking';
    case STATES.ERROR:
      return 'Something went wrong';
    default:
      return 'Ready';
  }
}

/** Short hint under the headline. */
export function stateHint(state, { handsFree = true, muted = false } = {}) {
  switch (state) {
    case STATES.CONNECTING:
      return 'Opening a Live session…';
    case STATES.LISTENING:
      return muted
        ? 'Microphone muted — unmute to talk'
        : handsFree
          ? 'Go ahead, I’m listening'
          : 'Hold the mic button to talk';
    case STATES.THINKING:
      return 'Let me think about that…';
    case STATES.SPEAKING:
      return 'Tap the mic to interrupt';
    case STATES.ERROR:
      return 'Check the message below and try again';
    default:
      return 'Tap the mic to start a conversation';
  }
}
