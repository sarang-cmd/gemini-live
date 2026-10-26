import { product } from '../content';
import { Link } from '../router';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <Link to="/" className="wordmark" style={{ color: 'var(--ink)' }}>
            <span className="wordmark-dot" aria-hidden="true" />
            {product.name}
          </Link>
          <p className="small" style={{ marginTop: '0.75rem', maxWidth: '28rem' }}>
            A desktop voice assistant built on the Gemini Live API and Groq. Independent project,
            not affiliated with Google or Groq. Your keys stay on your machine.
          </p>
        </div>

        <nav aria-label="Product">
          <h2 className="small" style={{ color: 'var(--ink)', marginBottom: '0.75rem' }}>
            Product
          </h2>
          <ul className="footer-links">
            <li>
              <Link to="/">Overview</Link>
            </li>
            <li>
              <Link to="/download">Download</Link>
            </li>
            <li>
              <a href={product.repo} target="_blank" rel="noreferrer">
                Source on GitHub
              </a>
            </li>
            <li>
              <a href={product.liveDocs} target="_blank" rel="noreferrer">
                Gemini Live API
              </a>
            </li>
            <li>
              <a href={product.groqDocs} target="_blank" rel="noreferrer">
                Groq documentation
              </a>
            </li>
          </ul>
        </nav>

        <nav aria-label="Legal">
          <h2 className="small" style={{ color: 'var(--ink)', marginBottom: '0.75rem' }}>
            Legal
          </h2>
          <ul className="footer-links">
            <li>
              <Link to="/privacy">Privacy</Link>
            </li>
            <li>
              <Link to="/terms">Terms</Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
