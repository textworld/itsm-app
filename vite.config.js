import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/itsm-app-proto-2/',
  plugins: [react()],
  server: {
    port: 5173,
    open: '/itsm-app-proto-2/'
  }
});
