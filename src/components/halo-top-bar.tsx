import { History, Settings2, Sparkles } from 'lucide-react';

interface Props {
  providerLabel: string;
  desktop: boolean;
  onHistory: () => void;
  onSettings: () => void;
}

/** The app chrome in the top corners. */
export function HaloTopBar({ providerLabel, desktop, onHistory, onSettings }: Props) {
  // macOS keeps its traffic lights in the top-left corner.
  const mac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between p-4">
      <div
        className={`pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-lg shadow-black/30 backdrop-blur-xl ${mac ? 'ml-20' : ''}`}
      >
        <div className="relative grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-sky-400 via-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/30">
          <Sparkles size={15} className="text-white" strokeWidth={2.2} />
        </div>
        <div className="leading-tight">
          <p className="text-[13px] font-semibold tracking-tight">Halo</p>
          <p className="text-[11px] text-white/45">{providerLabel}</p>
        </div>
        {!desktop ? (
          <span className="ml-1 rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[10px] font-medium text-amber-200/80">
            preview
          </span>
        ) : null}
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onHistory}
          className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 backdrop-blur-xl transition hover:bg-white/10 hover:text-white"
          aria-label="Conversation history"
        >
          <History size={16} strokeWidth={1.9} />
        </button>
        <button
          type="button"
          onClick={onSettings}
          className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 backdrop-blur-xl transition hover:bg-white/10 hover:text-white"
          aria-label="Settings"
        >
          <Settings2 size={16} strokeWidth={1.9} />
        </button>
      </div>
    </div>
  );
}
