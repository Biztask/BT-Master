
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve('src'),
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    },
    build: {
      outDir: 'dist', 
      sourcemap: false,
      // QUAN TRỌNG: Sử dụng es2020 và safari14 để đảm bảo hỗ trợ đầy đủ các tính năng hiện đại nhưng vẫn chạy được trên iOS WebKit
      target: ['es2020', 'safari14'],
      cssTarget: 'chrome61', 
    }
  }
})
