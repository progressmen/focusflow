import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

const app = createApp(App)

// 挂载到 uTools 提供的 DOM 容器
app.mount('#app')

// uTools 插件生命周期
if (typeof utools !== 'undefined') {
  // 插件进入时
  utools.onPluginEnter(({ code, type, payload }) => {
    console.log('Plugin entered:', { code, type, payload })
  })

  // 插件退出时
  utools.onPluginOut(() => {
    console.log('Plugin exited')
  })

  // 插件隐藏时
  utools.onPluginHide(() => {
    console.log('Plugin hidden')
  })

  // 插件显示时
  utools.onPluginReady(() => {
    console.log('Plugin ready')
  })
}