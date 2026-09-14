import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        // Public CloudBase environment identifier — not a secret. The Hunyuan API key
        // now lives only in the hunyuanProxy cloud function's server-side env vars.
        'process.env.TCB_ENV_ID': JSON.stringify(env.TCB_ENV_ID)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
