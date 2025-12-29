import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

// Global error handling to catch and log any initialization issues
window.addEventListener('error', (event) => {
  console.error('Global Error caught:', event.error);
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  const msg = "Could not find root element to mount the application. Check if <div id='root'></div> exists in index.html.";
  console.error(msg);
  document.body.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">${msg}</div>`;
} else {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Failed to render React application:", error);
    rootElement.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">Application failed to load. Check console for details.</div>`;
  }
}