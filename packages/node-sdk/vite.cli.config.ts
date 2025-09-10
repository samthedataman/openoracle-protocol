import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/cli.ts'),
      name: 'OpenOracleCLI',
      formats: ['cjs'],
      fileName: () => 'cli.js'
    },
    rollupOptions: {
      external: [
        'yargs',
        'chalk',
        'ora',
        'boxen',
        'inquirer',
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
      ]
    },
    outDir: 'dist',
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
  }
})