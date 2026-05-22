
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Register global error and rejection listeners to gracefully handle sandbox/offline network blocks
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const reasonStr = reason ? String(reason.message || reason) : '';
  if (
    reasonStr.toLowerCase().includes('failed to fetch') || 
    reasonStr.toLowerCase().includes('fetch') ||
    reasonStr.toLowerCase().includes('network-request-failed')
  ) {
    event.preventDefault();
    console.warn('[Sandbox Guard] Handled unhandled fetch promise rejection:', reasonStr);
  }
});

window.addEventListener('error', (event) => {
  const errorMsg = event.message || (event.error ? String(event.error.message || event.error) : '');
  if (
    errorMsg.toLowerCase().includes('failed to fetch') || 
    errorMsg.toLowerCase().includes('fetch') ||
    errorMsg.toLowerCase().includes('network-request-failed')
  ) {
    event.preventDefault();
    console.warn('[Sandbox Guard] Handled uncaught fetch error:', errorMsg);
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
