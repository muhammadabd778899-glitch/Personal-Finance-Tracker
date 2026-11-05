import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { NAV_ITEMS, pageMeta } from '../navigation';
import { saveSettings } from '../db/repositories';
import { useSettings } from '../state/DataContext';
import { Button, Dialog, useToast } from './ui';
import { Icon } from './icons';
import { TransactionForm } from './TransactionForm';

export function AppLayout() {
  const settings = useSettings();
  const location = useLocation();
  const { toast } = useToast();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const meta = pageMeta(location.pathname);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.title = `${meta.title} · Obsidian Finance — Ultimate Personal Finance Tracker`;
  }, [location.pathname, meta.title]);

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
            onClick={() => setQuickAddOpen(true)}
          >
            Add transaction
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
