import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'https://lacoupole-back.onrender.com',
        changeOrigin: true,
        secure: true,
        ws: true,
      },
      '/socket.io': {
        target: process.env.VITE_API_URL || 'https://lacoupole-back.onrender.com',
        changeOrigin: true,
        secure: true,
        ws: true,
      },
    },
    hmr: {
      protocol: 'ws',
      port: 5173,
    },
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || 'https://lacoupole-back.onrender.com'),
  },
});
