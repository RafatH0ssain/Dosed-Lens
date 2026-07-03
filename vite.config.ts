import { defineConfig } from 'vite';

// GLSL files are loaded with Vite's native `?raw` imports; include resolution
// and signature-module injection happen at runtime in src/gl/program.ts
// (they must — signature modules swap per substance). Zero dependencies.
export default defineConfig({
  build: { target: 'es2022' },
});
