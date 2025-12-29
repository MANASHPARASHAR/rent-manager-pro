import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

/**
 * RentMaster Pro - Root Entry Point
 * Mounts the React application to the DOM.
 */

const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("Critical Error: 'root' element not found in index.html.");
}