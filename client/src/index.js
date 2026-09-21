import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { registerPWA } from './registerPWA';

// Suppress harmless third-party browser extension errors
window.addEventListener('error', (event) => {
  if (
    event.message?.includes('startTime') ||
    event.message?.includes('reportAllChanges') ||
    event.filename?.includes('VM') ||
    !event.filename
  ) {
    event.preventDefault();
    event.stopPropagation();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason?.message?.includes('startTime') ||
    event.reason?.message?.includes('reportAllChanges')
  ) {
    event.preventDefault();
    event.stopPropagation();
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

registerPWA();