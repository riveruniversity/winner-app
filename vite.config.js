import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  // Base public path when served in development or production
  base: './',
  
  // Build configuration
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    // Ensure proper asset handling
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        scan: resolve(__dirname, 'scan.html'),
        conditions: resolve(__dirname, 'conditions.html')
      },
      output: {
        // Organize assets in build
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.')
          const ext = info[info.length - 1]
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`
          }
          if (/css/i.test(ext)) {
            return `assets/css/[name]-[hash][extname]`
          }
          return `assets/[name]-[hash][extname]`
        }
      }
    }
  },
  
  envPrefix: 'VITE_',
  
  // Development server configuration
  server: {
    port: 3000,
    open: true
  },
  
  // Preview server configuration
  preview: {
    port: 4173
  }
})