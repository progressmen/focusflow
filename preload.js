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
  
  // 打开文件或目录
  window.shellOpenPath = (path) => {
    try {
      if (typeof utools !== 'undefined' && typeof utools.shellOpenPath === 'function') {
        utools.shellOpenPath(path)
        console.log('Opened path:', path)
        return true
      } else {
        console.error('shellOpenPath API not available')
        return false
      }
    } catch (error) {
      console.error('Failed to open path:', error)
      return false
    }
  }
  
  // 获取当前时间对应的整10分钟时间戳
  window.getRoundedTime = (time = Date.now()) => {
    return Math.floor(time / (10 * 60 * 1000)) * (10 * 60 * 1000)
  }
  
  // 存储截图到 uTools 本地数据库（使用附件存储）
  window.saveScreenshotToDb = async (screenshotData) => {
    try {
      if (typeof utools !== 'undefined' && typeof utools.db !== 'undefined') {

        // 获取当前时间对应的整10分钟时间戳
        const roundedTime = window.getRoundedTime()

        // 文档ID格式：screenshot/roundedTime
        const docId = `roundedTime/${roundedTime}`
        console.log('roundedTime docId:', docId)


        // 获取当前文档
        const currentDoc = utools.db.get(docId) || {}
        console.log('roundedTime docId: currentDoc', currentDoc)

        // 创建文档
        const screenshotDoc = {
          _id: `screenshot/${Date.now()}`,
          timestamp: screenshotData.timestamp,
          app: screenshotData.app,
          time: screenshotData.time
        }

        const doc = {
          _id: docId,
          screenshots: [...currentDoc.screenshots || [], screenshotDoc]
        }
        if (currentDoc._rev) {
          doc._rev = currentDoc._rev
        }
        
        // 保存文档
        const result = utools.db.put(doc)
        if (!result.ok) {
          console.error('Failed to save screenshot document:', result.message)
          return null
        }
        
        // 提取base64数据
        const base64Data = screenshotData.imageData.replace(/^data:image\/jpeg;base64,/, '')
        const binaryData = atob(base64Data)
        const buffer = new Uint8Array(binaryData.length)
        
        for (let i = 0; i < binaryData.length; i++) {
          buffer[i] = binaryData.charCodeAt(i)
        }
        
        // 保存为附件
        const attachmentResult = utools.db.postAttachment(screenshotDoc._id, buffer, 'image/png')
        if (attachmentResult.ok) {
          console.log('Screenshot saved to database as attachment:', screenshotDoc._id)
          return screenshotDoc._id
        } else {
          console.error('Failed to save screenshot attachment:', attachmentResult.message)
          return null
        }
      } else {
        console.error('Database API not available')
        return null
      }
    } catch (error) {
      console.error('Failed to save screenshot to database:', error)
      return null
    }
  }
  
  // 从 uTools 本地数据库获取截图
  window.getScreenshotFromDb = async (screenshotId) => {
    try {
      if (typeof utools !== 'undefined' && typeof utools.db !== 'undefined') {
        // 获取文档
        const doc = utools.db.get(screenshotId)
        if (!doc) {
          console.error('Screenshot document not found:', screenshotId)
          return null
        }
        
        // 获取附件
        const attachment = utools.db.getAttachment(screenshotId)
        if (!attachment) {
          console.error('Screenshot attachment not found:', screenshotId)
          return null
        }
          console.log('attachment:', attachment)


        
        

        function convertBinaryToBase64(binaryData) {
          return new Promise((resolve, reject) => {
            try {
              // 检查binaryData类型
              if (binaryData instanceof Blob) {
                // 使用FileReader处理Blob
                const reader = new FileReader()
                reader.onloadend = () => {
                  resolve(reader.result)
                }
                reader.onerror = () => {
                  reject(new Error('FileReader failed'))
                }
                reader.readAsDataURL(binaryData)
              } else if (binaryData instanceof ArrayBuffer) {
                // 处理ArrayBuffer
                try {
                  const uint8Array = new Uint8Array(binaryData)
                  let binary = ''
                  for (let i = 0; i < uint8Array.length; i++) {
                    binary += String.fromCharCode(uint8Array[i])
                  }
                  resolve('data:image/jpeg;base64,' + btoa(binary))
                } catch (error) {
                  // 回退到Blob处理
                  const blob = new Blob([binaryData], { type: 'image/jpeg' })
                  const reader = new FileReader()
                  reader.onloadend = () => {
                    resolve(reader.result)
                  }
                  reader.onerror = () => {
                    reject(new Error('FileReader failed for ArrayBuffer'))
                  }
                  reader.readAsDataURL(blob)
                }
              } else if (typeof binaryData === 'string') {
                // 处理字符串类型
                try {
                  resolve('data:image/jpeg;base64,' + binaryData)
                } catch (error) {
                  reject(new Error('Failed to handle string data'))
                }
              } else {
                // 其他类型，尝试转换为Blob
                try {
                  const blob = new Blob([binaryData], { type: 'image/jpeg' })
                  const reader = new FileReader()
                  reader.onloadend = () => {
                    resolve(reader.result)
                  }
                  reader.onerror = () => {
                    reject(new Error('FileReader failed for unknown type'))
                  }
                  reader.readAsDataURL(blob)
                } catch (error) {
                  reject(new Error('Failed to convert unknown type'))
                }
              }
            } catch (error) {
              console.error('Failed to convert to base64:', error)
              reject(error)
            }
          })
        }

        // 转换为base64
        const base64Data = await convertBinaryToBase64(attachment)
        console.log('base64Data:', base64Data)
        return base64Data
      } else {
        console.error('Database API not available')
        return null
      }
    } catch (error) {
      console.error('Failed to get screenshot from database:', error)
      return null
    }
  }
  
  // 保存设置到 uTools 本地数据库
  window.saveSettingsToDb = (settings) => {
    try {
      if (typeof utools !== 'undefined' && typeof utools.db !== 'undefined') {
        const doc = {
          _id: 'settings/focusflow',
          ...settings
        }
        
        // 尝试获取现有文档
        const existingDoc = utools.db.get(doc._id)
        if (existingDoc) {
          doc._rev = existingDoc._rev
        }
        
        const result = utools.db.put(doc)
        if (result.ok) {
          console.log('Settings saved to database')
          return true
        } else {
          console.error('Failed to save settings:', result.message)
          return false
        }
      } else {
        console.error('Database API not available')
        return false
      }
    } catch (error) {
      console.error('Failed to save settings to database:', error)
      return false
    }
  }
  
  // 从 uTools 本地数据库获取设置
  window.getSettingsFromDb = () => {
    try {
      if (typeof utools !== 'undefined' && typeof utools.db !== 'undefined') {
        const doc = utools.db.get('settings/focusflow')
        if (doc) {
          // 移除 _id 和 _rev 字段
          const { _id, _rev, ...settings } = doc
          return settings
        }
        return {}
      } else {
        console.error('Database API not available')
        return {}
      }
    } catch (error) {
      console.error('Failed to get settings from database:', error)
      return {}
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
  
  // 打开文件或目录（开发环境模拟）
  window.shellOpenPath = (path) => {
    try {
      console.log('Dev: Opening path (simulated):', path);
      return true;
    } catch (error) {
      console.error('Failed to open path (simulated):', error);
      return false;
    }
  }
  
  // 获取当前时间对应的整10分钟时间戳（开发环境模拟）
  window.getRoundedTime = (time = Date.now()) => {
    return Math.floor(time / (10 * 60 * 1000)) * (10 * 60 * 1000)
  }
  
  // 存储截图到 uTools 本地数据库（开发环境模拟）
  window.saveScreenshotToDb = async (screenshotData) => {
    try {
      console.log('Dev: Saving screenshot to database (simulated):', screenshotData);
      return `screenshot/${Date.now()}`;
    } catch (error) {
      console.error('Failed to save screenshot to database (simulated):', error);
      return null;
    }
  }
  
  // 从 uTools 本地数据库获取截图（开发环境模拟）
  window.getScreenshotFromDb = async (screenshotId) => {
    try {
      console.log('Dev: Getting screenshot from database (simulated):', screenshotId);
      return {
        _id: screenshotId,
        timestamp: Date.now(),
        app: 'Chrome',
        time: new Date().toLocaleTimeString(),
        imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
      };
    } catch (error) {
      console.error('Failed to get screenshot from database (simulated):', error);
      return null;
    }
  }
  
  
  // 保存设置到 uTools 本地数据库（开发环境模拟）
  window.saveSettingsToDb = (settings) => {
    try {
      console.log('Dev: Saving settings to database (simulated):', settings);
      return true;
    } catch (error) {
      console.error('Failed to save settings to database (simulated):', error);
      return false;
    }
  }
  
  // 从 uTools 本地数据库获取设置（开发环境模拟）
  window.getSettingsFromDb = () => {
    try {
      console.log('Dev: Getting settings from database (simulated)');
      return {
        autoStart: false,
        notifications: true,
        checkInterval: 1,
        screenshotDir: ''
      };
    } catch (error) {
      console.error('Failed to get settings from database (simulated):', error);
      return {};
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