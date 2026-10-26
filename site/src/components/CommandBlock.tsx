import { useState } from 'react';

interface Props {
  command: string;
  label?: string;
}

/** A command you can copy in one click. */
export function CommandBlock({ command, label }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      // Clipboard access can be refused; the command is on screen either way.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className="command">
      <code>{command}</code>
      <button type="button" onClick={copy} data-copied={copied} aria-live="polite">
        {copied ? 'Copied' : (label ?? 'Copy')}
      </button>
    </div>
  );
}
