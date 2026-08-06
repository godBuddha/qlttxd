import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

// Inject a fresh build version into the public/sw.js service worker after each
// build so its cache namespace changes on deploy (no stale content served).
function swBuildVersion() {
  let version;
  return {
    name: 'qlttxd-sw-build-version',
    configResolved() {
      version = Date.now().toString(36);
    },
    closeBundle() {
      const swPath = resolve(root, 'dist/sw.js');
      let code;
      try {
        code = readFileSync(swPath, 'utf8');
      } catch {
        return; // sw.js not emitted (dev server / early failure)
      }
      writeFileSync(
        swPath,
        code.replace('globalThis.__BUILD_VERSION__', `'${version}'`)
      );
      this.info(`[sw-build-version] CACHE_NAME updated -> qlttxd-${version}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), swBuildVersion()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
});
