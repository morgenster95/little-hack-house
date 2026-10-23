import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

async function start() {
  // Pixi texty potřebují načtené fonty – čekáme max. 2,5 s
  try {
    await Promise.race([
      Promise.all([document.fonts.load('700 12px Fredoka'), document.fonts.load('800 12px Nunito')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* fallback na systémové písmo */
  }
  createRoot(document.getElementById('root')!).render(<App />);
}

start();
