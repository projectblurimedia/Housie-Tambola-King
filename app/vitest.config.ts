import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit tests for pure TypeScript only (game engine, helpers) — no React Native runtime.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
