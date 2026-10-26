import { SiteFooter } from './components/SiteFooter';
import { SiteHeader } from './components/SiteHeader';
import { Download } from './pages/Download';
import { Home } from './pages/Home';
import { Privacy } from './pages/Privacy';
import { Terms } from './pages/Terms';
import { useRoute } from './router';

export default function App() {
  const path = useRoute();

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <SiteHeader />

      <main id="main">
        {path === '/' ? <Home /> : null}
        {path === '/download' ? <Download /> : null}
        {path === '/privacy' ? <Privacy /> : null}
        {path === '/terms' ? <Terms /> : null}
        {path !== '/' && path !== '/download' && path !== '/privacy' && path !== '/terms' ? (
          <div className="shell" style={{ padding: '6rem 0' }}>
            <h1 className="heading">That page does not exist</h1>
            <p className="prose" style={{ marginTop: '1rem' }}>
              The address you followed is not part of this site. Start from the overview.
            </p>
          </div>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}
