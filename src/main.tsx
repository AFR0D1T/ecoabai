import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import 'leaflet/dist/leaflet.css';
import './index.css';
import './i18n';
import App from './App';
import { queryClient } from '@/hooks/queryClient';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { AuthGateProvider } from '@/components/layout/AuthGate';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { Toaster } from '@/components/ui/sonner';
import { initPwa } from '@/lib/pwa';

initPwa();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthGateProvider>
              <App />
            </AuthGateProvider>
          </BrowserRouter>
          <Toaster />
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
