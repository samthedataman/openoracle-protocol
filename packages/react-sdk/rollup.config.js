import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

const external = [
  ...Object.keys(pkg.peerDependencies || {}),
  ...Object.keys(pkg.dependencies || {}),
  'react/jsx-runtime'
];

export default [
  // ES modules build
  {
    input: 'src/index.ts',
    output: {
      file: pkg.exports['.'].import,
      format: 'esm',
      sourcemap: true
    },
    external,
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false
      })
    ]
  },
  
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: pkg.exports['.'].require,
      format: 'cjs',
      sourcemap: true,
      exports: 'named'
    },
    external,
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false
      })
    ]
  },
  
  // Type definitions
  {
    input: 'src/index.ts',
    output: {
      file: pkg.exports['.'].types,
      format: 'esm'
    },
    plugins: [
      dts()
    ]
  }
];