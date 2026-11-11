// Unit tests for business logic (npm run test:unit). Kept separate from vite.config.js so the
// Base44 dev plugins are not loaded during tests.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/unit/**/*.test.{js,jsx,mjs}'],
    environment: 'node',
    restoreMocks: true,
  },
});
