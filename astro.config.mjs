// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://lgu-compare.vercel.app',
  output: 'static',
  build: { format: 'directory' },
  trailingSlash: 'ignore',
});
