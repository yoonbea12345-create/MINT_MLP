import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'mint',
  brand: {
    displayName: '민트',
    primaryColor: '#F2FCF8',
    icon: 'https://mint-mlp-4vm9.vercel.app/mint-splash-icon-512.png',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite dev',
      build: 'vite build',
    },
  },
  permissions: [],
  outdir: 'dist',
});
