import { defineConfig } from 'vite';
import dotenv from 'dotenv';
dotenv.config();
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [react(), nodePolyfills()],
  build: {
    outDir: 'dist',
    target: 'esnext'
  }
});
