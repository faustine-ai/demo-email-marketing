import React from 'react';
import { createRoot } from 'react-dom/client';
import './lib/theme.js'; // applies the saved theme before first paint
import './styles.css';
import App from './App.jsx';

// The WebSocket is opened from App once the user is authenticated (it needs the
// JWT), so there's no eager connect() here anymore.

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
