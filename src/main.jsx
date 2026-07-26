import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { CustomerPortal } from '@/core/CustomerPortal';
import { StoreProvider } from '@/core/store';
import './index.css';

// /book is the public Customer Booking Portal — no app chrome, just the
// booking flow. Everything else is the internal app. Both share the same
// StoreProvider so a portal booking reaches the same backend the internal
// Bookings screen reads from.
const isPortal = window.location.pathname.startsWith('/book');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider>
      {isPortal ? <CustomerPortal /> : <App />}
    </StoreProvider>
  </React.StrictMode>
);
