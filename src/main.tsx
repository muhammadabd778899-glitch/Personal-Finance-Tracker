import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { bootstrapDatabase } from './state/DataContext';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

const root = createRoot(container);

bootstrapDatabase()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'The local database could not be opened.';
    root.render(
      <div className="page">
        <div className="card card-pad stack" role="alert">
          <h1 className="font-display">Storage is unavailable</h1>
          <p className="muted">
            This app stores your data in this browser using IndexedDB. It could not be opened — this
            often happens in private browsing modes or when site storage is blocked.
          </p>
          <p className="small" style={{ color: 'var(--danger)' }}>
            {message}
          </p>
          <p className="small muted">
            Try a regular (non-private) window, allow site data for this page, then reload.
          </p>
        </div>
      </div>,
    );
  });
