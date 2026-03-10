import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

export default defineConfig({
  base: './', // 使用相对路径
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    host: '0.0.0.0'
  },
  publicDir: 'public', // 静态资源目录
  plugins: [
    vue(),
    {
      name: 'copy-utools-files',
      closeBundle() {
        const distDir = resolve(__dirname, 'dist')
        const filesToCopy = [
          'plugin.json',
          'preload.js'
        ]
        
        filesToCopy.forEach(file => {
          const srcPath = resolve(__dirname, file)
          const destPath = resolve(distDir, file)
          
          if (existsSync(srcPath)) {
            // 确保目标目录存在
            const destDir = resolve(destPath, '..')
            if (!existsSync(destDir)) {
              mkdirSync(destDir, { recursive: true })
            }
            copyFileSync(srcPath, destPath)
            console.log(`Copied ${file} to ${destPath}`)
          }
        })
        
        // 复制图标文件到dist/assets目录
        const publicAssetsDir = resolve(__dirname, 'public', 'assets')
        const distAssetsDir = resolve(distDir, 'assets')
        
        if (existsSync(publicAssetsDir)) {
          if (!existsSync(distAssetsDir)) {
            mkdirSync(distAssetsDir, { recursive: true })
          }
          
          const iconFiles = ['icon.svg', 'logo.png']
          iconFiles.forEach(file => {
            const srcPath = resolve(publicAssetsDir, file)
            const destPath = resolve(distAssetsDir, file)
            
            if (existsSync(srcPath)) {
              copyFileSync(srcPath, destPath)
              console.log(`Copied ${file} to ${destPath}`)
            }
          })
        }
      }
    }
  ]
})