import * as Tabs from '@radix-ui/react-tabs';

import { providers } from '../content';

export function ProviderTabs() {
  return (
    <Tabs.Root defaultValue={providers.tabs[0].id}>
      <Tabs.List className="tabs-list" aria-label="Providers">
        {providers.tabs.map((tab) => (
          <Tabs.Trigger key={tab.id} value={tab.id} className="tabs-trigger">
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {providers.tabs.map((tab) => (
        <Tabs.Content key={tab.id} value={tab.id} className="tabs-panel" forceMount>
          <div className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:gap-12">
            <div>
              <p className="lead" style={{ marginBottom: '1.25rem' }}>
                {tab.summary}
              </p>
              <p className="small" style={{ maxWidth: '32rem' }}>
                Model in use: <span className="mono">{tab.model}</span>
              </p>
            </div>

            <dl className="spec-list">
              {tab.facts.map(([term, detail]) => (
                <div className="spec-row" key={term}>
                  <dt>{term}</dt>
                  <dd>{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
