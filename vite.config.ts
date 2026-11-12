import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        }
    },
    server: {
        // Forward /api/* to `wrangler pages dev` (run on :8788) so the Pages Function works locally.
        proxy: {
            '/api': 'http://127.0.0.1:8788',
        },
    },
});
