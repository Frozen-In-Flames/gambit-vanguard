import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // The published 3.0.2 tarball ships src/ without the dist/ its
      // package.json points to; compile from source instead.
      '@react-three/postprocessing': new URL(
        './node_modules/@react-three/postprocessing/src/index.ts',
        import.meta.url,
      ).pathname,
    },
  },
});
