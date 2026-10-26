'use client';

/**
 * MorphOrb — the "thinking orb + input" surface.
 *
 * A single element morphs through a timeline of shapes:
 *
 *   idle → launch → assemble → think → resolve → condense → unfold → answered
 *
 * The pill at the bottom of the screen collapses into a ball, flies up to the
 * stage, assembles into a dotted orb, thinks while the request is in flight,
 * resolves, condenses into a green dot and finally unfolds into an answer
 * card with the words revealed one by one.
 *
 * Every animated value is published as a CSS custom property on `.mo-actor`
 * (or `.mo-status` / `.mo-root`), so the styling lives in `index.css` and the
 * component only ever writes numbers.
 *
 *   .mo-actor : --w --h --r --oGlow --oHalo --oPill --oBall --oGreen --oCard
 *               --oRing --oInput --oAur --gs --cs --hOp --dotS --bloom
 *   .mo-status: --sOp --sTy
 *   .mo-root  : --oCenter
 *   .mo-input : --inScale
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ArrowUp, RotateCcw, Sparkles } from 'lucide-react';

import '../../../shared/orb.css';

/* ------------------------------------------------------------------ types */

export type MorphPhase =
  | 'idle'
  | 'launch'
  | 'assemble'
  | 'think'
  | 'resolve'
  | 'condense'
  | 'unfold'
  | 'answered'
  | 'reset';

export interface MorphOrbProps {
  /** Called when the user submits the field. Resolves with the answer text. */
  onSubmit?: (text: string) => Promise<string> | string;
  /** Minimum time spent in the `think` phase, in milliseconds. */
  minThinkMs?: number;
  /** Animation speed multiplier — 2 is twice as fast. */
  speed?: number;
}

/* --------------------------------------------------------------- geometry */

const TAU = Math.PI * 2;

const PILL_H = 60;
const BALL = 60;
const ORB_D = 132;
const ORB_R = ORB_D / 2;
const CANVAS = 220;
const CARD_H = 108;
const TRAIL = 6;

/** Phase durations in milliseconds (before the speed multiplier). */
const DUR = {
  launch: 780,
  assemble: 640,
  resolve: 380,
  condense: 560,
  unfold: 820,
} as const;

const LABELS = ['Thinking', 'Searching', 'Analyzing', 'Composing'];
const LABEL_MS = 1150;

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const fmt = (n: number) => n.toFixed(4);

/** Cubic bezier with the two middle control points collapsed into one. */
const bez = (u: number, p0: number, c: number, p2: number) => {
  const v = 1 - u;
  return v * v * p0 + 2 * v * u * c + u * u * p2;
};

const angleDelta = (a: number, b: number) => {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

const pillWidth = () => Math.min(560, Math.max(280, window.innerWidth - 32));
const cardWidth = () => Math.min(320, Math.max(248, window.innerWidth - 48));

/** Distance between the stage centre and the resting pill centre. */
const homeDelta = () => window.innerHeight * 0.54 - 96;

/* ------------------------------------------------------------------ state */

interface Runtime {
  phase: MorphPhase;
  started: number;
  dir: number;
  answer: string;
  ready: boolean;
  failed: boolean;
  abort: AbortController | null;
  resolveAnswer: ((value: string) => void) | null;
  rejectAnswer: ((reason: unknown) => void) | null;
}

function createRuntime(): Runtime {
  return {
    phase: 'idle',
    started: 0,
    dir: -1,
    answer: '',
    ready: false,
    failed: false,
    abort: null,
    resolveAnswer: null,
    rejectAnswer: null,
  };
}

/* ------------------------------------------------------------ orb canvas */

interface OrbParams {
  k: number;
  alpha: number;
  spin: number;
  sweep: number;
  pop: number;
  vortex: number;
  gain: number;
  floor: number;
  rad: number;
}

const RINGS = 7;
const SPOKES = 14;

/** Paint the dotted orb. Pure function of the parameters, no React involved. */
function drawOrb(ctx: CanvasRenderingContext2D, size: number, p: OrbParams, time: number) {
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  const grad = ctx.createRadialGradient(cx, cy - p.rad * 0.25, p.rad * 0.1, cx, cy, p.rad * 1.25);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  grad.addColorStop(0.45, 'rgba(186, 214, 255, 0.9)');
  grad.addColorStop(0.8, 'rgba(126, 160, 255, 0.72)');
  grad.addColorStop(1, 'rgba(255, 196, 120, 0.55)');

  for (let ring = 0; ring < RINGS; ring += 1) {
    const ratio = (ring + 1) / RINGS;
    const radius = ratio * p.rad;

    for (let spoke = 0; spoke < SPOKES; spoke += 1) {
      const base = (spoke / SPOKES) * TAU;
      const swirl = p.vortex * (1 - ratio) * 1.35;
      const angle = base + p.spin + swirl;

      // Scatter the dots while the orb is still forming.
      const scatter = (1 - p.k) * (0.6 + ratio);
      const wobble =
        0.5 +
        0.5 * Math.sin(angle * 3 + time * 1.7 + ring * 0.85 + p.pop * Math.sin(time * 2.4 + ring));

      const sweep = Math.exp(-Math.pow(angleDelta(angle, p.sweep) / 0.85, 2));
      const size = (p.floor + p.gain * (0.22 + 0.78 * wobble) * (1 + sweep * 0.75)) * p.k;

      const x = cx + Math.cos(angle) * (radius + scatter * Math.cos(base * 3.1 + time));
      const y = cy + Math.sin(angle) * (radius + scatter * Math.sin(base * 2.3 - time));

      ctx.globalAlpha = clamp(p.alpha * (0.45 + 0.55 * wobble) * (1 + sweep * 0.35), 0, 1);
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.35, size), 0, TAU);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------- component */

export function MorphOrb({ onSubmit, minThinkMs = 3450, speed = 1 }: MorphOrbProps) {
  const [phase, setPhaseState] = useState<MorphPhase>('idle');
  const [text, setText] = useState('');
  const [answer, setAnswer] = useState('');
  const [labels, setLabels] = useState<{ cur: string; prev: string }>({ cur: '', prev: '' });
  const [debugSpeed, setDebugSpeed] = useState(speed);
  const [debug, setDebug] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const moverRef = useRef<HTMLDivElement | null>(null);
  const actorRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trailRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const answerRef = useRef<HTMLDivElement | null>(null);

  const runtime = useRef<Runtime>(createRuntime());
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef<MorphPhase>('idle');
  const minThinkRef = useRef(minThinkMs);
  const speedRef = useRef(speed);

  minThinkRef.current = minThinkMs;
  speedRef.current = debugSpeed;

  /* ------------------------------------------------------------ helpers */

  const setPhase = useCallback((next: MorphPhase) => {
    phaseRef.current = next;
    runtime.current.phase = next;
    setPhaseState(next);
  }, []);

  const writeVars = useCallback((vars: Record<string, string>) => {
    const actor = actorRef.current;
    if (!actor) return;
    for (const [key, value] of Object.entries(vars)) {
      actor.style.setProperty(key, value);
    }
  }, []);

  /* --------------------------------------------------------- the timeline */

  useLayoutEffect(() => {
    setDebug(new URLSearchParams(window.location.search).has('debug'));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS * dpr;
    canvas.height = CANVAS * dpr;
    ctx.scale(dpr, dpr);

    let alive = true;

    const tick = (now: number) => {
      if (!alive) return;
      const rt = runtime.current;
      const sp = Math.max(0.25, speedRef.current);
      const elapsed = now - rt.started;

      /* ---- geometry: where is the actor right now? ---- */
      const home = homeDelta();
      let curX = 0;
      let curY = home;
      let u = 0;

      if (rt.phase === 'launch') {
        u = clamp(elapsed / (DUR.launch / sp));
        curY = bez(u, home, home * 0.62, 0);
        curX = bez(u, 0, rt.dir * home * 0.3, 0);
      } else if (rt.phase !== 'idle') {
        curY = 0;
        curX = 0;
      }

      const mover = moverRef.current;
      if (mover) mover.style.transform = `translate3d(${fmt(curX)}px, ${fmt(curY)}px, 0)`;

      /* ---- sizes: the actor morphs between shapes ---- */
      let w = pillWidth();
      let h = PILL_H;
      let r = 999;

      let oGlow = 1;
      let oHalo = 0;
      let oPill = 1;
      let oBall = 0;
      let oGreen = 0;
      let oCard = 0;
      let oRing = 1;
      let oInput = 1;
      let oAur = 1;
      let gs = 0.55;
      let cs = 1;
      let hOp = 0;
      let dotS = 0;
      let bloom = 1;

      /* ---- the orb on the canvas ---- */
      const params: OrbParams = {
        k: 0,
        alpha: 0,
        spin: 0,
        sweep: 0,
        pop: 0,
        vortex: 0.6,
        gain: 2.1,
        floor: 0.55,
        rad: 30,
      };

      const thinkStart = (rt.phase === 'think' || rt.phase === 'resolve' ? elapsed : 0);

      if (rt.phase === 'idle') {
        const breathe = 1 + Math.sin(now / 1400) * 0.004;
        cs = breathe;
        oGlow = 0.55 + Math.sin(now / 1600) * 0.12;
        params.alpha = 0;
      }

      if (rt.phase === 'launch') {
        const t = ease(u);
        w = lerp(pillWidth(), BALL, t);
        h = lerp(PILL_H, BALL, t);
        r = lerp(999, BALL / 2, t);
        oPill = clamp(1 - u / 0.45);
        oAur = clamp(1 - u / 0.3);
        oRing = clamp(1 - u / 0.25);
        oInput = clamp(1 - u / 0.2);
        oBall = clamp(u / 0.35);
        oGlow = lerp(0.8, 0.12, t);
        cs = lerp(1, 0.97, t);

        const form = formRef.current;
        if (form) {
          form.style.setProperty('--inScale', fmt(lerp(1, 0.9, t)));
          form.style.filter = `blur(${fmt(lerp(0, 6, clamp((u - 0.25) / 0.55))) }px)`;
        }
      }

      if (rt.phase === 'assemble') {
        const t = ease(clamp(elapsed / (DUR.assemble / sp)));
        w = lerp(BALL, ORB_D, t);
        h = lerp(BALL, ORB_D, t);
        r = lerp(BALL / 2, ORB_R, t);
        oBall = 1;
        oPill = 0;
        oRing = 0;
        oInput = 0;
        oGlow = lerp(0.12, 0.3, t);

        params.k = t;
        params.alpha = t;
        params.rad = lerp(30, ORB_R, t);
        params.vortex = lerp(1.5, 0.35, t);
        params.spin = (1 - t) * 1.2;
      }

      if (rt.phase === 'think') {
        const t = elapsed / 1000;
        w = ORB_D;
        h = ORB_D;
        r = ORB_R;
        oBall = 1;
        oGlow = 0.3 + Math.sin(t * 2.1) * 0.08;

        params.k = 1;
        params.alpha = 1;
        params.rad = ORB_R * (1 + Math.sin(t * 1.6) * 0.02);
        params.spin = t * 0.42;
        params.sweep = t * 1.5;
        params.pop = 0.6 + Math.sin(t * 3.1) * 0.35;
        params.vortex = 0.22 + Math.sin(t * 0.9) * 0.12;
        params.gain = 2.2;
      }

      if (rt.phase === 'resolve') {
        const t = ease(clamp(elapsed / (DUR.resolve / sp)));
        w = ORB_D;
        h = ORB_D;
        r = ORB_R;
        oBall = 1;
        oGlow = 0.45;

        params.k = 1 + Math.sin(t * Math.PI) * 0.16;
        params.alpha = 1;
        params.rad = ORB_R * (1 + Math.sin(t * Math.PI) * 0.08);
        params.spin = 1.2 + t * 2.4;
        params.sweep = t * 6;
        params.pop = 1;
        params.vortex = 0.1;
        params.gain = 2.9;
      }

      if (rt.phase === 'condense') {
        const t = ease(clamp(elapsed / (DUR.condense / sp)));
        w = lerp(ORB_D, 56, t);
        h = lerp(ORB_D, 56, t);
        r = lerp(ORB_R, 28, t);
        oBall = clamp(1 - t / 0.55);
        oGreen = clamp((t - 0.35) / 0.5);
        oHalo = clamp((t - 0.3) / 0.6);
        oGlow = lerp(0.45, 0.9, t);
        gs = lerp(0.55, 1, t);

        params.k = 1;
        params.alpha = clamp(1 - t / 0.6);
        params.rad = lerp(ORB_R, 8, t);
        params.spin = 3.6 + t * 3;
        params.vortex = 0;
        params.gain = 3.4;
      }

      if (rt.phase === 'unfold' || rt.phase === 'answered' || rt.phase === 'reset') {
        const t = rt.phase === 'unfold' ? ease(clamp(elapsed / (DUR.unfold / sp))) : 1;
        w = lerp(56, cardWidth(), t);
        h = lerp(56, CARD_H, t);
        r = lerp(28, 20, t);
        oGreen = 1;
        oHalo = lerp(0.9, 0.35, t);
        oCard = clamp(t / 0.45);
        oGlow = lerp(0.9, 0.55, t);
        gs = 1;
        hOp = clamp((t - 0.25) / 0.4);
        dotS = clamp((t - 0.2) / 0.45);
        bloom = lerp(1, 0.625, t);

        params.alpha = 0;
      }

      writeVars({
        '--w': `${fmt(w)}px`,
        '--h': `${fmt(h)}px`,
        '--r': `${fmt(r)}px`,
        '--oGlow': fmt(oGlow),
        '--oHalo': fmt(oHalo),
        '--oPill': fmt(oPill),
        '--oBall': fmt(oBall),
        '--oGreen': fmt(oGreen),
        '--oCard': fmt(oCard),
        '--oRing': fmt(oRing),
        '--oInput': fmt(oInput),
        '--oAur': fmt(oAur),
        '--gs': fmt(gs),
        '--cs': fmt(cs),
        '--hOp': fmt(hOp),
        '--dotS': fmt(dotS),
        '--bloom': fmt(bloom),
      });

      /* ---- the halo behind the orb ---- */
      const root = rootRef.current;
      if (root) {
        let oCenter = 0;
        if (rt.phase === 'assemble') oCenter = clamp(elapsed / (DUR.assemble / sp)) * 0.9;
        else if (rt.phase === 'think') oCenter = 0.9 + Math.sin(elapsed / 700) * 0.08;
        else if (rt.phase === 'resolve') oCenter = 1;
        else if (rt.phase === 'condense') oCenter = clamp(1 - elapsed / (DUR.condense / sp));
        root.style.setProperty('--oCenter', fmt(oCenter));
      }

      /* ---- the comet trail ---- */
      for (let i = 0; i < TRAIL; i += 1) {
        const el = trailRefs.current[i];
        if (!el) continue;
        if (rt.phase !== 'launch') {
          el.style.opacity = '0';
          continue;
        }
        const back = u - (i + 1) * 0.035;
        if (back <= 0) {
          el.style.opacity = '0';
          continue;
        }
        const tx = bez(back, 0, rt.dir * home * 0.3, 0);
        const ty = bez(back, home, home * 0.62, 0);
        const scale = lerp(0.28, 0.9, 1 - i / TRAIL) * lerp(0.8, 1, u);
        el.style.opacity = fmt(clamp((1 - i / TRAIL) * 0.55 * u));
        el.style.transform = `translate3d(${fmt(tx)}px, ${fmt(ty)}px, 0) translate(-50%, -50%) scale(${fmt(scale)})`;
      }

      /* ---- the status label ---- */
      const status = statusRef.current;
      if (status) {
        let sOp = 0;
        let sTy = 8;
        if (rt.phase === 'assemble' || rt.phase === 'think') {
          sOp = clamp(elapsed / 220);
          sTy = 0;
        } else if (rt.phase === 'resolve') {
          sOp = 1;
        } else if (rt.phase === 'condense' || rt.phase === 'unfold' || rt.phase === 'answered') {
          sOp = rt.phase === 'answered' ? 1 : clamp(1 - elapsed / 260);
          sTy = 0;
        }
        status.style.setProperty('--sOp', fmt(sOp));
        status.style.setProperty('--sTy', `${fmt(sTy)}px`);
      }

      drawOrb(ctx, CANVAS, params, now / 1000);

      /* ---- advance the state machine ---- */
      switch (rt.phase) {
        case 'launch':
          if (elapsed >= DUR.launch / sp) setPhase('assemble');
          break;
        case 'assemble':
          if (elapsed >= DUR.assemble / sp) setPhase('think');
          break;
        case 'think':
          if (rt.ready && elapsed >= minThinkRef.current) setPhase('resolve');
          break;
        case 'resolve':
          if (elapsed >= DUR.resolve / sp) setPhase('condense');
          break;
        case 'condense':
          if (elapsed >= DUR.condense / sp) {
            setPhase('unfold');
            setAnswer(rt.answer);
          }
          break;
        case 'unfold':
          if (elapsed >= DUR.unfold / sp) setPhase('answered');
          break;
        default:
          break;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [setPhase, writeVars]);

  /* ------------------------------------------------------- the status text */

  useEffect(() => {
    if (phase !== 'think' && phase !== 'assemble') return undefined;
    const timer = window.setInterval(() => {
      if (runtime.current.phase !== 'think') return;
      setLabels((current) => {
        const next = LABELS[(LABELS.indexOf(current.cur) + 1) % LABELS.length];
        return { cur: next, prev: current.cur };
      });
    }, LABEL_MS);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === 'answered') {
      setLabels({ cur: 'Done', prev: labels.cur });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* ------------------------------------------------------------- actions */

  const reset = useCallback(() => {
    const rt = runtime.current;
    rt.abort?.abort();
    rt.abort = null;
    rt.answer = '';
    rt.ready = false;
    rt.failed = false;
    rt.resolveAnswer = null;
    rt.rejectAnswer = null;
    setAnswer('');
    setLabels({ cur: '', prev: '' });
    setText('');
    setPhase('reset');
    window.setTimeout(() => setPhase('idle'), 260);
  }, [setPhase]);

  const start = useCallback(
    (question: string) => {
      const rt = runtime.current;
      if (rt.phase !== 'idle' && rt.phase !== 'answered' && rt.phase !== 'reset') return;

      rt.answer = '';
      rt.ready = false;
      rt.failed = false;
      rt.dir = -rt.dir;
      rt.started = performance.now();
      rt.abort = new AbortController();

      const form = formRef.current;
      if (form) {
        form.style.filter = 'blur(0px)';
        form.style.setProperty('--inScale', '1');
      }

      setAnswer('');
      setLabels({ cur: LABELS[0], prev: '' });
      setPhase('launch');

      if (!onSubmit) {
        rt.answer = '';
        rt.ready = true;
        return;
      }

      const promise = Promise.resolve().then(() => onSubmit(question));

      promise
        .then((value) => {
          if (rt.abort?.signal.aborted) return;
          rt.answer = typeof value === 'string' ? value : '';
          rt.ready = true;
        })
        .catch(() => {
          if (rt.abort?.signal.aborted) return;
          rt.failed = true;
          rt.ready = true;
          setLabels({ cur: 'Something went wrong', prev: '' });
        });
    },
    [onSubmit, setPhase],
  );

  const onFormSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const value = text.trim();
      if (!value) return;
      start(value);
    },
    [start, text],
  );

  /* ------------------------------------------------------------- effects */

  /**
   * The voice pipeline asks the orb a question without touching its DOM.
   *
   * `window.dispatchEvent(new CustomEvent('halo:ask', { detail: { text } }))`
   * fills the field and starts the timeline, exactly like typing does.
   */
  useEffect(() => {
    const onAsk = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string }>).detail;
      const question = typeof detail?.text === 'string' ? detail.text.trim() : '';
      if (!question) return;
      setText(question);
      start(question);
    };

    window.addEventListener('halo:ask', onAsk);
    return () => window.removeEventListener('halo:ask', onAsk);
  }, [start]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const rt = runtime.current;
      if (rt.phase === 'idle' || rt.phase === 'answered') return;
      rt.abort?.abort();
      reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reset]);

  useEffect(() => {
    const onResize = () => {
      const rt = runtime.current;
      if (rt.phase === 'idle') {
        const mover = moverRef.current;
        if (mover) {
          mover.style.transform = `translate3d(0px, ${fmt(homeDelta())}px, 0)`;
        }
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* ---------------------------------------------------------- word reveal */

  const words = useMemo(() => answer.split(/\s+/).filter(Boolean), [answer]);

  useEffect(() => {
    if (phase !== 'unfold' && phase !== 'answered') return undefined;
    const container = answerRef.current;
    if (!container) return undefined;

    const spans = Array.from(container.querySelectorAll<HTMLElement>('.mo-w'));
    spans.forEach((span, index) => span.style.setProperty('--i', String(index)));

    const sp = Math.max(0.25, speedRef.current);
    const perWord = Math.min(120, 900 / Math.max(1, spans.length));
    let index = 0;

    const timer = window.setInterval(() => {
      index += 1;
      container.style.setProperty('--wp', String(index));
      if (index >= spans.length) window.clearInterval(timer);
    }, perWord / sp);

    return () => window.clearInterval(timer);
  }, [phase, answer]);

  /* -------------------------------------------------------------- render */

  const label = labels.cur;
  const previous = labels.prev;

  return (
    <div className="mo-root" data-phase={phase} ref={rootRef}>
      <div className="mo-bg" aria-hidden="true" />
      <div className="mo-halo" aria-hidden="true" />

      <div className="mo-mover" ref={moverRef}>
        {Array.from({ length: TRAIL }).map((_, index) => (
          <span
            key={index}
            className="mo-trail"
            ref={(el) => {
              trailRefs.current[index] = el;
            }}
          />
        ))}

        <div className="mo-actor" ref={actorRef}>
          <div className="mo-underglow" aria-hidden="true" />
          <div className="mo-halo-green" aria-hidden="true" />

          <div className="mo-surface" aria-hidden="true">
            <div className="mo-aurora">
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>

          <div className="mo-ball" aria-hidden="true" />
          <div className="mo-green" aria-hidden="true" />
          <div className="mo-card" aria-hidden="true" />
          <div className="mo-ring" aria-hidden="true" />

          <form className="mo-input" ref={formRef} onSubmit={onFormSubmit}>
            <Sparkles className="mo-spark" size={18} strokeWidth={1.75} aria-hidden="true" />
            <input
              className="mo-field"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Ask Halo anything…"
              aria-label="Ask Halo"
              autoComplete="off"
              spellCheck={false}
            />
            <button className="mo-send" type="submit" aria-label="Send">
              <ArrowUp size={18} strokeWidth={2} />
            </button>
          </form>

          <canvas className="mo-orb" ref={canvasRef} aria-hidden="true" />

          <div className="mo-pulse" aria-hidden="true" />

          <div className="mo-answer" ref={answerRef}>
            <div className="mo-a-head">
              <i className="mo-a-dot" />
              <span>Answer</span>
            </div>
            <p className="mo-a-body">
              {words.map((word, index) => (
                <span className="mo-w" key={`${word}-${index}`}>
                  {word}{' '}
                </span>
              ))}
            </p>
          </div>
        </div>
      </div>

      <div className="mo-status" ref={statusRef}>
        {previous ? <span className="mo-lab mo-out">{previous}</span> : null}
        {label ? <span className="mo-lab mo-in">{label}</span> : null}
      </div>

      <button className="mo-reset" type="button" onClick={reset}>
        <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
        <span>New question</span>
      </button>

      <div className="mo-live" role="status" aria-live="polite">
        {phase === 'answered' ? answer : ''}
      </div>

      {debug ? (
        <div className="mo-debug">
          <label htmlFor="mo-speed">Speed {debugSpeed.toFixed(2)}×</label>
          <input
            id="mo-speed"
            type="range"
            min="0.25"
            max="3"
            step="0.05"
            value={debugSpeed}
            onChange={(event) => setDebugSpeed(Number(event.target.value))}
          />
          <button type="button" onClick={reset}>
            Replay
          </button>
          <span className="mo-debug-phase">{phase}</span>
        </div>
      ) : null}
    </div>
  );
}

export default MorphOrb;
