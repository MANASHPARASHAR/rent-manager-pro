
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Register global error and rejection listeners to gracefully handle sandbox/offline network blocks
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (
    reason instanceof Error &&
    (reason.message.includes('Failed to fetch') || reason.message.includes('fetch'))
  ) {
    event.preventDefault();
    console.warn('[Sandbox Guard] Handled unhandled fetch promise rejection:', reason.message);
  } else if (
    typeof reason === 'string' &&
    (reason.includes('Failed to fetch') || reason.includes('fetch'))
  ) {
    event.preventDefault();
    console.warn('[Sandbox Guard] Handled unhandled fetch promise rejection string:', reason);
  }
});

window.addEventListener('error', (event) => {
  if (
    event.error instanceof Error &&
    (event.error.message.includes('Failed to fetch') || event.error.message.includes('fetch'))
  ) {
    event.preventDefault();
    console.warn('[Sandbox Guard] Handled uncaught fetch error:', event.error.message);
  } else if (event.message?.includes('Failed to fetch') || event.message?.includes('fetch')) {
    event.preventDefault();
    console.warn('[Sandbox Guard] Handled uncaught fetch message:', event.message);
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
