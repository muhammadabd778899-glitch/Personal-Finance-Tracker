import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  ProgressBar,
} from '../../src/components/ui';

describe('Button', () => {
  it('defaults to a non-submitting button and forwards clicks', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('ProgressBar', () => {
  it('clamps invalid and out-of-range values accessibly', () => {
    const { rerender } = render(<ProgressBar value={140} label="Budget used" />);
    const bar = screen.getByRole('progressbar', { name: 'Budget used' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    rerender(<ProgressBar value={Number.NaN} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });
});

describe('Field', () => {
  it('associates the label and announces errors', () => {
    render(
      <Field label="Amount" htmlFor="amount" error="Enter an amount" hint="Ignored while invalid">
        <input id="amount" />
      </Field>,
    );
    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount');
    expect(screen.queryByText('Ignored while invalid')).not.toBeInTheDocument();
  });
});

describe('Dialog', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open</Button>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Quick add"
          description="Add a record"
        >
          <p>Dialog body</p>
        </Dialog>
      </>
    );
  }

  it('traps Escape and restores the page', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog', { name: 'Quick add' })).toBeInTheDocument();
    expect(screen.getByText('Dialog body')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders confirmation details and buttons', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onCancel={() => undefined}
        onConfirm={onConfirm}
        title="Delete account?"
        confirmLabel="Delete"
        danger
      >
        History will be preserved by archiving instead.
      </ConfirmDialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Delete account?' })).toBeInTheDocument();
    expect(screen.getByText(/History will be preserved/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalled();
  });
});

describe('presentational helpers', () => {
  it('renders empty states and badges', () => {
    render(
      <EmptyState title="No accounts yet" action={<Button>Add account</Button>}>
        Add your first account to begin.
      </EmptyState>,
    );
    expect(screen.getByRole('heading', { name: 'No accounts yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add account' })).toBeInTheDocument();

    render(
      <Badge tone="positive" dot>
        On track
      </Badge>,
    );
    expect(screen.getByText('On track')).toHaveClass('badge-positive', 'badge-dot');
  });
});
