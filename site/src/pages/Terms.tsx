import { terms } from '../content';

export function Terms() {
  return (
    <article className="shell" style={{ paddingTop: 'clamp(3rem, 6vw, 5.5rem)' }}>
      <div style={{ maxWidth: '42rem' }}>
        <h1 className="display" style={{ fontSize: 'var(--step-4)', marginBottom: '1.25rem' }}>
          {terms.heading}
        </h1>
        <p className="lead">{terms.lead}</p>
        <p style={{ marginTop: '1.25rem' }}>
          <span className="draft-flag">Draft for review</span>
        </p>
      </div>

      {terms.sections.map((section) => (
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
          Not settled
        </h2>
        <p className="prose" style={{ marginBottom: '1.25rem' }}>
          These details need a decision before this page can be treated as an agreement.
        </p>
        <dl className="spec-list">
          {terms.drafts.map(([term, detail]) => (
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
