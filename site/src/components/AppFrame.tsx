interface Props {
  /** Height of the embedded application window: a number of pixels or any CSS length. */
  height?: number | string;
  caption?: string;
}

/**
 * The real application, embedded.
 *
 * The page shows the shipping renderer inside an iframe rather than a
 * screenshot of it, so what you see is the interface that ships. The answers
 * it gives on this page come from its demo mode, which runs without a key.
 */
export function AppFrame({ height = 620, caption }: Props) {
  return (
    <figure style={{ margin: 0 }}>
      <div
        className="demo-frame"
        style={{
          height,
          width: '100%',
          border: '1px solid #1b1f2b',
          borderRadius: '0.5rem',
          overflow: 'hidden',
        }}
      >
        <iframe
          src={`${import.meta.env.BASE_URL}web/index.html`}
          title="The Halo desktop application"
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            border: 0,
            display: 'block',
            background: '#0a0c12',
          }}
        />
      </div>
      {caption ? (
        <figcaption className="demo-caption">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
