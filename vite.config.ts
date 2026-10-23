import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relativní base: funguje na GitHub Pages pod libovolným názvem repozitáře.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
});
