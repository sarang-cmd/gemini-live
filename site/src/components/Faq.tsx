import * as Accordion from '@radix-ui/react-accordion';

import { faq } from '../content';

export function Faq() {
  return (
    <Accordion.Root type="single" collapsible className="faq-root">
      {faq.items.map((item) => (
        <Accordion.Item key={item.question} value={item.question} className="accordion-item">
          <Accordion.Header>
            <Accordion.Trigger className="accordion-trigger">
              {item.question}
              <span className="accordion-chevron" aria-hidden="true" />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="accordion-content">
            <div className="accordion-body">{item.answer}</div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
