
import React, { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { getAuthToken } from './services/apiDatabaseClient';

// Configure Axios Defaults and Authentication Interceptors
axios.defaults.withCredentials = true;
axios.interceptors.request.use((config) => {
  const token = getAuthToken() || (typeof window !== 'undefined' ? (sessionStorage.getItem('hse_auth_token') || localStorage.getItem('hse_auth_token')) : null);
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // For GET read requests, return an empty payload instead of bubbling an uncaught rejection
      if (error.config?.method?.toLowerCase() === 'get') {
        return Promise.resolve({
          data: { success: false, data: [], message: 'Unauthenticated' },
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config: error.config
        });
      }
    }
    return Promise.reject(error);
  }
);

// Global Unhandled Rejection safety handler for seamless user experience
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.response?.status === 401 || event.reason?.message?.includes('401')) {
      event.preventDefault(); // Prevent noisy uncaught error overlay for 401 auth rejections
    }
  });
}

import App from './App.tsx';
import './index.css';
import { KeycloakProvider } from './auth/KeycloakContext';
import { FinalSubmitProvider } from './context/FinalSubmitContext';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("REACT ERROR BOUNDARY CAUGHT:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400 text-2xl font-bold">
              !
            </div>
            <h2 className="text-xl font-black text-slate-100">خطایی رخ داده است</h2>
            <p className="text-xs text-slate-400 leading-relaxed font-mono text-left bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-x-auto max-h-32">
              {this.state.error?.message || String(this.state.error)}
            </p>
            <button
              onClick={this.handleReload}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold rounded-xl transition-all text-sm shadow-lg shadow-blue-600/20"
            >
              بارگذاری مجدد سامانه (Reload)
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

if ('serviceWorker' in navigator) {
  const isProd = typeof process !== 'undefined' ? process.env.NODE_ENV === 'production' : Boolean((import.meta as any).env?.PROD);
  if (isProd) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silently handled
      });
    });
  } else {
    // In development mode, unregister existing service workers to ensure live module fetching
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    }).catch(() => {});
  }
}

import { WebSocketProvider } from './providers/WebSocketProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <KeycloakProvider>
      <WebSocketProvider>
        <FinalSubmitProvider>
          <ErrorBoundary><App /></ErrorBoundary>
        </FinalSubmitProvider>
      </WebSocketProvider>
    </KeycloakProvider>
  </StrictMode>,
);
