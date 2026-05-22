import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#0d1427',
            color: '#e2e8f0',
            border: '1px solid rgba(0,212,255,0.2)',
            fontFamily: '"Rajdhani", sans-serif',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#0d1427' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#0d1427' },
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);