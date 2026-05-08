import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { error } = this.state;
      const errorMsg = error?.message || 'Unknown error';

      return (
        <div
          style={{
            padding: '2rem',
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '8px',
            color: 'var(--red)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '8px' }}>❌ Component Error</div>
          <div style={{ marginBottom: '12px', color: 'var(--text-lo)' }}>
            {errorMsg}
          </div>
          <button
            onClick={this.handleReset}
            style={{
              padding: '6px 12px',
              backgroundColor: 'rgba(239,68,68,0.2)',
              border: '1px solid var(--red)',
              borderRadius: '4px',
              color: 'var(--red)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
