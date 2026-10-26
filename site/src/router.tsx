import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';

/**
 * A very small router.
 *
 * Four pages do not need a routing library: the History API, one listener
 * and a link that intercepts ordinary clicks.
 */

/**
 * The path the site is served from, without the trailing slash.
 *
 * A site under a sub path, like the one GitHub Pages serves, keeps that path
 * in the address bar, so it is taken off before the page is looked up.
 */
function basePath(): string {
  return import.meta.env.BASE_URL.replace(/\/+$/, '');
}

function currentPath(): string {
  const base = basePath();
  const path = window.location.pathname.replace(/\/+$/, '');
  const stripped = base && path.startsWith(base) ? path.slice(base.length) : path;
  return stripped || '/';
}

export function useRoute(): string {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onPop = () => setPath(currentPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return path;
}

export function navigate(to: string): void {
  const target = `${basePath()}${to.startsWith('/') ? to : `/${to}`}`;
  if (target === window.location.pathname) return;
  window.history.pushState({}, '', target);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
}

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  children: ReactNode;
}

export function Link({ to, children, onClick, ...rest }: LinkProps) {
  return (
    <a
      href={`${basePath()}${to.startsWith('/') ? to : `/${to}`}`}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
