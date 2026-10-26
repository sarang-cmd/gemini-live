import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';

/**
 * A very small router.
 *
 * Four pages do not need a routing library: the History API, one listener
 * and a link that intercepts ordinary clicks.
 */

function currentPath(): string {
  const path = window.location.pathname.replace(/\/+$/, '');
  return path || '/';
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
  if (to === currentPath()) return;
  window.history.pushState({}, '', to);
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
      href={to}
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
