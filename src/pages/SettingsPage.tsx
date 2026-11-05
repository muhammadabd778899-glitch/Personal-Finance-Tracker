import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CURRENCIES, LOCALES } from '../domain/currencies';
import { toCSV } from '../domain/csv';
import { formatDate } from '../domain/dates';
import {
  createBackup,
  backupToText,
  restoreBackupText,
  validateBackupText,
  wipeAllData,
  type BackupFile,
} from '../db/backup';
import { saveSettings, storageHealth, type StorageHealth } from '../db/repositories';
import { removeSampleData, loadSampleData } from '../db/sample';
import { useData, useFormatters } from '../state/DataContext';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  Field,
  PageIntro,
  useToast,
} from '../components/ui';
import { Icon } from '../components/icons';
import { CsvImportDialog } from '../components/CsvImportDialog';
import { formatBytes, downloadText, readFileAsText, todayStamp } from '../lib/files';
import { accountName, categoryName } from './helpers';

const APP_VERSION = '1.0.0';

export function SettingsPage() {
  const { data, today } = useData();
  const { money, date } = useFormatters();
  const { toast } = useToast();
  const settings = data.settings;
  const [storage, setStorage] = useState<StorageHealth | null>(null);
  const [pendingRestore, setPendingRestore] = useState<{
    text: string;
    summary: BackupFile;
    warnings: string[];
  } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeText, setWipeText] = useState('');
  const [wiping, setWiping] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    storageHealth()
      .then(setStorage)
      .catch(() => setStorage(null));
  }, [data.transactions.length, data.accounts.length]);

  async function update(patch: Parameters<typeof saveSettings>[0]) {
    try {
      await saveSettings(patch);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save the setting.', 'danger');
    }
  }

  async function exportBackup() {
    try {
      const backup = await createBackup();
      downloadText(
        `obsidian-finance-backup-${todayStamp()}.json`,
        backupToText(backup),
        'application/json',
      );
      toast('Backup downloaded. Keep it somewhere safe.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not create the backup.', 'danger');
    }
  }

  async function exportCsv() {
    const digits = 10 ** 2;
    const rows = data.transactions.map((tx) => [
      tx.date,
      tx.type,
      tx.description,
      tx.payee ?? '',
      tx.type === 'transfer' ? 'Transfer' : categoryName(data.categories, tx.categoryId),
      accountName(data.accounts, tx.accountId),
      (tx.amount / digits).toFixed(2),
      tx.notes ?? '',
    ]);
    downloadText(
      `transactions-all-${todayStamp()}.csv`,
      toCSV(
        ['Date', 'Type', 'Description', 'Payee', 'Category', 'Account', 'Amount', 'Notes'],
        rows,
      ),
      'text/csv;charset=utf-8',
    );
    toast('CSV export downloaded.', 'success');
  }

  async function pickRestore(file: File | undefined) {
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const validated = validateBackupText(text);
      setPendingRestore({ text, summary: validated.file, warnings: validated.warnings });
    } catch (error) {
      toast(error instanceof Error ? error.message : 'This backup is not valid.', 'danger');
    }
  }

  async function confirmRestore() {
    if (!pendingRestore) return;
    setRestoring(true);
    try {
      const safety = await createBackup();
      downloadText(
        `pre-restore-backup-${todayStamp()}.json`,
        backupToText(safety),
        'application/json',
      );
      await restoreBackupText(pendingRestore.text);
      setPendingRestore(null);
      toast('Backup restored. A safety copy was downloaded first.', 'success');
    } catch (error) {
      toast(
        error instanceof Error
          ? `Restore failed and your existing data was left unchanged: ${error.message}`
          : 'Restore failed. Your existing data was left unchanged.',
        'danger',
      );
    } finally {
      setRestoring(false);
    }
  }

  async function confirmWipe() {
    if (wipeText.trim().toUpperCase() !== 'ERASE') {
      toast('Type ERASE exactly to confirm.', 'danger');
      return;
    }
    setWiping(true);
    try {
      const safety = await createBackup();
      downloadText(
        `pre-erase-backup-${todayStamp()}.json`,
        backupToText(safety),
        'application/json',
      );
      await wipeAllData();
      setWipeOpen(false);
      setWipeText('');
      toast('All workspace data erased. A safety backup was downloaded first.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not erase the workspace.', 'danger');
    } finally {
      setWiping(false);
    }
  }

  async function confirmSample() {
    setSampleBusy(true);
    try {
      const result = settings.sampleDataLoaded ? null : await loadSampleData();
      if (settings.sampleDataLoaded) {
        const removed = await removeSampleData();
        toast(`Removed ${removed} sample records. Real records were untouched.`, 'success');
      } else if (result?.ok) {
        toast('Sample workspace loaded. It is clearly labelled in this workspace.', 'success');
      } else {
        toast(result?.reason ?? 'Sample data could not be loaded.', 'danger');
      }
      setSampleOpen(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not update sample data.', 'danger');
    } finally {
      setSampleBusy(false);
    }
  }

  const countEntries = pendingRestore
    ? Object.entries(pendingRestore.summary.meta.counts ?? {})
    : [];

  return (
    <div className="stack">
      <PageIntro
        title="Settings and data"
        description="Control how the workspace looks and how your data is stored, exported and restored. Settings apply immediately."
      />

      <Card className="card-pad">
        <section className="settings-section">
          <div>
            <h3>Appearance</h3>
            <p className="desc">Choose a light or dark workspace, or follow your system.</p>
          </div>
          <div className="settings-content">
            <div className="segmented" role="group" aria-label="Theme">
              {(['light', 'dark', 'system'] as const).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  aria-pressed={settings.theme === theme}
                  onClick={() => update({ theme })}
                >
                  {theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System'}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="settings-section">
          <div>
            <h3>Currency and dates</h3>
            <p className="desc">
              Display settings only. Amounts are stored as integer minor units.
            </p>
          </div>
          <div className="settings-content">
            <div className="form-grid">
              <Field label="Currency" htmlFor="setting-currency">
                <select
                  id="setting-currency"
                  className="select"
                  value={settings.currency}
                  onChange={(event) => update({ currency: event.target.value })}
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} — {currency.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Locale" htmlFor="setting-locale">
                <select
                  id="setting-locale"
                  className="select"
                  value={settings.locale}
                  onChange={(event) => update({ locale: event.target.value })}
                >
                  {LOCALES.map((locale) => (
                    <option key={locale.code} value={locale.code}>
                      {locale.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date format" htmlFor="setting-date-format">
                <select
                  id="setting-date-format"
                  className="select"
                  value={settings.dateFormat}
                  onChange={(event) =>
                    update({ dateFormat: event.target.value as typeof settings.dateFormat })
                  }
                >
                  <option value="iso">ISO — {formatDate(today, 'iso', settings.locale)}</option>
                  <option value="us">US — {formatDate(today, 'us', settings.locale)}</option>
                  <option value="eu">EU — {formatDate(today, 'eu', settings.locale)}</option>
                  <option value="long">Long — {formatDate(today, 'long', settings.locale)}</option>
                </select>
              </Field>
              <Field label="Week starts on" htmlFor="setting-week-start">
                <select
                  id="setting-week-start"
                  className="select"
                  value={String(settings.firstDayOfWeek)}
                  onChange={(event) =>
                    update({ firstDayOfWeek: Number(event.target.value) === 0 ? 0 : 1 })
                  }
                >
                  <option value="1">Monday</option>
                  <option value="0">Sunday</option>
                </select>
              </Field>
            </div>
            <div className="notice notice-warning">
              <Icon name="alert" size={17} />
              <span>
                Changing currency does not convert existing amounts. All amounts keep their numeric
                value; the symbol and decimal display change. Choose the currency before entering
                data.
              </span>
            </div>
            <p className="tiny muted">
              Preview: {money(123456)} · stored as integer minor units. Zero-decimal currencies
              (such as JPY) are handled automatically.
            </p>
          </div>
        </section>

        <section className="settings-section">
          <div>
            <h3>Backup and restore</h3>
            <p className="desc">
              Versioned JSON includes every record. Restoring replaces the workspace only after a
              safety copy is downloaded.
            </p>
          </div>
          <div className="settings-content">
            <div className="row">
              <Button
                variant="primary"
                onClick={exportBackup}
                icon={<Icon name="download" size={16} />}
              >
                Download JSON backup
              </Button>
              <Button
                variant="secondary"
                onClick={exportCsv}
                icon={<Icon name="download" size={16} />}
              >
                Export all transactions (CSV)
              </Button>
            </div>
            <div className="row">
              <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                <Icon name="upload" size={16} /> Restore from backup
                <input
                  type="file"
                  accept="application/json,.json"
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    pickRestore(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </label>
              <Button
                variant="secondary"
                onClick={() => setImportOpen(true)}
                icon={<Icon name="upload" size={16} />}
              >
                Import transactions (CSV)
              </Button>
            </div>
            <p className="tiny muted">
              Backups are validated for app identity, version, checksum, schema and references
              before a single record is written.
            </p>
          </div>
        </section>

        <section className="settings-section">
          <div>
            <h3>Sample data</h3>
            <p className="desc">
              A clearly labelled example workspace for exploring every feature without risking real
              records.
            </p>
          </div>
          <div className="settings-content">
            {settings.sampleDataLoaded ? (
              <div className="row">
                <Badge tone="accent">Sample workspace active</Badge>
                <Button variant="secondary" onClick={() => setSampleOpen(true)}>
                  Remove sample data
                </Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setSampleOpen(true)}>
                Load sample workspace
              </Button>
            )}
            <p className="tiny muted">
              Sample records use IDs beginning with <code>sample-</code>. Removal deletes only those
              records; real records are never touched. Loading is refused when real accounts exist.
            </p>
          </div>
        </section>

        <section className="settings-section">
          <div>
            <h3>Storage</h3>
            <p className="desc">Everything is stored locally in this browser with IndexedDB.</p>
          </div>
          <div className="settings-content">
            {storage ? (
              <dl className="detail-list">
                <div>
                  <dt>Data stored</dt>
                  <dd>{formatBytes(storage.usage)}</dd>
                </div>
                <div>
                  <dt>Browser quota</dt>
                  <dd>{formatBytes(storage.quota)}</dd>
                </div>
                <div>
                  <dt>Persistent storage</dt>
                  <dd>
                    {storage.persisted == null
                      ? 'Not supported'
                      : storage.persisted
                        ? 'Granted'
                        : 'Not granted'}
                  </dd>
                </div>
                <div>
                  <dt>Offline cache</dt>
                  <dd>
                    {typeof navigator !== 'undefined' && 'serviceWorker' in navigator
                      ? 'Supported'
                      : 'Not available'}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="small muted">Storage details are unavailable in this browser.</p>
            )}
            <div className="notice">
              <Icon name="lock" size={17} />
              <span>
                Clearing browser data, private browsing, or a new device will not have your records.
                Keep a JSON backup. This app does not sync to a cloud.
              </span>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <div>
            <h3>Danger zone</h3>
            <p className="desc">
              Erase every record from this browser. A safety backup downloads first.
            </p>
          </div>
          <div className="settings-content">
            <div className="danger-zone">
              <div className="row-between">
                <div>
                  <strong className="small">Erase this workspace</strong>
                  <p className="tiny muted" style={{ marginTop: 2 }}>
                    Settings are kept; accounts, transactions, budgets, bills, goals and debt
                    details are removed.
                  </p>
                </div>
                <Button variant="danger" onClick={() => setWipeOpen(true)}>
                  Erase data
                </Button>
              </div>
            </div>
          </div>
        </section>
      </Card>

      <Card className="card-pad">
        <div className="row-between">
          <div>
            <h3 className="card-title">About this app</h3>
            <p className="small muted" style={{ marginTop: 4 }}>
              Obsidian Finance — Ultimate Personal Finance Tracker v{APP_VERSION}. Offline-first,
              single-user, no bank connections, no telemetry, no subscription.
            </p>
          </div>
          <Badge tone="accent">Local-first</Badge>
        </div>
        <hr className="divider" style={{ margin: '16px 0' }} />
        <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
          <Link to="/reports" className="small">
            Reports
          </Link>
          <Link to="/transactions" className="small">
            Transactions
          </Link>
          <span className="small muted">Today: {date(today)}</span>
          <span className="small muted">Records are stored only in this browser.</span>
        </div>
      </Card>

      <Dialog
        open={pendingRestore !== null}
        onClose={() => setPendingRestore(null)}
        title="Restore this backup?"
        description="Your current workspace will be replaced by the contents of the file."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingRestore(null)} disabled={restoring}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmRestore} disabled={restoring}>
              {restoring ? 'Restoring…' : 'Download safety copy and restore'}
            </Button>
          </>
        }
      >
        {pendingRestore ? (
          <div className="stack">
            <div className="notice notice-warning">
              <Icon name="alert" size={17} />
              <span>
                A backup of your current data downloads automatically before the restore begins. If
                the restore fails, your existing database is left unchanged.
              </span>
            </div>
            <dl className="detail-list">
              <div>
                <dt>Format version</dt>
                <dd>{pendingRestore.summary.meta.version}</dd>
              </div>
              <div>
                <dt>Exported</dt>
                <dd>{pendingRestore.summary.meta.exportedAt.slice(0, 19).replace('T', ' ')}</dd>
              </div>
              <div>
                <dt>Checksum</dt>
                <dd>{pendingRestore.summary.meta.checksum}</dd>
              </div>
            </dl>
            {countEntries.length > 0 ? (
              <div className="row" style={{ gap: 10 }}>
                {countEntries.map(([key, value]) => (
                  <Badge key={key}>
                    {value} {key}
                  </Badge>
                ))}
              </div>
            ) : null}
            {pendingRestore.warnings.map((warning) => (
              <p key={warning} className="tiny muted">
                {warning}
              </p>
            ))}
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={wipeOpen}
        onClose={() => {
          setWipeOpen(false);
          setWipeText('');
        }}
        title="Erase all workspace data"
        description="This cannot be undone without a backup."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setWipeOpen(false);
                setWipeText('');
              }}
              disabled={wiping}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmWipe}
              disabled={wiping || wipeText.trim().toUpperCase() !== 'ERASE'}
            >
              {wiping ? 'Erasing…' : 'Erase everything'}
            </Button>
          </>
        }
      >
        <div className="stack">
          <p className="small muted">
            A JSON backup of the current workspace downloads automatically before erasing. Accounts,
            transactions, budgets, bills, goals, contributions and debt details will be removed.
          </p>
          <Field label="Type ERASE to confirm" htmlFor="wipe-confirm">
            <input
              id="wipe-confirm"
              className="input"
              value={wipeText}
              onChange={(event) => setWipeText(event.target.value)}
              placeholder="ERASE"
              autoComplete="off"
            />
          </Field>
        </div>
      </Dialog>

      <ConfirmDialog
        open={sampleOpen}
        onCancel={() => setSampleOpen(false)}
        onConfirm={confirmSample}
        title={settings.sampleDataLoaded ? 'Remove sample data?' : 'Load sample workspace?'}
        description={
          settings.sampleDataLoaded
            ? 'Only records with sample IDs are removed.'
            : 'Sample records are clearly labelled and can be removed later.'
        }
        confirmLabel={settings.sampleDataLoaded ? 'Remove sample data' : 'Load sample data'}
        danger={settings.sampleDataLoaded}
        busy={sampleBusy}
      >
        <p className="small muted">
          {settings.sampleDataLoaded
            ? 'Your real accounts, transactions and settings are not affected. A backup is still a good idea before any bulk change.'
            : 'Sample data can only be loaded when no real accounts exist. It uses realistic accounts, transactions, budgets, bills, goals and debt so you can explore every screen.'}
        </p>
      </ConfirmDialog>

      <CsvImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
