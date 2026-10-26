import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'apps/web',
  server: {
    port: Number(process.env.AFTERMARKET_WEB_PORT ?? 5173),
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${process.env.AFTERMARKET_PORT ?? 3001}` },
  },
  build: { outDir: '../../dist/web', emptyOutDir: true },
});
