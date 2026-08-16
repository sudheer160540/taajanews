import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isSsrBuild =
  process.argv.includes('--ssr') || process.env.VITE_SSR_BUILD === '1';

export default defineConfig(({ ssrBuild }) => ({
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
  build: {
    rollupOptions: isSsrBuild || ssrBuild
      ? {}
      : {
          output: {
            manualChunks: {
              'react-vendor': ['react', 'react-dom', 'react-router-dom'],
              'mui-vendor': ['@mui/material', '@emotion/react', '@emotion/styled'],
              'i18n-vendor': ['i18next', 'react-i18next']
            }
          }
        }
  },
  ssr: {
    // Let Vite transform these (instead of loading them as external CJS) so
    // default exports interop correctly during server rendering. Regexes cover
    // all sub-packages (e.g. @mui/utils, @mui/system/esm/*).
    noExternal: [/^@mui\//, /^@emotion\//, 'react-helmet-async']
  }
}));
