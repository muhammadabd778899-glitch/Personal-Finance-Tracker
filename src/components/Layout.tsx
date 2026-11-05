import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { NAV_ITEMS, pageMeta } from '../navigation';
import { saveSettings } from '../db/repositories';
import { useSettings } from '../state/DataContext';
import { Button, Dialog, useToast } from './ui';
import { Icon } from './icons';
import { TransactionForm } from './TransactionForm';

function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar-brand">
        <span className="brand-mark" aria-hidden="true">
          <Icon name="networth" size={21} />
        </span>
        <span className="brand-text">
          <strong>Harbor Finance</strong>
          <span>Personal workspace</span>
        </span>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Workspace</div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className="nav-item"
            aria-label={item.label}
            onClick={onNavigate}
          >
            <span className="nav-icon">
              <Icon name={item.icon} size={19} />
            </span>
            <span className="nav-label">{item.label}</span>
            <span className="nav-tooltip" aria-hidden="true">
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <Button
          variant="ghost"
          size="sm"
          className="collapse-btn"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
          icon={<Icon name={collapsed ? 'expand' : 'collapse'} size={18} />}
        >
          <span className="sidebar-footer-text">{collapsed ? '' : 'Collapse sidebar'}</span>
        </Button>
      </div>
    </aside>
  );
}

export function AppLayout() {
  const settings = useSettings();
  const location = useLocation();
  const { toast } = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const meta = pageMeta(location.pathname);
  const collapsed = settings.sidebarCollapsed;

  useEffect(() => {
    setDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.title = `${meta.title} · Harbor Finance — Ultimate Personal Finance Tracker`;
  }, [location.pathname, meta.title]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  async function toggleSidebar() {
    try {
      await saveSettings({ sidebarCollapsed: !collapsed });
    } catch {
      toast('Could not save the sidebar preference.', 'danger');
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
    <div
      className="app-shell"
      data-collapsed={collapsed ? 'true' : 'false'}
      data-drawer={drawerOpen ? 'open' : 'closed'}
    >
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Sidebar
        collapsed={collapsed}
        onToggle={toggleSidebar}
        onNavigate={() => setDrawerOpen(false)}
      />
      {drawerOpen ? (
        <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      ) : null}

      <div className="app-main">
        <header className="topbar">
          <Button
            variant="ghost"
            className="btn-icon mobile-menu-btn"
            aria-label={drawerOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((open) => !open)}
          >
            <Icon name={drawerOpen ? 'close' : 'menu'} size={20} />
          </Button>

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
