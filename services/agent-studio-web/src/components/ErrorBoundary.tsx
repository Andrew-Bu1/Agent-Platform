import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

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

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 bg-gray-50 text-gray-700">
          <AlertTriangle className="w-10 h-10 text-red-400" />
          <div className="text-center">
            <p className="font-semibold text-lg">Something went wrong</p>
            <p className="text-sm text-gray-500 mt-1 max-w-md">{this.state.error.message}</p>
          </div>
          <button
            onClick={() => window.location.replace('/')}
            className="px-4 py-2 bg-brand-600 text-white text-sm rounded-xl hover:bg-brand-700 transition-colors"
          >
            Go home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
