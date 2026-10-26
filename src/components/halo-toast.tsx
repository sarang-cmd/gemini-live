interface Props {
  message: string | null;
}

/** A small, quiet notice at the bottom of the window. */
export function HaloToast({ message }: Props) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="halo-toast pointer-events-none fixed bottom-6 left-1/2 z-40 max-w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#0a0f1d]/95 px-4 py-2.5 text-center text-[12.5px] text-white/80 shadow-xl shadow-black/50 backdrop-blur-xl"
    >
      {message}
    </div>
  );
}
