import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }, // tsconfig paths-এর মিরর
  },
  test: {
    environment: 'node', // প্রথম ধাপে DOM লাগে না; শুধু pure lib টেস্ট
    include: ['src/**/*.test.ts'],
    globals: false,
    // টাইমজোন-নির্ভর হিসাব (dayKey: 'en-CA') সব মেশিনে এক রাখতে setup ফাইল
    setupFiles: ['src/test/setup.ts'],
  },
});
