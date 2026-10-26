import { privacy } from '../content';

export function Privacy() {
  return (
    <article className="shell" style={{ paddingTop: 'clamp(3rem, 6vw, 5.5rem)' }}>
      <div style={{ maxWidth: '42rem' }}>
        <h1 className="display" style={{ fontSize: 'var(--step-4)', marginBottom: '1.25rem' }}>
          {privacy.heading}
        </h1>
        <p className="lead">{privacy.lead}</p>
      </div>

      {privacy.sections.map((section) => (
        <section key={section.title} style={{ marginTop: '3.5rem', maxWidth: '42rem' }}>
          <h2 className="heading" style={{ fontSize: 'var(--step-3)', marginBottom: '1rem' }}>
            {section.title}
          </h2>
          {section.body.map((paragraph) => (
            <p className="prose" key={paragraph.slice(0, 32)} style={{ marginBottom: '0.85rem' }}>
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <section style={{ marginTop: '3.5rem', maxWidth: '42rem' }}>
        <h2 className="heading" style={{ fontSize: 'var(--step-3)', marginBottom: '1rem' }}>
          Still open
        </h2>
        <p className="prose" style={{ marginBottom: '1.25rem' }}>
          Two things are not settled yet. They are marked here rather than written as if they were
          decided.
        </p>
        <dl className="spec-list">
          {privacy.drafts.map(([term, detail]) => (
            <div className="spec-row" key={term}>
              <dt>
                {term} <span className="draft-flag">Draft</span>
              </dt>
              <dd>{detail}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  );
}
