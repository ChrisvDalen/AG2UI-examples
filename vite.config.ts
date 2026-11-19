import {defineConfig} from 'vite';
import {claudeProxy} from './server/claude-proxy.ts';

export default defineConfig({
  plugins: [claudeProxy()],
  server: {port: 5173, host: true},
  build: {target: 'es2022', chunkSizeWarningLimit: 2500},
});
