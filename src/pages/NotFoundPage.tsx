import { Link } from 'react-router-dom';
import { Card, EmptyState } from '../components/ui';

export function NotFoundPage() {
  return (
    <Card>
      <EmptyState
        icon="search"
        title="Page not found"
        action={
          <Link to="/" className="btn btn-primary">
            Back to dashboard
          </Link>
        }
      >
        The address may be mistyped, or the page may have moved. Your saved data is unaffected.
      </EmptyState>
    </Card>
  );
}
