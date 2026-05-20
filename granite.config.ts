import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'mint',
  brand: {
    displayName: '민트',
    primaryColor: '#3CDBC0',
    icon: '',
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