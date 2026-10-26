import { CommandBlock } from '../components/CommandBlock';
import { download, product } from '../content';
import { Link } from '../router';

export function Download() {
  return (
    <article className="shell" style={{ paddingTop: 'clamp(3rem, 6vw, 5.5rem)' }}>
      <div style={{ maxWidth: '44rem' }}>
        <h1 className="display" style={{ fontSize: 'var(--step-4)', marginBottom: '1.25rem' }}>
          {download.heading}
        </h1>
        <p className="lead" style={{ marginBottom: '2.5rem' }}>
          {download.lead}
        </p>

        <CommandBlock command={download.command} />
      </div>

      <section className="grid gap-10 md:grid-cols-2" style={{ marginTop: 'var(--section)' }}>
        <div>
          <h2 className="heading" style={{ fontSize: 'var(--step-3)', marginBottom: '1.25rem' }}>
            {download.stepsTitle}
          </h2>
          <dl className="spec-list">
            {download.steps.map(([term, detail]) => (
              <div className="spec-row" key={term}>
                <dt>{term}</dt>
                <dd>{detail}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <h2 className="heading" style={{ fontSize: 'var(--step-3)', marginBottom: '1.25rem' }}>
            {download.requirementsTitle}
          </h2>
          <dl className="spec-list">
            {download.requirements.map(([term, detail]) => (
              <div className="spec-row" key={term}>
                <dt>{term}</dt>
                <dd>{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section style={{ marginTop: 'var(--section)' }}>
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="heading" style={{ fontSize: 'var(--step-3)', marginBottom: '0.75rem' }}>
              {download.packagingTitle}
            </h2>
            <p className="prose">{download.packaging}</p>
          </div>
          <div>
            <h2 className="heading" style={{ fontSize: 'var(--step-3)', marginBottom: '0.75rem' }}>
              {download.otherTitle}
            </h2>
            <p className="prose">{download.other}</p>
          </div>
        </div>
      </section>

      <section
        style={{
          marginTop: 'var(--section)',
          borderTop: '1px solid var(--line)',
          paddingTop: '2.5rem',
        }}
      >
        <h2 className="heading" style={{ fontSize: 'var(--step-3)', marginBottom: '0.75rem' }}>
          Keys
        </h2>
        <p className="prose">
          A Gemini key comes from Google AI Studio, a Groq key from the Groq console. Add either
          one in the app under Settings, or set it in the environment before starting. The key is
          written to your own machine and never reaches the page you are reading.
        </p>
        <p className="small" style={{ marginTop: '1rem' }}>
          <a className="link-accent" href={product.geminiKeyUrl} target="_blank" rel="noreferrer">
            Google AI Studio
          </a>
          {' · '}
          <a className="link-accent" href={product.groqKeyUrl} target="_blank" rel="noreferrer">
            Groq console
          </a>
          {' · '}
          <Link to="/privacy" className="link-accent">
            What happens to your data
          </Link>
        </p>
      </section>
    </article>
  );
}
