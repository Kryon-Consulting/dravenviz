import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@draven/viz/styles.css';
import './styles.css';
import { App } from './App';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
