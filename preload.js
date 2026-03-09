/**
 * uTools 插件预加载脚本
 * 用于在插件运行前初始化环境
 */

// 监听 uTools 插件事件
if (typeof utools !== 'undefined') {
  // 插件进入事件
  utools.onPluginEnter(({ code, type, payload }) => {
    console.log('FocusFlow plugin entered:', { code, type, payload })

    // 发送事件到 Vue 应用
    window.dispatchEvent(new CustomEvent('utools:enter', {
      detail: { code, type, payload }
    }))
  })

  // 插件退出事件
  utools.onPluginOut(() => {
    console.log('FocusFlow plugin exited')

    window.dispatchEvent(new CustomEvent('utools:exit'))
  })


  // 暴露 uTools API 到 window 对象
  window.utools = utools
} else {
  // 开发环境模拟 uTools API
  window.utools = {
    showNotification: (message) => {
      console.log('Notification:', message)
      // 在开发环境中显示通知
      if (window.Notification && Notification.permission === 'granted') {
        new Notification('FocusFlow', { body: message })
      }
    },

    onPluginEnter: (callback) => {
      console.log('Dev: Plugin enter listener registered')
    },

    onPluginOut: (callback) => {
      console.log('Dev: Plugin out listener registered')
    },

    getCurrentWindow: () => {
      return {
        title: document.title,
        process: { name: 'browser' }
      }
    },

    getForegroundProcess: () => {
      return {
        name: 'browser',
        path: window.location.href
      }
    }
  }

  // 请求通知权限
  if (window.Notification && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

// 错误处理
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
})

// 性能监控
if ('performance' in window) {
  window.addEventListener('load', () => {
    const loadTime = performance.now()
    console.log(`Page loaded in ${loadTime.toFixed(2)}ms`)
  })
}