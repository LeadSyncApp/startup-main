import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
          <div className="max-w-md w-full text-center">
            <div className="text-6xl mb-6">⚠️</div>
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-gray-400 mb-6 text-sm">
              An unexpected error occurred. Please try reloading the page.
            </p>
            {this.state.error && (
              <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-3 mb-6 text-left font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleReload}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
