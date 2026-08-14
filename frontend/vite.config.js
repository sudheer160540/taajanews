import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      }
    }
  },
  ssr: {
    // Let Vite transform these (instead of loading them as external CJS) so
    // default exports interop correctly during server rendering. Regexes cover
    // all sub-packages (e.g. @mui/utils, @mui/system/esm/*).
    noExternal: [/^@mui\//, /^@emotion\//, 'react-helmet-async']
  }
});
