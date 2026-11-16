// index.css must load BEFORE the stores are created: the deck store renders bitmaps at import time
// and needs the Material Symbols @font-face rule to be registered (document.fonts.load).
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
