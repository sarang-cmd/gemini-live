import { X } from 'lucide-react';

import type { TranscriptEntry } from '@/App';

interface Props {
  entries: TranscriptEntry[];
  onClose: () => void;
}

/** A slide-over with everything that was said in this session. */
export function HaloHistory({ entries, onClose }: Props) {
  return (
    <aside className="halo-slide fixed left-4 top-20 z-20 flex max-h-[70vh] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0a0f1d]/90 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-[13px] font-semibold tracking-tight">Conversation</h2>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-lg text-white/45 transition hover:bg-white/10 hover:text-white"
          aria-label="Close history"
        >
          <X size={15} strokeWidth={2} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {entries.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-white/35">
            Nothing yet. Ask Halo something — the orb keeps the score.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-1">
                <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/30">
                  {entry.role === 'user' ? 'You' : entry.role === 'assistant' ? 'Halo' : 'Error'}
                </span>
                <p
                  className={`text-[13px] leading-relaxed ${
                    entry.role === 'error'
                      ? 'text-rose-300/90'
                      : entry.role === 'user'
                        ? 'text-white/55'
                        : 'text-white/90'
                  }`}
                >
                  {entry.text}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
