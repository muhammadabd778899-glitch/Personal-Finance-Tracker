import { HashRouter, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppLayout } from './components/Layout';
import { ToastProvider } from './components/ui';
import { DataProvider } from './state/DataContext';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { TransactionDetailPage } from './pages/TransactionDetailPage';
import { AccountsPage } from './pages/AccountsPage';
import { AccountDetailPage } from './pages/AccountDetailPage';
import { BudgetsPage } from './pages/BudgetsPage';
import { BudgetDetailPage } from './pages/BudgetDetailPage';
import { BillsPage } from './pages/BillsPage';
import { GoalsPage } from './pages/GoalsPage';
import { GoalDetailPage } from './pages/GoalDetailPage';
import { DebtPage } from './pages/DebtPage';
import { NetWorthPage } from './pages/NetWorthPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <DataProvider>
          <HashRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="transactions" element={<TransactionsPage />} />
                <Route path="transactions/new" element={<TransactionDetailPage />} />
                <Route path="transactions/:id" element={<TransactionDetailPage />} />
                <Route path="accounts" element={<AccountsPage />} />
                <Route path="accounts/:id" element={<AccountDetailPage />} />
                <Route path="budgets" element={<BudgetsPage />} />
                <Route path="budgets/:id" element={<BudgetDetailPage />} />
                <Route path="bills" element={<BillsPage />} />
                <Route path="goals" element={<GoalsPage />} />
                <Route path="goals/:id" element={<GoalDetailPage />} />
                <Route path="debt" element={<DebtPage />} />
                <Route path="net-worth" element={<NetWorthPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </HashRouter>
        </DataProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
