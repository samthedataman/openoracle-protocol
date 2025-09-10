import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      exclude: ['**/*.test.ts', '**/*.spec.ts', 'src/cli.ts']
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'OpenOracleSDK',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'esm' : format}.js`
    },
    rollupOptions: {
      external: [
        'axios',
        'ethers',
        'ws',
        'mqtt', 
        'dotenv',
        'node-cache',
        'retry',
        'winston',
        'jsonwebtoken',
        'crypto',
        'date-fns',
        'decimal.js',
        'lodash',
        'openai',
        'socket.io-client'
      ],
      output: {
        globals: {
          'axios': 'axios',
          'ethers': 'ethers',
          'ws': 'WebSocket',
          'mqtt': 'mqtt',
          'dotenv': 'dotenv',
          'node-cache': 'NodeCache',
          'retry': 'retry',
          'winston': 'winston',
          'jsonwebtoken': 'jwt',
          'crypto': 'crypto',
          'date-fns': 'dateFns',
          'decimal.js': 'Decimal',
          'lodash': '_',
          'openai': 'OpenAI',
          'socket.io-client': 'io'
        }
      }
    },
    target: 'node16'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/core': resolve(__dirname, 'src/core'),
      '@/providers': resolve(__dirname, 'src/providers'),
      '@/api': resolve(__dirname, 'src/api'),
      '@/utils': resolve(__dirname, 'src/utils')
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
})