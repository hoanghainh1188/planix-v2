import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import { initI18n } from './i18n/index.ts';
import './shared/ui/styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

await initI18n(navigator.language.startsWith('en') ? 'en' : 'vi');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
