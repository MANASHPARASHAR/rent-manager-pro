import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

/**
 * Root Application Entry Point
 * 
 * This file mounts the React application to the DOM.
 * Standardized for React 19 + Vite 6.
 */

const container = document.getElementById('root');

if (!container) {
  throw new Error(
    "Critical Error: Failed to find the root element. " +
    "Ensure <div id='root'></div> exists in index.html."
  );
}

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Catch-all for runtime errors during the initial load to help debugging
window.onerror = function(message, source, lineno, colno, error) {
  console.error("Uncaught Runtime Error:", { message, source, lineno, colno, error });
  return false;
};