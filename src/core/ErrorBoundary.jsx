import { Component } from 'react';

/**
 * Top-level error boundary — added 2026-08-13 during a full app health check.
 * Before this, any uncaught render error anywhere in the tree white-screened
 * the whole app for whoever was using it (staff mid-job-card, a customer on
 * /book), with no message and no way back short of knowing to hit reload.
 *
 * No remote error-logging service is wired up (no Sentry/etc in this repo) —
 * this only logs to the browser console and shows the user a way out. If
 * error tracking gets added later, report the error here (see
 * componentDidCatch) rather than bolting it on elsewhere.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught a render error:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--page-bg, #f5ead8)', padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <div className="cap" style={{ fontSize: 22, color: '#8a4f24' }}>Something went wrong</div>
            <p className="fg" style={{ fontSize: 13.5, color: 'var(--text-mute, #6b6560)', lineHeight: 1.6, margin: 0 }}>
              This screen hit an unexpected error and couldn't continue. It's been logged to the console. Reloading usually fixes it — if it keeps happening, let Wai know what you were doing when it broke.
            </p>
            <span
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              className="fg"
              style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: '#8a4f24', borderRadius: 999, padding: '10px 22px', cursor: 'pointer' }}
            >
              Reload
            </span>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
