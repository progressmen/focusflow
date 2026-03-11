/**
 * uTools 插件预加载脚本
 * 用于在插件运行前初始化环境
 */

// 监听 uTools 插件事件
if (typeof utools !== 'undefined') {
  console.log('uTools API available')
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
  
  // 定义获取当前使用应用的方法
  window.getCurrentAppName = () => {
    try {
      if (typeof utools !== 'undefined' && typeof utools.getAppName === 'function') {
        return utools.getAppName() || '未知应用'
      }
      return '未知应用'
    } catch (error) {
      console.error('Failed to get current app:', error)
      return '未知应用'
    }
  }
  
  // 屏幕截图函数
  window.captureScreen = async () => {
    console.log('Screen capture started');
    try {
      console.log('Screen source in', typeof utools, typeof utools.desktopCaptureSources);
      if (typeof utools !== 'undefined' && typeof utools.desktopCaptureSources === 'function') {
        console.log('Calling desktopCaptureSources...');
        const sources = await utools.desktopCaptureSources({ types: ['screen'] });
        console.log('desktopCaptureSources returned:', sources);
        
        // 获取第一个屏幕（通常是主屏）
        const screenSource = sources[0];
        console.log('Screen source:1', screenSource);

        if (!screenSource) {
          console.error('No screen source found');
          return null;
        }

        // 使用 MediaStream API 获取视频流
        console.log('Calling getUserMedia...');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: screenSource.id,
            }
          }
        });
        console.log('Screen source:2', stream);

        // 创建一个 <video> 元素播放这个流
        const video = document.createElement('video');
        video.srcObject = stream;
        console.log('Video element created:', video);

        try {
          console.log('Calling video.play()...');
          await video.play();
          console.log('Screen source:3', video);
        } catch (playError) {
          console.error('Failed to play video:', playError);
          stream.getTracks().forEach(track => track.stop());
          return null;
        }

        // 等待视频加载完毕，添加超时处理
        console.log('Waiting for video to start playing...');
        try {
          // 尝试多种方式等待视频准备就绪
          await new Promise((resolve, reject) => {
            // 设置5秒超时
            const timeout = setTimeout(() => {
              // 超时后，尝试直接绘制，不等待onplaying事件
              console.log('Video play timeout, trying to draw anyway...');
              resolve();
            }, 5000);

            // 监听多个事件
            const resolveHandler = () => {
              clearTimeout(timeout);
              resolve();
            };

            video.onplaying = resolveHandler;
            video.onloadedmetadata = resolveHandler;
            video.oncanplay = resolveHandler;
            video.oncanplaythrough = resolveHandler;

            video.onerror = (error) => {
              clearTimeout(timeout);
              reject(error);
            };
          });
          console.log('Video ready for capture');
        } catch (waitError) {
          console.error('Failed to wait for video playing:', waitError);
          stream.getTracks().forEach(track => track.stop());
          return null;
        }

        // 创建 canvas 并绘制当前帧
        console.log('Creating canvas...');
        const canvas = document.createElement('canvas');
        console.log('Screen source:4', canvas);
        console.log('Video dimensions:', video.videoWidth, video.videoHeight);
        
        // 确保视频尺寸有效
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          console.error('Invalid video dimensions');
          stream.getTracks().forEach(track => track.stop());
          return null;
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        console.log('Canvas context:', ctx);
        
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          console.log('Image drawn to canvas');
        } catch (drawError) {
          console.error('Failed to draw image:', drawError);
          stream.getTracks().forEach(track => track.stop());
          return null;
        }

        // 将截图转为 base64
        console.log('Converting to base64...');
        const imageData = canvas.toDataURL('image/png');
        console.log('Screen source:5', imageData.substring(0, 100) + '...');

        // 停止视频流释放资源
        console.log('Stopping stream...');
        stream.getTracks().forEach(track => track.stop());
        console.log('Screen source:6 stop');

        console.log('截图完成:', imageData.substring(0, 100) + '...');
        return imageData;
      } else {
        console.error('desktopCaptureSources API not available');
        return null;
      }
    } catch (error) {
      console.error('Failed to capture screen:', error);
      return null;
    }
  }
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
    },

    getAppName: () => {
      // 模拟getAppName方法
      const apps = ['Chrome', 'VS Code', '微信', 'Finder', '终端']
      return apps[Math.floor(Math.random() * apps.length)]
    }
  }
  
  // 定义获取当前使用应用的方法（开发环境）
  window.getCurrentAppName = () => {
    try {
      if (typeof window.utools !== 'undefined' && typeof window.utools.getAppName === 'function') {
        return window.utools.getAppName() || '未知应用'
      }
      return '未知应用'
    } catch (error) {
      console.error('Failed to get current app:', error)
      return '未知应用'
    }
  }
  
  // 屏幕截图函数（开发环境模拟）
  window.captureScreen = async () => {
    try {
      console.log('Dev: Capturing screen (simulated)');
      // 模拟截图功能，返回一个占位符base64图片
      const placeholderImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      return placeholderImage;
    } catch (error) {
      console.error('Failed to capture screen (simulated):', error);
      return null;
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