import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { labArtifacts } from './scripts/lab-artifacts';

export default defineConfig({
  plugins: [react(), labArtifacts()],
  root: 'apps/web',
  server: {
    port: Number(process.env.AFTERMARKET_WEB_PORT ?? 5173),
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${process.env.AFTERMARKET_PORT ?? 3001}` },
  },
  build: { outDir: '../../dist/web', emptyOutDir: true },
});
