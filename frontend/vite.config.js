import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export default {
  server: {
    host: '127.0.0.1',
    proxy: { '/api': { target: 'http://127.0.0.1:8001', rewrite: path => path.replace(/^\/api/, '') } },
  },
  build: { rollupOptions: { input: resolve(fileURLToPath(new URL('.', import.meta.url)), 'index.html') } },
};
