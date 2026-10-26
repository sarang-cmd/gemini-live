import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';

import { product } from '../content';
import { Link, useRoute } from '../router';

const links = [
  { to: '/', label: 'Overview' },
  { to: '/download', label: 'Download' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const path = useRoute();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="site-header" data-scrolled={scrolled}>
      <div className="shell site-nav">
        <Link to="/" className="wordmark" aria-label={`${product.name}, home`}>
          <span className="wordmark-dot" aria-hidden="true" />
          {product.name}
        </Link>

        <nav className="nav-links" aria-label="Main">
          {links.map((link) => (
            <Link key={link.to} to={link.to} aria-current={path === link.to ? 'page' : undefined}>
              {link.label}
            </Link>
          ))}
          <a
            className="btn btn-primary"
            href={product.repo}
            target="_blank"
            rel="noreferrer"
            style={{ minHeight: '2.25rem', padding: '0 0.9rem' }}
          >
            Source
          </a>
        </nav>

        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              className="btn btn-secondary nav-mobile-trigger"
              aria-label="Open menu"
            >
              Menu
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="dialog-panel">
              <div className="flex items-center justify-between">
                <Dialog.Title className="wordmark">
                  <span className="wordmark-dot" aria-hidden="true" />
                  {product.name}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ minHeight: '2.25rem' }}
                  >
                    Close
                  </button>
                </Dialog.Close>
              </div>

              <ul>
                {links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      onClick={() => setOpen(false)}
                      aria-current={path === link.to ? 'page' : undefined}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <a href={product.repo} target="_blank" rel="noreferrer">
                    Source on GitHub
                  </a>
                </li>
              </ul>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </header>
  );
}
