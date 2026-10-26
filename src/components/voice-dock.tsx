import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

interface Voice {
  name: string;
  descriptor: string;
  gender: string;
}

interface Props {
  voice: string;
  voices: Voice[];
  muted: boolean;
  recording: boolean;
  busy: boolean;
  level: number;
  onVoice: (voice: string) => void;
  onMute: () => void;
  onPress: () => void;
  onRelease: () => void;
}

/** The Siri dock: hold to talk, pick a voice, toggle the speaker. */
export function VoiceDock({
  voice,
  voices,
  muted,
  recording,
  busy,
  level,
  onVoice,
  onMute,
  onPress,
  onRelease,
}: Props) {
  const ring = Math.min(1, Math.max(0.12, level * 3.2));

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-20 flex flex-col items-end gap-3">
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5 shadow-lg shadow-black/30 backdrop-blur-xl">
        <select
          value={voice}
          onChange={(event) => onVoice(event.target.value)}
          aria-label="Gemini voice"
          className="rounded-xl bg-transparent px-2.5 py-1.5 text-[12px] text-white/75 outline-none transition hover:bg-white/5"
        >
          {voices.map((item) => (
            <option key={item.name} value={item.name} className="bg-[#0a1020] text-white">
              {item.name} · {item.descriptor}
            </option>
          ))}
        </select>

        <span className="h-5 w-px bg-white/10" />

        <button
          type="button"
          onClick={onMute}
          className="grid h-8 w-8 place-items-center rounded-xl text-white/65 transition hover:bg-white/5 hover:text-white"
          aria-label={muted ? 'Unmute the answer' : 'Mute the answer'}
        >
          {muted ? <VolumeX size={15} strokeWidth={1.9} /> : <Volume2 size={15} strokeWidth={1.9} />}
        </button>
      </div>

      <button
        type="button"
        onPointerDown={(event) => {
          event.preventDefault();
          onPress();
        }}
        onPointerUp={onRelease}
        onPointerLeave={() => recording && onRelease()}
        onContextMenu={(event) => event.preventDefault()}
        disabled={busy}
        className="pointer-events-auto relative grid h-16 w-16 place-items-center rounded-full border border-white/15 bg-white/8 text-white shadow-xl shadow-black/40 backdrop-blur-xl transition enabled:hover:bg-white/12 disabled:opacity-50"
        aria-label={recording ? 'Listening — release to send' : 'Hold to talk'}
      >
        {recording ? (
          <span
            className="absolute inset-0 rounded-full border border-sky-300/60"
            style={{
              transform: `scale(${1 + ring * 0.35})`,
              opacity: 0.35 + ring * 0.5,
              transition: 'transform 80ms linear, opacity 80ms linear',
            }}
          />
        ) : null}

        <span
          className={`absolute inset-0 rounded-full transition ${
            recording ? 'bg-sky-400/25' : 'bg-white/5'
          }`}
        />

        {recording ? (
          <Mic className="relative text-sky-200" size={22} strokeWidth={2} />
        ) : (
          <MicOff className="relative text-white/70" size={22} strokeWidth={1.8} />
        )}
      </button>

      <p className="pointer-events-none pr-1 text-[11px] text-white/35">
        {recording ? 'Listening…' : 'Hold to talk · ⌘Space'}
      </p>
    </div>
  );
}
