interface Stage {
  title: string;
  detail: string;
}

const stages: Stage[] = [
  { title: 'Microphone', detail: 'The raw signal, whatever rate the device gives you' },
  { title: 'Capture worklet', detail: 'Resampled to 16 kHz mono PCM, with an input level' },
  { title: 'Session', detail: 'One WebSocket to the Live API, or one request per turn' },
  { title: 'Player worklet', detail: 'A gapless ring buffer at 24 kHz, with an output level' },
];

/** The audio path, from the room to the room. */
export function Pipeline() {
  return (
    <ol className="pipeline">
      {stages.map((stage, index) => (
        <li className="pipeline-step" key={stage.title}>
          <span className="pipeline-index" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="pipeline-title">{stage.title}</span>
          <span className="pipeline-detail">{stage.detail}</span>
        </li>
      ))}
    </ol>
  );
}
