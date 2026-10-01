import { defineConfig } from 'tsup';

// ESM build of the three library entries. Dependencies stay external: React and Recharts are
// resolved by the consumer (design section 3). Shared render code lands in shared chunks.
export default defineConfig({
  entry: {
    'core/index': 'src/core/index.ts',
    'react/index': 'src/react/index.ts',
    'print/index': 'src/print/index.ts',
  },
  format: ['esm'],
  target: 'es2022',
  outDir: 'dist',
  clean: true,
  splitting: true,
  sourcemap: false,
  treeshake: true,
  tsconfig: 'tsconfig.build.json',
  dts: { compilerOptions: { rootDir: 'src', ignoreDeprecations: '6.0' } },
  external: [
    'react',
    'react-dom',
    'react-dom/client',
    'react-dom/server',
    'react-is',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'recharts',
  ],
});
