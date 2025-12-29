import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true, // Automatically open the browser
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true, // Better for debugging production issues
    emptyOutDir: true,
  },
  resolve: {
    // Allows for importing files with .tsx extension explicitly
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
  }
});