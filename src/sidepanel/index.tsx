// src/sidepanel/index.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '../styles/globals.css';
import '../styles/sidepanel.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
