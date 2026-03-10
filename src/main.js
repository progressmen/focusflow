console.log('main.js started')

import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

console.log('Vue imported')
console.log('App component:', App)
console.log('DOM element #app:', document.getElementById('app'))

const app = createApp(App)

console.log('Vue app created')

// 挂载到 uTools 提供的 DOM 容器
const mountedApp = app.mount('#app')

console.log('Vue app mounted:', mountedApp)
console.log('After mount - DOM element #app:', document.getElementById('app'))
console.log('After mount - #app content:', document.getElementById('app').innerHTML)

// uTools 插件生命周期
if (typeof utools !== 'undefined') {
  console.log('uTools API available')
  
  // 插件进入时
  utools.onPluginEnter(({ code, type, payload }) => {
    console.log('Plugin entered:', { code, type, payload })
  })

  // 插件退出时
  utools.onPluginOut(() => {
    console.log('Plugin exited')
  })

  // 插件隐藏时 - 注意：utools.onPluginHide 方法可能不存在，使用try-catch包裹
  try {
    if (typeof utools.onPluginHide === 'function') {
      utools.onPluginHide(() => {
        console.log('Plugin hidden')
      })
    }
  } catch (error) {
    console.log('utools.onPluginHide not available:', error)
  }

  // 插件显示时
  utools.onPluginReady(() => {
    console.log('Plugin ready')
  })
} else {
  console.log('uTools API not available, running in development mode')
}