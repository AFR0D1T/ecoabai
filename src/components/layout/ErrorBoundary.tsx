import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import i18n from '@/i18n';
import { Button } from '@/components/ui/button';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden />
        <h1 className="text-xl font-semibold">{i18n.t('errors.boundaryTitle')}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{i18n.t('errors.boundaryText')}</p>
        <Button onClick={() => window.location.reload()}>{i18n.t('common.reload')}</Button>
      </div>
    );
  }
}
