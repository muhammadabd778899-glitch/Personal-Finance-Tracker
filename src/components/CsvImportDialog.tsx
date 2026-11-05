import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildImportPreview,
  detectMapping,
  parseCSV,
  type ImportMapping,
  type ImportPreview,
} from '../domain/csv';
import { bulkCreateTransactions, duplicateSignatures } from '../db/transactions';
import { useData, useFormatters } from '../state/DataContext';
import { Badge, Button, Dialog, Field, useToast } from './ui';
import { Icon } from './icons';
import { readFileAsText } from '../lib/files';

type Step = 'pick' | 'map' | 'confirm';

export function CsvImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useData();
  const { money } = useFormatters();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('pick');
  const [text, setText] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [defaultAccountId, setDefaultAccountId] = useState('');
  const [signatures, setSignatures] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('pick');
    setText('');
    setHeaders([]);
    setRows([]);
    setParseErrors([]);
    setPreview(null);
    setDefaultAccountId(
      data.accounts.find((account) => account.id === data.settings.lastAccountId)?.id ??
        data.accounts[0]?.id ??
        '',
    );
    duplicateSignatures()
      .then(setSignatures)
      .catch(() => setSignatures(new Set()));
  }, [open, data.accounts, data.settings.lastAccountId]);

  const accountsByName = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const account of data.accounts) map.set(account.name.trim().toLowerCase(), account);
    return map;
  }, [data.accounts]);
  const categoriesByName = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const category of data.categories) {
      if (!category.archived) map.set(category.name.trim().toLowerCase(), category);
    }
    return map;
  }, [data.categories]);

  function computePreview(nextMapping: ImportMapping) {
    if (!defaultAccountId) return;
    const result = buildImportPreview({
      headers,
      rows,
      mapping: nextMapping,
      existingSignature: (signature) => signatures.has(signature),
      defaultAccountName:
        data.accounts.find((account) => account.id === defaultAccountId)?.name ?? 'Account',
      currencyDigits: 2,
    });
    setPreview(result);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      const content = await readFileAsText(file);
      const parsed = parseCSV(content);
      if (parsed.headers.length === 0) {
        toast(parsed.errors[0] ?? 'This file has no readable columns.', 'danger');
        return;
      }
      const detected = detectMapping(parsed.headers);
      setText(content);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setParseErrors(parsed.errors);
      setMapping(detected);
      const initial = buildImportPreview({
        headers: parsed.headers,
        rows: parsed.rows,
        mapping: detected,
        existingSignature: (signature) => signatures.has(signature),
        defaultAccountName:
          data.accounts.find((account) => account.id === defaultAccountId)?.name ?? 'Account',
        currencyDigits: 2,
      });
      setPreview(initial);
      setStep('map');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not read the file.', 'danger');
    }
  }

  function updateMapping(index: number, field: ImportMapping[number]) {
    const next = { ...mapping, [index]: field };
    setMapping(next);
    computePreview(next);
  }

  async function commit() {
    if (!preview) return;
    const readyRows = preview.results.filter((row) => row.status === 'ready' && row.values);
    if (readyRows.length === 0) {
      toast('There are no valid rows to import.', 'danger');
      return;
    }
    setBusy(true);
    try {
      const inputs = readyRows.map((row) => {
        const values = row.values!;
        const accountMatch = values.accountName
          ? accountsByName.get(values.accountName.trim().toLowerCase())
          : undefined;
        const categoryMatch = values.categoryName
          ? categoriesByName.get(values.categoryName.trim().toLowerCase())
          : undefined;
        return {
          type: values.type,
          amount: values.amount,
          date: values.date,
          accountId: accountMatch?.id ?? defaultAccountId,
          categoryId: categoryMatch?.id,
          description: values.description,
          payee: values.payee,
          notes: values.notes,
          tags: ['imported'],
        };
      });
      const count = await bulkCreateTransactions(inputs);
      toast(`${count} transaction${count === 1 ? '' : 's'} imported.`, 'success');
      onClose();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'The import could not be completed.',
        'danger',
      );
    } finally {
      setBusy(false);
    }
  }

  const footer =
    step === 'map' ? (
      <>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => setStep('confirm')}
          disabled={!preview || preview.ready === 0}
        >
          Review {preview?.ready ?? 0} rows
        </Button>
      </>
    ) : step === 'confirm' ? (
      <>
        <Button variant="ghost" onClick={() => setStep('map')} disabled={busy}>
          Back
        </Button>
        <Button variant="primary" onClick={commit} disabled={busy}>
          {busy ? 'Importing…' : `Import ${preview?.ready ?? 0} rows`}
        </Button>
      </>
    ) : undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Import transactions from CSV"
      description="Map columns, review every row, and exclude duplicates before anything is saved."
      wide={step !== 'pick'}
      footer={footer}
    >
      {step === 'pick' ? (
        <div className="stack">
          <div className="notice">
            <Icon name="upload" size={17} />
            <span>
              Choose a CSV file exported from a bank or spreadsheet. Nothing is uploaded — the file
              is read locally in this browser.
            </span>
          </div>
          <Field
            label="CSV file"
            htmlFor="csv-file"
            hint="UTF-8 or plain text, first row must contain column names."
          >
            <input
              ref={fileRef}
              id="csv-file"
              type="file"
              accept=".csv,text/csv,text/plain"
              className="input"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </Field>
          <Field
            label="Default account"
            htmlFor="csv-account"
            hint="Used when a row has no matching account name."
          >
            <select
              id="csv-account"
              className="select"
              value={defaultAccountId}
              onChange={(event) => setDefaultAccountId(event.target.value)}
            >
              {data.accounts
                .filter((account) => !account.archived)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
            </select>
          </Field>
          <p className="tiny muted">
            Expected columns: date, amount, description. Optional: payee, type, account, category,
            notes. Negative amounts import as expenses; positive amounts as income unless a type
            column says otherwise.
          </p>
        </div>
      ) : null}

      {step === 'map' ? (
        <div className="stack">
          <div className="import-summary">
            <div>
              <strong>{rows.length}</strong>
              <span className="muted"> rows read</span>
            </div>
            <div>
              <strong className="positive">{preview?.ready ?? 0}</strong>
              <span className="muted"> ready</span>
            </div>
            <div>
              <strong className={preview?.duplicates ? 'negative' : ''}>
                {preview?.duplicates ?? 0}
              </strong>
              <span className="muted"> duplicates</span>
            </div>
            <div>
              <strong className={preview?.invalid ? 'negative' : ''}>
                {preview?.invalid ?? 0}
              </strong>
              <span className="muted"> invalid</span>
            </div>
          </div>

          {parseErrors.length > 0 ? (
            <div className="notice notice-warning">
              <Icon name="alert" size={17} />
              <span>{parseErrors[0]}</span>
            </div>
          ) : null}
          {preview?.mappingErrors.map((error) => (
            <div key={error} className="form-alert" role="alert">
              {error}
            </div>
          ))}

          <div className="table-wrap" style={{ maxHeight: 220, overflow: 'auto' }}>
            <table className="table table-compact">
              <thead>
                <tr>
                  <th scope="col">Column</th>
                  <th scope="col">Maps to</th>
                  <th scope="col">Example</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((header, index) => (
                  <tr key={`${header}-${index}`}>
                    <td>{header}</td>
                    <td>
                      <select
                        className="select"
                        style={{ minHeight: 34 }}
                        value={mapping[index] ?? 'ignore'}
                        aria-label={`Map ${header || `column ${index + 1}`}`}
                        onChange={(event) =>
                          updateMapping(index, event.target.value as ImportMapping[number])
                        }
                      >
                        <option value="ignore">Ignore</option>
                        <option value="date">Date *</option>
                        <option value="amount">Amount *</option>
                        <option value="description">Description *</option>
                        <option value="payee">Payee</option>
                        <option value="type">Type</option>
                        <option value="account">Account</option>
                        <option value="category">Category</option>
                        <option value="notes">Notes</option>
                      </select>
                    </td>
                    <td className="small muted">{rows[0]?.[index] ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-wrap import-table">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  <th scope="col">Date</th>
                  <th scope="col">Description</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="num">
                    Amount
                  </th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {(preview?.results ?? []).slice(0, 80).map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={
                      row.status === 'invalid'
                        ? 'import-row-invalid'
                        : row.status === 'duplicate'
                          ? 'import-row-duplicate'
                          : ''
                    }
                  >
                    <td>{row.rowNumber}</td>
                    <td className="nowrap">{row.values?.date ?? '—'}</td>
                    <td>{row.values?.description ?? '—'}</td>
                    <td>{row.values?.type ?? '—'}</td>
                    <td className="num">{row.values ? money(row.values.amount) : '—'}</td>
                    <td>
                      {row.status === 'ready' ? (
                        <Badge tone="positive">Ready</Badge>
                      ) : (
                        <span className="tiny" title={row.reason}>
                          <Badge tone={row.status === 'duplicate' ? 'warning' : 'danger'}>
                            {row.status === 'duplicate' ? 'Duplicate' : 'Invalid'}
                          </Badge>
                          <span className="muted" style={{ display: 'block' }}>
                            {row.reason}
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted">
            Only rows marked Ready are imported. Duplicate and invalid rows are always excluded. No
            records are merged or matched automatically.
          </p>
        </div>
      ) : null}

      {step === 'confirm' ? (
        <div className="stack">
          <div className="notice notice-accent">
            <Icon name="info" size={17} />
            <span>
              Importing will create {preview?.ready ?? 0} new transactions.{' '}
              {preview?.duplicates ?? 0} duplicate rows and {preview?.invalid ?? 0} invalid rows
              will be skipped. This can be undone only by deleting the imported transactions or
              restoring a backup.
            </span>
          </div>
          <p className="small muted">
            Accounts are matched by name where possible, otherwise the default account is used.
            Categories are matched by name; unmatched categories import as Uncategorized.
          </p>
          <div className="table-wrap import-table">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Description</th>
                  <th scope="col">Account</th>
                  <th scope="col" className="num">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {(preview?.results ?? [])
                  .filter((row) => row.status === 'ready')
                  .slice(0, 60)
                  .map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.values?.date}</td>
                      <td>{row.values?.description}</td>
                      <td className="small muted">
                        {row.values?.accountName ??
                          data.accounts.find((account) => account.id === defaultAccountId)?.name}
                      </td>
                      <td className="num">
                        {row.values?.type === 'expense' ? '−' : '+'}
                        {money(row.values?.amount ?? 0)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {text.length === 0 ? <p className="tiny muted">No file content.</p> : null}
        </div>
      ) : null}
    </Dialog>
  );
}
