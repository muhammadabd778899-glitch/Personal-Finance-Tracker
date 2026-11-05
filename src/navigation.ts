import type { IconName } from './components/icons';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/transactions', label: 'Transactions', icon: 'transactions' },
  { to: '/accounts', label: 'Accounts', icon: 'accounts' },
  { to: '/budgets', label: 'Budgets', icon: 'budget' },
  { to: '/bills', label: 'Bills & Calendar', icon: 'bills' },
  { to: '/goals', label: 'Savings Goals', icon: 'goals' },
  { to: '/debt', label: 'Debt', icon: 'debt' },
  { to: '/net-worth', label: 'Net Worth', icon: 'networth' },
  { to: '/reports', label: 'Reports', icon: 'reports' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

export interface PageMeta {
  title: string;
  parent?: { label: string; to: string };
}

const EXACT: Record<string, PageMeta> = {
  '/': { title: 'Dashboard' },
  '/transactions': { title: 'Transactions' },
  '/transactions/new': {
    title: 'New transaction',
    parent: { label: 'Transactions', to: '/transactions' },
  },
  '/accounts': { title: 'Accounts' },
  '/accounts/new': { title: 'New account', parent: { label: 'Accounts', to: '/accounts' } },
  '/budgets': { title: 'Budgets' },
  '/budgets/new': { title: 'New budget', parent: { label: 'Budgets', to: '/budgets' } },
  '/bills': { title: 'Bills & Calendar' },
  '/bills/new': { title: 'New scheduled item', parent: { label: 'Bills', to: '/bills' } },
  '/goals': { title: 'Savings Goals' },
  '/goals/new': { title: 'New goal', parent: { label: 'Goals', to: '/goals' } },
  '/debt': { title: 'Debt' },
  '/net-worth': { title: 'Net Worth' },
  '/reports': { title: 'Reports' },
  '/settings': { title: 'Settings' },
};

export function pageMeta(pathname: string): PageMeta {
  if (EXACT[pathname]) return EXACT[pathname];
  if (pathname.startsWith('/transactions/')) {
    return { title: 'Transaction', parent: { label: 'Transactions', to: '/transactions' } };
  }
  if (pathname.startsWith('/accounts/')) {
    return { title: 'Account', parent: { label: 'Accounts', to: '/accounts' } };
  }
  if (pathname.startsWith('/budgets/')) {
    return { title: 'Budget', parent: { label: 'Budgets', to: '/budgets' } };
  }
  if (pathname.startsWith('/goals/')) {
    return { title: 'Goal', parent: { label: 'Goals', to: '/goals' } };
  }
  if (pathname.startsWith('/bills/')) {
    return { title: 'Scheduled item', parent: { label: 'Bills', to: '/bills' } };
  }
  return { title: 'Not found' };
}

export function activeNav(pathname: string): string {
  if (pathname === '/') return '/';
  const match = NAV_ITEMS.find((item) => item.to !== '/' && pathname.startsWith(item.to));
  return match?.to ?? pathname;
}
