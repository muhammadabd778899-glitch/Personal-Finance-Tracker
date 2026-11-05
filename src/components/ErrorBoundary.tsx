import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui';
import { Icon } from './icons';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled application error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page">
        <div className="card card-pad stack" role="alert">
          <div className="row">
            <span className="pulse-marker negative">
              <Icon name="alert" size={18} />
            </span>
            <h1 className="font-display">Something went wrong</h1>
          </div>
          <p className="muted">
            Your saved data is still in this browser. Reload the app to continue. If the problem
            repeats, export a backup from Settings before making more changes.
          </p>
          <pre
            className="small"
            style={{ whiteSpace: 'pre-wrap', color: 'var(--danger)', margin: 0 }}
          >
            {this.state.error.message}
          </pre>
          <div className="row">
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload app
            </Button>
            <Button variant="ghost" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
