import { LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';

import { AppFrame } from '../components/AppFrame';
import { CommandBlock } from '../components/CommandBlock';
import { Faq } from '../components/Faq';
import { Pipeline } from '../components/Pipeline';
import { ProviderTabs } from '../components/ProviderTabs';
import { VoiceTable } from '../components/VoiceTable';
import { faq, hero, providers, runIt, steps, underTheHood, voices } from '../content';
import { Link } from '../router';

export function Home() {
  const reduce = useReducedMotion();

  return (
    <LazyMotion features={domAnimation} strict>
      <>
        {/* ------------------------------------------------------------ hero */}
        <section className="shell" style={{ paddingTop: 'clamp(3rem, 6vw, 6rem)' }}>
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
            <m.div
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <h1 className="display" style={{ marginBottom: '1.5rem' }}>
                {hero.heading}
              </h1>
              <p className="lead" style={{ marginBottom: '2rem' }}>
                {hero.lead}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Link to={hero.primary.to} className="btn btn-primary">
                  {hero.primary.label}
                </Link>
                <a href={hero.secondary.href} className="btn btn-secondary">
                  {hero.secondary.label}
                </a>
              </div>

              <p className="small" style={{ marginTop: '1.5rem', maxWidth: '30rem' }}>
                {hero.note}
              </p>
            </m.div>

            <m.div
              id="demo"
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: reduce ? 0 : 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <AppFrame
                height="min(620px, 78vh)"
                caption="The shipping application, running in this page. Its answers are scripted, because the demo mode needs no API key."
              />
            </m.div>
          </div>
        </section>

        {/* ---------------------------------------------------------- steps */}
        <section className="shell" style={{ marginTop: 'var(--section)', paddingBottom: 'var(--section)' }}>
          <hr className="rule" style={{ marginBottom: 'clamp(2.5rem, 4vw, 4rem)' }} />

          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <h2 className="heading">{steps.heading}</h2>

            <ol className="grid gap-8 sm:grid-cols-3 sm:gap-6">
              {steps.items.map((item, index) => (
                <li key={item.title}>
                  <span
                    className="mono"
                    style={{ color: 'var(--accent)', display: 'block', marginBottom: '0.6rem' }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 style={{ fontSize: 'var(--step-2)', marginBottom: '0.5rem' }}>{item.title}</h3>
                  <p className="small" style={{ fontSize: 'var(--step-0)', color: 'var(--ink-2)' }}>
                    {item.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------- providers */}
        <section style={{ background: 'var(--paper-2)', padding: 'var(--section) 0' }}>
          <div className="shell">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
              <div>
                <h2 className="heading" style={{ marginBottom: '1rem' }}>
                  {providers.heading}
                </h2>
                <p className="prose" style={{ fontSize: 'var(--step-1)' }}>
                  {providers.lead}
                </p>
              </div>
              <div>
                <ProviderTabs />
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- under the hood */}
        <section className="shell" style={{ padding: 'var(--section) 0' }}>
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div>
              <h2 className="heading" style={{ marginBottom: '1rem' }}>
                {underTheHood.heading}
              </h2>
              <p className="prose" style={{ fontSize: 'var(--step-1)', marginBottom: '2.5rem' }}>
                {underTheHood.lead}
              </p>
              <Pipeline />
            </div>

            <dl className="spec-list">
              {underTheHood.facts.map(([term, detail]) => (
                <div className="spec-row" key={term}>
                  <dt>{term}</dt>
                  <dd>{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* --------------------------------------------------------- voices */}
        <section style={{ background: 'var(--paper-2)', padding: 'var(--section) 0' }}>
          <div className="shell">
            <h2 className="heading" style={{ marginBottom: '1rem' }}>
              {voices.heading}
            </h2>
            <p className="prose" style={{ fontSize: 'var(--step-1)', marginBottom: '3rem' }}>
              {voices.lead}
            </p>

            <VoiceTable />

            <p className="small" style={{ marginTop: '2rem', maxWidth: '38rem' }}>
              {voices.note}
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------ run it */}
        <section className="shell" style={{ padding: 'var(--section) 0' }}>
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div>
              <h2 className="heading" style={{ marginBottom: '1rem' }}>
                {runIt.heading}
              </h2>
              <p className="prose" style={{ fontSize: 'var(--step-1)' }}>
                {runIt.lead}
              </p>
            </div>

            <div>
              <CommandBlock command={runIt.command} />
              <p className="small" style={{ marginTop: '1rem' }}>
                {runIt.note}
              </p>

              <dl className="spec-list" style={{ marginTop: '2.5rem' }}>
                {runIt.requirements.map(([term, detail]) => (
                  <div className="spec-row" key={term}>
                    <dt>{term}</dt>
                    <dd>{detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------- faq */}
        <section style={{ borderTop: '1px solid var(--line)', padding: 'var(--section) 0' }}>
          <div className="shell">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
              <h2 className="heading">{faq.heading}</h2>
              <Faq />
            </div>
          </div>
        </section>
      </>
    </LazyMotion>
  );
}
