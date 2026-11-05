import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { NAV_ITEMS, pageMeta } from '../navigation';
import { saveSettings } from '../db/repositories';
import { loadSampleData } from '../db/sample';
import { useData, useSettings } from '../state/DataContext';
import { Button, Dialog, useToast } from './ui';
import { Icon } from './icons';
import { TransactionForm } from './TransactionForm';

export function AppLayout() {
  const settings = useSettings();
  const { data } = useData();
  const location = useLocation();
  const { toast } = useToast();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const meta = pageMeta(location.pathname);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.title = `${meta.title} · Obsidian Finance — Ultimate Personal Finance Tracker`;
  }, [location.pathname, meta.title]);

  async function addSample() {
    setSampleBusy(true);
    try {
      const result = await loadSampleData();
      if (result.ok) toast('Sample workspace loaded. Remove it any time in Settings.', 'success');
      else toast(result.reason ?? 'Sample data could not be loaded.', 'danger');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not load sample data.', 'danger');
    } finally {
      setSampleBusy(false);
    }
  }

  async function toggleTheme() {
    const resolved =
      settings.theme === 'system'
        ? window.matchMedia?.('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : settings.theme;
    try {
      await saveSettings({ theme: resolved === 'dark' ? 'light' : 'dark' });
    } catch {
      toast('Could not save the appearance setting.', 'danger');
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="topbar">
        <div className="topbar-titles">
          {meta.parent ? (
            <div className="breadcrumb">
              <Link to={meta.parent.to}>{meta.parent.label}</Link>
              <Icon name="chevron-right" size={11} />
              <span aria-current="page">{meta.title}</span>
            </div>
          ) : (
            <div className="breadcrumb">
              <span>{settings.sampleDataLoaded ? 'Sample workspace' : 'Local workspace'}</span>
            </div>
          )}
          <h1>{meta.title}</h1>
        </div>

        <div className="topbar-actions">
          {settings.sampleDataLoaded ? (
            <span className="topbar-sample">Sample data</span>
          ) : data.accounts.length === 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={addSample}
              disabled={sampleBusy}
              aria-label="Load sample data"
              title="Load a clearly labelled sample workspace"
              icon={<Icon name="sparkle" size={16} />}
            >
              <span className="btn-label">{sampleBusy ? 'Loading…' : 'Load sample data'}</span>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            className="btn-icon"
            onClick={toggleTheme}
            aria-label={`Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} theme`}
            title="Toggle appearance"
          >
            <Icon name={settings.theme === 'dark' ? 'sun' : 'moon'} size={19} />
          </Button>
          <Button
            variant="primary"
            icon={<Icon name="plus" size={17} />}
            aria-label="Add transaction"
            onClick={() => setQuickAddOpen(true)}
          >
            <span className="btn-label">Add transaction</span>
          </Button>
        </div>
      </header>

      <nav className="topnav" aria-label="Primary navigation">
        <div className="topnav-inner">
          <Link to="/" className="topnav-link topnav-brand">
            <span className="brand-mark" aria-hidden="true">
              <Icon name="networth" size={17} />
            </span>
            <span className="brand-text">
              <strong>Obsidian Finance</strong>
              <span>Personal workspace</span>
            </span>
          </Link>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `topnav-link${isActive ? ' topnav-link-active' : ''}`}
            >
              <span className="nav-icon">
                <Icon name={item.icon} size={17} />
              </span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="app-main">
        <main id="main-content" className="page" ref={mainRef} tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <Dialog
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        title="Quick add transaction"
        description="Amount, account and description are all you need. More fields are available in the full editor."
      >
        <TransactionForm
          presetType="expense"
          compact
          onCancel={() => setQuickAddOpen(false)}
          onSaved={() => setQuickAddOpen(false)}
        />
      </Dialog>
    </div>
  );
}
