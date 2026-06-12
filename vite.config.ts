import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

/** Rollup plugin that appends a footer to IIFE chunks so window.Coign is the real API function. */
const iifeFixPlugin = () => ({
  name: 'iife-coign-fix',
  generateBundle(options, bundle) {
    for (const [fileName, chunk] of Object.entries(bundle)) {
      if (fileName.endsWith('.iife.js') && chunk.type === 'chunk') {
        // Insert before source map comment so the map stays valid
        const mapIdx = chunk.code.lastIndexOf('//# sourceMappingURL=');
        if (mapIdx >= 0) {
          chunk.code =
            chunk.code.slice(0, mapIdx) +
            'window.Coign = window.Coign.default || window.Coign;\n' +
            chunk.code.slice(mapIdx);
        } else {
          chunk.code += '\nwindow.Coign = window.Coign.default || window.Coign;\n';
        }
      }
    }
  },
});

export default defineConfig({
  root: '.',
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Coign',
      fileName: (format) => `coign-sdk.${format}.js`,
      formats: ['es', 'cjs', 'iife'],
    },
    rollupOptions: {
      external: [],
      output: {
        exports: 'named',
        globals: {
          // No external globals — we bundle everything for the IIFE
        },
      },
      plugins: [iifeFixPlugin()],
    },
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2022',
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    open: '/demo/phase1.html',
  },
});
