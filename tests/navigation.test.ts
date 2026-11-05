import { activeNav, NAV_ITEMS, pageMeta } from '../src/navigation';

describe('navigation model', () => {
  it('exposes one unique destination per workspace area', () => {
    const paths = NAV_ITEMS.map((item) => item.to);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain('/');
    expect(paths).toContain('/transactions');
    expect(paths).toContain('/reports');
  });

  it('resolves breadcrumbs for index and detail routes', () => {
    expect(pageMeta('/')).toEqual({ title: 'Dashboard' });
    expect(pageMeta('/transactions')).toEqual({ title: 'Transactions' });
    expect(pageMeta('/transactions/new')).toMatchObject({
      title: 'New transaction',
      parent: { to: '/transactions' },
    });
    expect(pageMeta('/accounts/abc')).toMatchObject({
      title: 'Account',
      parent: { to: '/accounts' },
    });
    expect(pageMeta('/budgets/abc')).toMatchObject({ title: 'Budget' });
    expect(pageMeta('/goals/abc')).toMatchObject({ title: 'Goal' });
    expect(pageMeta('/unknown')).toEqual({ title: 'Not found' });
  });

  it('keeps the parent route selected on detail pages', () => {
    expect(activeNav('/')).toBe('/');
    expect(activeNav('/transactions/abc')).toBe('/transactions');
    expect(activeNav('/accounts/abc')).toBe('/accounts');
    expect(activeNav('/bills/abc')).toBe('/bills');
    expect(activeNav('/unknown')).toBe('/unknown');
  });
});
