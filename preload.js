/**
 * FocusFlow 预加载脚本
 * 统一封装 uTools API，保证 uTools 客户端与浏览器开发环境都可正常运行
 */

// ========== 工具函数（公共） ==========

// 时间戳向下取整到 10 分钟时间槽（返回秒）
function getRoundedSeconds(time = Date.now()) {
  return Math.floor(time / (10 * 60 * 1000)) * (10 * 60)
}

// 格式化 10 分钟时段：roundedSeconds → "HH:mm - HH:mm"（结束时间为开始时间向后 10 分钟）
function formatTimeslotRange(roundedSeconds) {
  const d = new Date(roundedSeconds * 1000)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const end = new Date(roundedSeconds * 1000 + 10 * 60 * 1000)
  const eh = String(end.getHours()).padStart(2, '0')
  const em = String(end.getMinutes()).padStart(2, '0')
  return `${hh}:${mm} - ${eh}:${em}`
}

// base64 data URL → Uint8Array（用于上传附件）
function dataUrlToUint8Array(dataUrl) {
  const commaIdx = dataUrl.indexOf(',')
  const base64 = commaIdx >= 0 ? dataUrl.substring(commaIdx + 1) : dataUrl
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// 任意二进制数据 → base64 data URL（兼容 Buffer/Uint8Array/ArrayBuffer/Blob/字符串）
function binaryToDataUrl(binaryData, mimeType = 'image/png') {
  return new Promise((resolve) => {
    try {
      if (binaryData == null) {
        resolve(null)
        return
      }
      // 1) Blob：用 FileReader 读 dataURL
      if (typeof Blob !== 'undefined' && binaryData instanceof Blob) {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(binaryData)
        return
      }
      // 2) 字符串：已经是 dataURL 或 base64
      if (typeof binaryData === 'string') {
        if (binaryData.startsWith('data:')) {
          resolve(binaryData)
        } else {
          resolve(`data:${mimeType};base64,${binaryData}`)
        }
        return
      }
      // 3) ArrayBuffer / TypedArray / Node Buffer：通过 Blob 转 dataURL，避免大字符串 btoa 失败
      let uint8 = null
      if (binaryData instanceof ArrayBuffer) {
        uint8 = new Uint8Array(binaryData)
      } else if (ArrayBuffer.isView(binaryData)) {
        // Uint8Array / Buffer 都属于 ArrayBuffer.isView
        uint8 = new Uint8Array(
          binaryData.buffer,
          binaryData.byteOffset || 0,
          binaryData.byteLength
        )
      } else if (binaryData && typeof binaryData === 'object' && Array.isArray(binaryData.data)) {
        // Buffer 序列化后形如 { type: 'Buffer', data: [...] }
        uint8 = new Uint8Array(binaryData.data)
      } else if (binaryData && typeof binaryData.length === 'number') {
        // 类数组兜底
        try {
          uint8 = new Uint8Array(binaryData)
        } catch (e) {
          console.error('binaryToDataUrl 类数组转换失败:', e)
        }
      }
      if (!uint8) {
        console.warn('binaryToDataUrl: 未识别的数据类型', binaryData && binaryData.constructor && binaryData.constructor.name)
        resolve(null)
        return
      }
      // 用 Blob + FileReader 读为 dataURL（比 btoa 更稳，无字符串长度限制）
      try {
        const blob = new Blob([uint8], { type: mimeType })
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      } catch (e) {
        // 兜底：分块 base64
        try {
          let bin = ''
          const CHUNK = 0x8000
          for (let i = 0; i < uint8.length; i += CHUNK) {
            bin += String.fromCharCode.apply(null, uint8.subarray(i, i + CHUNK))
          }
          resolve(`data:${mimeType};base64,${btoa(bin)}`)
        } catch (err) {
          console.error('binaryToDataUrl Blob/btoa 均失败:', err)
          resolve(null)
        }
      }
    } catch (e) {
      console.error('binaryToDataUrl 转换失败:', e)
      resolve(null)
    }
  })
}

// 从 data URL 中提取 MIME
function extractMime(dataUrl) {
  const m = /^data:([a-zA-Z0-9\-+./]+);base64,/.exec(dataUrl || '')
  return m ? m[1] : 'image/png'
}

// canvas 等比压缩到最大 1280x720，质量 0.7
function compressImage(dataUrl, maxW = 1280, maxH = 720, quality = 0.7) {
  return new Promise((resolve) => {
    try {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        const scale = Math.min(1, maxW / width, maxH / height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => resolve(dataUrl)
      img.src = dataUrl
    } catch (e) {
      console.error('compressImage 失败:', e)
      resolve(dataUrl)
    }
  })
}

// uTools 环境
if (typeof utools !== 'undefined') {
  console.log('uTools API available')

  // 缓存最近一次的 onPluginEnter 信息，避免 Vue 挂载晚于 onPluginEnter 导致事件丢失
  window.__focusflowPendingEnter = null

  // 等待 Vue 端把 tracker 实例挂到 window.__focusflowTracker 上
  // 然后立即执行快捷命令；最长等待 10 秒
  function _waitTrackerReady(timeoutMs = 10000) {
    return new Promise((resolve) => {
      const start = Date.now()
      const tick = () => {
        if (window.__focusflowTracker && typeof window.__focusflowTracker.startTracking === 'function') {
          resolve(window.__focusflowTracker)
          return
        }
        if (Date.now() - start > timeoutMs) {
          resolve(null)
          return
        }
        setTimeout(tick, 50)
      }
      tick()
    })
  }

  // 直接在 preload 层执行快捷命令（不依赖 Vue 是否挂载）
  // 现在合并为单一 feature，通过 typedCmd 判断具体命令
  async function _executeShortcutCommand(typedCmd) {
    try {
      const tracker = await _waitTrackerReady()
      if (!tracker) {
        try { utools.showNotification('FocusFlow 启动中，请稍后重试') } catch (e) {}
        return
      }
      const cmd = String(typedCmd || '').replace(/\s+/g, '').toLowerCase()
      const startCmds = ['开始记录']
      const stopCmds = ['停止记录']
      const isStart = startCmds.includes(cmd)
      const isStop = stopCmds.includes(cmd)

      if (isStart) {
        if (!tracker.isTracking) {
          await tracker.startTracking()
          try { utools.showNotification('FocusFlow 已开始记录活动') } catch (e) {}
        } else {
          try { utools.showNotification('FocusFlow 已经在记录中') } catch (e) {}
        }
        window.dispatchEvent(new CustomEvent('focusflow:tracking-changed', { detail: { tracking: true } }))
      } else if (isStop) {
        if (tracker.isTracking) {
          await tracker.stopTracking()
          try { utools.showNotification('FocusFlow 已停止记录活动') } catch (e) {}
        } else {
          try { utools.showNotification('FocusFlow 当前未在记录') } catch (e) {}
        }
        window.dispatchEvent(new CustomEvent('focusflow:tracking-changed', { detail: { tracking: false } }))
      }
    } catch (e) {
      console.error('[FocusFlow] 执行快捷命令失败:', typedCmd, e)
    }
  }

  // 判断是否为开始/停止命令（用于 UI 侧同步）
  function _resolveCommandType(typedCmd) {
    const cmd = String(typedCmd || '').replace(/\s+/g, '').toLowerCase()
    const startCmds = ['开始记录']
    const stopCmds = ['停止记录']
    if (startCmds.includes(cmd)) return 'start'
    if (stopCmds.includes(cmd)) return 'stop'
    return 'main'
  }

  // 注册 onPluginEnter：处理快捷命令并通知 Vue 端
  try {
    utools.onPluginEnter((payload) => {
      const code = payload && payload.code
      const typedCmd = payload && payload.payload
      window.__focusflowPendingEnter = payload
      window.dispatchEvent(new CustomEvent('utools:enter', { detail: payload }))
      if (code === 'FocusFlow' && _resolveCommandType(typedCmd) !== 'main') {
        _executeShortcutCommand(typedCmd)
      }
    })
  } catch (e) {
    console.error('[FocusFlow] onPluginEnter 注册失败:', e)
  }

  // 注册 onPluginOut
  try {
    if (typeof utools.onPluginOut === 'function') {
      utools.onPluginOut(() => {
        window.dispatchEvent(new CustomEvent('utools:exit'))
      })
    }
  } catch (e) {
    console.error('[FocusFlow] onPluginOut 注册失败:', e)
  }

  // ========== 悬浮图标窗口管理 ==========
  // 保存悬浮窗 BrowserWindow 实例（仅一份，再次调用会先关闭旧的）
  let _floatWin = null
  // 悬浮窗加载完成回调，会触发首次状态推送
  let _floatReadyCallback = null

  function _getFloatHtmlPath() {
    try {
      // preload.js 与 floating-icon.html 都在打包后的根目录下
      // 使用相对路径，uTools createBrowserWindow 内部会基于插件根目录
      return 'floating-icon.html'
    } catch (e) {
      return 'floating-icon.html'
    }
  }

  function _getInitialPosition() {
    try {
      // 使用 require('electron').screen 获取屏幕可用工作区
      const electron = require('electron')
      const screen = electron && electron.screen
      if (screen && typeof screen.getPrimaryDisplay === 'function') {
        const wa = screen.getPrimaryDisplay().workArea
        return {
          x: Math.max(wa.x, wa.x + wa.width - 80),
          y: Math.max(wa.y, wa.y + wa.height - 110)
        }
      }
    } catch (e) {}
    return { x: 1200, y: 700 }
  }

  // 打开悬浮窗
  window.openFloatingIcon = function () {
    try {
      // 已经存在，直接显示
      if (_floatWin && !_floatWin.isDestroyed?.()) {
        try { _floatWin.show && _floatWin.show() } catch (e) {}
        // 同步状态
        const tracking = !!(window.__focusflowTracker && window.__focusflowTracker.isTracking)
        _pushTrackingToFloat(tracking)
        return true
      }
      const pos = _getInitialPosition()
      _floatWin = utools.createBrowserWindow(
        _getFloatHtmlPath(),
        {
          width: 64,
          height: 64,
          x: pos.x,
          y: pos.y,
          frame: false,
          transparent: true,
          alwaysOnTop: true,
          skipTaskbar: true,
          resizable: false,
          movable: true,
          minimizable: false,
          maximizable: false,
          fullscreenable: false,
          hasShadow: false,
          backgroundColor: '#00000000',
          webPreferences: {
            devTools: false,
            contextIsolation: false,
            nodeIntegration: true
          }
        },
        () => {
          // 加载完成 → 立即推送当前追踪状态
          const tracking = !!(window.__focusflowTracker && window.__focusflowTracker.isTracking)
          _pushTrackingToFloat(tracking)
          if (typeof _floatReadyCallback === 'function') {
            try { _floatReadyCallback() } catch (e) {}
          }
        }
      )
      // 关键：直接监听悬浮窗 webContents 上的 IPC 消息，速度比 db 队列快得多
      try {
        const wc = _floatWin && _floatWin.webContents
        if (wc && typeof wc.on === 'function') {
          wc.on('ipc-message', (_e, channel, payload) => {
            if (channel === 'focusflow:from-float') {
              _handleFloatMessage(payload)
            }
          })
        }
      } catch (e) {
        console.error('[FocusFlow] 监听悬浮窗 IPC 失败:', e)
      }
      return true
    } catch (e) {
      console.error('[FocusFlow] 创建悬浮窗失败:', e)
      return false
    }
  }

  // 关闭悬浮窗
  window.closeFloatingIcon = function () {
    try {
      if (_floatWin && !_floatWin.isDestroyed?.()) {
        if (typeof _floatWin.close === 'function') {
          _floatWin.close()
        } else if (typeof _floatWin.destroy === 'function') {
          _floatWin.destroy()
        }
      }
    } catch (e) {
      console.error('[FocusFlow] 关闭悬浮窗失败:', e)
    }
    _floatWin = null
    return true
  }

  // 悬浮窗是否已打开
  window.isFloatingIconOpen = function () {
    return !!(_floatWin && !_floatWin.isDestroyed?.())
  }

  // 推送追踪状态到悬浮窗
  function _pushTrackingToFloat(tracking) {
    // 1) 通过 webContents 推送（最快）
    if (_floatWin && !_floatWin.isDestroyed?.()) {
      try {
        const wc = _floatWin.webContents
        if (wc && typeof wc.send === 'function') {
          wc.send('focusflow:tracking-state', { tracking: !!tracking })
        }
      } catch (e) {
        console.error('[FocusFlow] 推送状态到悬浮窗失败:', e)
      }
    }
    // 2) 同时写入 utools.db 状态文档，悬浮窗可以轮询读取（兜底）
    try {
      const docId = 'focusflow/tracking-state'
      const cur = utools.db.get(docId) || {}
      const doc = { _id: docId, tracking: !!tracking, ts: Date.now() }
      if (cur._rev) doc._rev = cur._rev
      utools.db.put(doc)
    } catch (e) {}
  }

  // 暴露给主插件用：当追踪状态变化时调用
  window.updateFloatingIconState = function (tracking) {
    _pushTrackingToFloat(!!tracking)
  }

  // 监听悬浮窗 sendToParent 发来的消息
  // 多通道兼容：
  //   - utools 的 plugin-callout（部分版本支持）
  //   - 通用 ipc 通道 focusflow:from-float（webContents.send 触发）
  //   - utools.db 命令队列（最稳的兜底，悬浮窗 .upx 隔离环境也能用）
  try {
    const electron = require('electron')
    if (electron && electron.ipcRenderer) {
      electron.ipcRenderer.on('plugin-callout', (_e, msg) => {
        _handleFloatMessage(msg)
      })
      electron.ipcRenderer.on('focusflow:from-float', (_e, msg) => {
        _handleFloatMessage(msg)
      })
    }
  } catch (e) {
    console.warn('[FocusFlow] electron ipc 不可用:', e.message)
  }

  // utools.db 命令队列轮询（兜底通道）
  // 悬浮窗写入 focusflow/cmd-queue，主插件每 300ms 检查并消费
  const CMD_QUEUE_DOC_ID = 'focusflow/cmd-queue'
  let _cmdQueueTimer = null
  function _startCmdQueuePoll() {
    if (_cmdQueueTimer) return
    _cmdQueueTimer = setInterval(() => {
      try {
        const doc = utools.db.get(CMD_QUEUE_DOC_ID)
        if (!doc || !Array.isArray(doc.items) || doc.items.length === 0) return
        // 拷贝并清空队列
        const items = doc.items.slice()
        doc.items = []
        utools.db.put(doc)
        items.forEach((it) => {
          _handleFloatMessage(it)
        })
      } catch (e) {}
    }, 300)
  }
  _startCmdQueuePoll()

  function _handleFloatMessage(msg) {
    if (!msg || typeof msg !== 'object') return
    if (msg.type === 'toggle-tracking') {
      _toggleTrackingFromFloat()
    } else if (msg.type === 'open-main') {
      try { utools.showMainWindow && utools.showMainWindow() } catch (e) {}
    } else if (msg.type === 'request-state') {
      const tracking = !!(window.__focusflowTracker && window.__focusflowTracker.isTracking)
      _pushTrackingToFloat(tracking)
    } else if (msg.type === 'drag-start') {
      // 悬浮窗开始拖动：记录初始位置
      _floatDrag = null
      try {
        if (_floatWin && !_floatWin.isDestroyed?.() && typeof _floatWin.getPosition === 'function') {
          const pos = _floatWin.getPosition()
          _floatDrag = {
            startScreenX: msg.screenX,
            startScreenY: msg.screenY,
            windowX: pos[0],
            windowY: pos[1]
          }
        }
      } catch (e) {
        console.error('[FocusFlow] drag-start 失败:', e)
      }
    } else if (msg.type === 'drag-move') {
      // 悬浮窗拖动中：根据屏幕坐标增量更新窗口位置
      if (!_floatDrag) return
      try {
        if (_floatWin && !_floatWin.isDestroyed?.() && typeof _floatWin.setPosition === 'function') {
          const dx = msg.screenX - _floatDrag.startScreenX
          const dy = msg.screenY - _floatDrag.startScreenY
          _floatWin.setPosition(
            Math.round(_floatDrag.windowX + dx),
            Math.round(_floatDrag.windowY + dy)
          )
        }
      } catch (e) {
        console.error('[FocusFlow] drag-move 失败:', e)
      }
    } else if (msg.type === 'drag-end') {
      _floatDrag = null
    }
  }
  let _floatDrag = null

  async function _toggleTrackingFromFloat() {
    try {
      const tracker = window.__focusflowTracker
      if (!tracker) {
        try { utools.showNotification('FocusFlow 未就绪') } catch (e) {}
        return
      }
      if (tracker.isTracking) {
        await tracker.stopTracking()
        try { utools.showNotification('FocusFlow 已停止记录') } catch (e) {}
        window.dispatchEvent(new CustomEvent('focusflow:tracking-changed', { detail: { tracking: false } }))
        _pushTrackingToFloat(false)
      } else {
        await tracker.startTracking()
        try { utools.showNotification('FocusFlow 已开始记录') } catch (e) {}
        window.dispatchEvent(new CustomEvent('focusflow:tracking-changed', { detail: { tracking: true } }))
        _pushTrackingToFloat(true)
      }
    } catch (e) {
      console.error('[FocusFlow] 悬浮窗触发追踪切换失败:', e)
    }
  }

  // 直接暴露 utools.db 供通用读取
  window.utoolsDb = utools.db
  window.utools = utools

  // 获取当前时间对应的整10分钟时间戳（秒级）
  window.getRoundedTime = getRoundedSeconds

  // 读取设置
  window.getSettingsFromDb = () => {
    try {
      const doc = utools.db.get('settings/focusflow')
      if (!doc) return {}
      const { _id, _rev, ...rest } = doc
      return rest
    } catch (e) {
      console.error('getSettingsFromDb 失败:', e)
      return {}
    }
  }

  // 保存设置
  window.saveSettingsToDb = (settings) => {
    try {
      const doc = { _id: 'settings/focusflow', ...settings }
      const existing = utools.db.get(doc._id)
      if (existing && existing._rev) doc._rev = existing._rev
      const res = utools.db.put(doc)
      return !!res.ok
    } catch (e) {
      console.error('saveSettingsToDb 失败:', e)
      return false
    }
  }

  // 获取当前前台应用名
  window.getCurrentAppName = () => {
    try {
      if (typeof utools.getAppName === 'function') {
        return utools.getAppName() || '未知应用'
      }
      return '未知应用'
    } catch (e) {
      console.error('getCurrentAppName 失败:', e)
      return '未知应用'
    }
  }

  // 捕获屏幕
  window.captureScreen = async () => {
    try {
      if (typeof utools.desktopCaptureSources !== 'function') {
        console.error('desktopCaptureSources API not available')
        return null
      }
      const sources = await utools.desktopCaptureSources({ types: ['screen'] })
      const screenSource = sources && sources[0]
      if (!screenSource) {
        console.error('未找到屏幕源')
        return null
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: screenSource.id
          }
        }
      })

      const video = document.createElement('video')
      video.srcObject = stream
      video.muted = true
      video.autoplay = true

      // 等待 video.play() 完成或超时
      try {
        await Promise.race([
          video.play(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('video.play 超时')), 5000))
        ])
      } catch (playErr) {
        console.error('video.play 失败:', playErr)
        stream.getTracks().forEach((t) => t.stop())
        return null
      }

      // 等待视频元数据就绪或超时
      try {
        await Promise.race([
          new Promise((resolve, reject) => {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              resolve()
              return
            }
            const handler = () => {
              video.removeEventListener('loadedmetadata', handler)
              video.removeEventListener('canplay', handler)
              resolve()
            }
            video.addEventListener('loadedmetadata', handler)
            video.addEventListener('canplay', handler)
            video.onerror = () => reject(new Error('video error'))
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('video meta 超时')), 5000))
        ])
      } catch (waitErr) {
        console.error('等待视频就绪失败:', waitErr)
        stream.getTracks().forEach((t) => t.stop())
        return null
      }

      const width = video.videoWidth
      const height = video.videoHeight
      if (!width || !height) {
        stream.getTracks().forEach((t) => t.stop())
        return null
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/png')

      stream.getTracks().forEach((t) => t.stop())
      return dataUrl
    } catch (e) {
      console.error('captureScreen 失败:', e)
      return null
    }
  }

  // 保存截图到 DB：创建 screenshot/<timestamp> 文档 + 附件，同时更新 timeslot
  window.saveScreenshotToDb = async (screenshotData) => {
    try {
      const { imageData, app, time, timestamp } = screenshotData || {}
      if (!imageData) return null

      const ts = timestamp || Date.now()
      const screenshotId = `screenshot/${ts}`
      const rounded = getRoundedSeconds(ts)
      const timeslotId = `timeslot/${rounded}`

      // 关键：参考原版能用的实现 —— 不要先 put 创建 screenshot 文档
      // 直接 postAttachment 会同时创建一个新文档+附件（rev 链不冲突）
      const mime = extractMime(imageData)
      try {
        const bytes = dataUrlToUint8Array(imageData)
        const r2 = utools.db.postAttachment(screenshotId, bytes, mime)
        if (!r2.ok) {
          console.error('[FocusFlow] 上传截图附件失败:', r2.message)
          return null
        }
        console.log('[FocusFlow] 截图附件已保存:', screenshotId, 'rev=', r2.rev, 'bytes=', bytes.length)
      } catch (e) {
        console.error('[FocusFlow] postAttachment 失败:', e)
        return null
      }

      // 3) 更新 timeslot 文档（只存 screenshot docId 引用 + 元信息）
      const appName = app || '未知应用'
      const timeStr = time || new Date(ts).toLocaleString()
      try {
        const cur = utools.db.get(timeslotId) || {}
        const screenshots = Array.isArray(cur.screenshots) ? cur.screenshots.slice() : []
        const exists = screenshots.some((s) => s.docId === screenshotId)
        if (!exists) {
          screenshots.push({
            docId: screenshotId,
            app: appName,
            time: timeStr,
            timestamp: ts
          })
        }
        const timeslotDoc = {
          _id: timeslotId,
          title: cur.title || '',
          categories: cur.categories || [],
          summary: cur.summary || '',
          detail: cur.detail || '',
          // 时段固定显示为 "HH:mm - HH:mm"（开始时间 + 10 分钟）
          time: formatTimeslotRange(rounded),
          screenshots
        }
        if (cur._rev) timeslotDoc._rev = cur._rev
        const tRes = utools.db.put(timeslotDoc)
        if (!tRes.ok) {
          console.error('[FocusFlow] 更新 timeslot 失败:', tRes.message)
        } else {
          console.log('[FocusFlow] timeslot 已更新:', timeslotId, '共', screenshots.length, '张截图')
        }
      } catch (e) {
        console.error('[FocusFlow] 更新 timeslot 异常:', e)
      }

      // 4) 更新 month 文档（标记该日有数据）
      try {
        const d = new Date(ts)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = d.getDate()
        const monthId = `month/${y}-${m}`
        const mcur = utools.db.get(monthId) || {}
        const dates = Array.isArray(mcur.dates) ? mcur.dates.slice() : []
        if (!dates.includes(day)) {
          dates.push(day)
          dates.sort((a, b) => a - b)
          const monthDoc = { _id: monthId, dates }
          if (mcur._rev) monthDoc._rev = mcur._rev
          utools.db.put(monthDoc)
        }
      } catch (e) {
        console.error('更新 month 文档失败:', e)
      }

      return screenshotId
    } catch (e) {
      console.error('saveScreenshotToDb 失败:', e)
      return null
    }
  }

  // 从 DB 读取截图附件 → base64 data URL
  window.getScreenshotFromDb = async (screenshotDocId) => {
    try {
      if (!screenshotDocId) return null
      // 读取文档（保留 mime 信息）
      let doc = null
      try {
        doc = utools.db.get(screenshotDocId)
      } catch (e) {
        console.error('读取 screenshot 文档失败:', e)
      }
      // 读取附件（uTools 在 macOS/Windows 通常返回 Uint8Array/Buffer）
      let attachment = null
      try {
        attachment = utools.db.getAttachment(screenshotDocId)
      } catch (e) {
        console.error('读取截图附件失败:', e)
      }
      if (!attachment) {
        console.warn('getScreenshotFromDb: 附件为空', screenshotDocId)
        return null
      }
      // MIME 优先取文档中保存的 mime 字段，其次默认 image/png
      const mime = (doc && doc.mime) || 'image/png'
      const dataUrl = await binaryToDataUrl(attachment, mime)
      if (!dataUrl) {
        console.warn('getScreenshotFromDb: 转 dataURL 失败', screenshotDocId)
      }
      return dataUrl
    } catch (e) {
      console.error('getScreenshotFromDb 失败:', e)
      return null
    }
  }

  // 获取 timeslot 文档
  window.getTimelineSlot = (roundedSeconds) => {
    try {
      const id = `timeslot/${roundedSeconds}`
      const doc = utools.db.get(id)
      if (!doc) return null
      return doc
    } catch (e) {
      console.error('getTimelineSlot 失败:', e)
      return null
    }
  }

  // 列出指定日期的所有 timeslot（uTools 高效批量读取）
  // dateStr: YYYY-MM-DD
  window.listTimelineSlotsByDate = (dateStr) => {
    try {
      if (!dateStr) return []
      const target = new Date(dateStr)
      if (Number.isNaN(target.getTime())) return []
      const startMs = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0, 0).getTime()
      const endMs = startMs + 24 * 60 * 60 * 1000 - 1
      const startSec = Math.floor(startMs / 1000)
      const endSec = Math.floor(endMs / 1000)

      const all = utools.db.allDocs('timeslot/') || []
      const result = []
      for (const slot of all) {
        const id = slot._id || ''
        const sec = Number(id.replace('timeslot/', ''))
        if (Number.isFinite(sec) && sec >= startSec && sec <= endSec) {
          result.push(slot)
        }
      }
      // 按时间升序
      result.sort((a, b) => {
        const sa = Number((a._id || '').replace('timeslot/', '')) || 0
        const sb = Number((b._id || '').replace('timeslot/', '')) || 0
        return sa - sb
      })
      console.log('[FocusFlow] listTimelineSlotsByDate', dateStr, '共', result.length, '个时间槽')
      return result
    } catch (e) {
      console.error('listTimelineSlotsByDate 失败:', e)
      return []
    }
  }

  // 保存 timeslot 文档（通常用于更新 AI 生成内容）
  window.saveTimelineSlot = (roundedSeconds, data) => {
    try {
      const id = `timeslot/${roundedSeconds}`
      const cur = utools.db.get(id) || {}
      const doc = {
        _id: id,
        title: (data && data.title) || cur.title || '',
        categories: (data && data.categories) || cur.categories || [],
        summary: (data && data.summary) || cur.summary || '',
        detail: (data && data.detail) || cur.detail || '',
        // 时段固定为 "HH:mm - HH:mm"（开始时间 + 10 分钟），忽略调用方传入的 time
        time: formatTimeslotRange(roundedSeconds),
        screenshots: (data && data.screenshots) || cur.screenshots || []
      }
      if (cur._rev) doc._rev = cur._rev
      const res = utools.db.put(doc)
      return !!res.ok
    } catch (e) {
      console.error('saveTimelineSlot 失败:', e)
      return false
    }
  }

  // 获取当月有数据的日期列表
  window.getMonthDates = (year, month) => {
    try {
      const m = String(month).padStart(2, '0')
      const id = `month/${year}-${m}`
      const doc = utools.db.get(id)
      if (!doc || !Array.isArray(doc.dates)) return []
      return doc.dates.slice()
    } catch (e) {
      console.error('getMonthDates 失败:', e)
      return []
    }
  }

  // 标记某一天有数据
  window.markDateHasData = (year, month, day) => {
    try {
      const m = String(month).padStart(2, '0')
      const id = `month/${year}-${m}`
      const cur = utools.db.get(id) || {}
      const dates = Array.isArray(cur.dates) ? cur.dates.slice() : []
      if (!dates.includes(day)) {
        dates.push(day)
        dates.sort((a, b) => a - b)
      }
      const doc = { _id: id, dates }
      if (cur._rev) doc._rev = cur._rev
      const res = utools.db.put(doc)
      return !!res.ok
    } catch (e) {
      console.error('markDateHasData 失败:', e)
      return false
    }
  }

  // ========== AI 日报告（dailyreport/<YYYY-MM-DD>） ==========
  // 文档结构：{ content, model, generatedAt, slotCount, stats }
  window.getDailyReport = (dateStr) => {
    try {
      if (!dateStr) return null
      const doc = utools.db.get(`dailyreport/${dateStr}`)
      if (!doc) return null
      return {
        content: doc.content || '',
        model: doc.model || '',
        generatedAt: doc.generatedAt || 0,
        slotCount: doc.slotCount || 0,
        stats: doc.stats || null
      }
    } catch (e) {
      console.error('getDailyReport 失败:', e)
      return null
    }
  }

  window.saveDailyReport = (dateStr, payload) => {
    try {
      if (!dateStr) return false
      const id = `dailyreport/${dateStr}`
      const cur = utools.db.get(id) || {}
      const doc = {
        _id: id,
        content: String(payload?.content || ''),
        model: String(payload?.model || ''),
        generatedAt: Number(payload?.generatedAt || Date.now()),
        slotCount: Number(payload?.slotCount || 0),
        stats: payload?.stats || null
      }
      if (cur._rev) doc._rev = cur._rev
      const res = utools.db.put(doc)
      return !!res.ok
    } catch (e) {
      console.error('saveDailyReport 失败:', e)
      return false
    }
  }

  window.removeDailyReport = (dateStr) => {
    try {
      if (!dateStr) return false
      const id = `dailyreport/${dateStr}`
      const cur = utools.db.get(id)
      if (!cur) return true
      utools.db.remove(id)
      return true
    } catch (e) {
      console.error('removeDailyReport 失败:', e)
      return false
    }
  }

  // ========== 数据导出 / 导入 ==========
  // 导出格式（FocusFlow Backup v1）：
  // {
  //   meta: { app: 'focusflow', version: 1, exportedAt, includeScreenshots },
  //   timeslots: [ {_id, title, summary, detail, categories, time, screenshots} ],
  //   months:    [ {_id, dates} ],
  //   reports:   [ {_id, content, model, generatedAt, slotCount, stats} ],
  //   screenshots: [ {_id, app, time, timestamp, mime, dataUrl} ]  // 可选
  // }
  // 注意：故意不导出 settings/apiKey，避免凭证泄漏（导入时也不动设置）
  window.exportAllData = async (options = {}) => {
    try {
      const includeScreenshots = !!options.includeScreenshots
      const payload = {
        meta: {
          app: 'focusflow',
          version: 1,
          exportedAt: Date.now(),
          includeScreenshots
        },
        timeslots: [],
        months: [],
        reports: [],
        screenshots: []
      }

      // 1. timeslot 文档
      try {
        const slots = utools.db.allDocs('timeslot/') || []
        for (const s of slots) {
          payload.timeslots.push({
            _id: s._id,
            title: s.title || '',
            summary: s.summary || '',
            detail: s.detail || '',
            categories: Array.isArray(s.categories) ? s.categories : [],
            time: s.time || '',
            screenshots: Array.isArray(s.screenshots) ? s.screenshots : []
          })
        }
      } catch (e) {
        console.error('export timeslots 失败:', e)
      }

      // 2. month 文档
      try {
        const months = utools.db.allDocs('month/') || []
        for (const m of months) {
          payload.months.push({
            _id: m._id,
            dates: Array.isArray(m.dates) ? m.dates.slice() : []
          })
        }
      } catch (e) {
        console.error('export months 失败:', e)
      }

      // 3. AI 日报告
      try {
        const reports = utools.db.allDocs('dailyreport/') || []
        for (const r of reports) {
          payload.reports.push({
            _id: r._id,
            content: r.content || '',
            model: r.model || '',
            generatedAt: r.generatedAt || 0,
            slotCount: r.slotCount || 0,
            stats: r.stats || null
          })
        }
      } catch (e) {
        console.error('export reports 失败:', e)
      }

      // 4. 截图（仅当用户勾选）—— 体积非常大，谨慎导出
      if (includeScreenshots) {
        try {
          const shots = utools.db.allDocs('screenshot/') || []
          for (const sh of shots) {
            try {
              const attachment = utools.db.getAttachment(sh._id)
              if (!attachment) continue
              const mime = sh.mime || 'image/png'
              const dataUrl = await binaryToDataUrl(attachment, mime)
              if (!dataUrl) continue
              payload.screenshots.push({
                _id: sh._id,
                app: sh.app || '',
                time: sh.time || '',
                timestamp: sh.timestamp || 0,
                mime,
                dataUrl
              })
            } catch (e) {
              console.warn('export 单张截图失败:', sh._id, e)
            }
          }
        } catch (e) {
          console.error('export screenshots 失败:', e)
        }
      }

      console.log('[FocusFlow] exportAllData:', {
        timeslots: payload.timeslots.length,
        months: payload.months.length,
        reports: payload.reports.length,
        screenshots: payload.screenshots.length
      })
      return payload
    } catch (e) {
      console.error('exportAllData 失败:', e)
      return null
    }
  }

  // 导入数据
  // @param payload 上面 exportAllData 的返回值
  // @param options.mode 'merge'（默认，与现有合并） | 'overwrite'（先清空再写入）
  window.importAllData = async (payload, options = {}) => {
    try {
      if (!payload || payload.meta?.app !== 'focusflow') {
        return { ok: false, message: '文件格式不正确（不是 FocusFlow 导出包）' }
      }
      const mode = options.mode === 'overwrite' ? 'overwrite' : 'merge'
      let imported = { timeslots: 0, months: 0, reports: 0, screenshots: 0 }

      // overwrite 模式：先清空业务数据（不动设置）
      if (mode === 'overwrite') {
        try {
          const prefixes = ['screenshot/', 'timeslot/', 'month/', 'dailyreport/']
          for (const prefix of prefixes) {
            const docs = utools.db.allDocs(prefix) || []
            for (const d of docs) {
              try { utools.db.remove(d._id) } catch (e) {}
            }
          }
        } catch (e) {
          console.error('import overwrite 清空失败:', e)
        }
      }

      // 通用：put 时自动取最新 _rev（避免与已有文档冲突）
      const safePut = (doc) => {
        const cur = utools.db.get(doc._id)
        const next = { ...doc }
        delete next._rev
        if (cur && cur._rev) next._rev = cur._rev
        const r = utools.db.put(next)
        return r && r.ok
      }

      // 1. timeslots
      for (const s of (payload.timeslots || [])) {
        if (!s || !s._id) continue
        try {
          if (safePut({
            _id: s._id,
            title: s.title || '',
            summary: s.summary || '',
            detail: s.detail || '',
            categories: Array.isArray(s.categories) ? s.categories : [],
            time: s.time || '',
            screenshots: Array.isArray(s.screenshots) ? s.screenshots : []
          })) imported.timeslots++
        } catch (e) {
          console.warn('import timeslot 失败:', s._id, e)
        }
      }

      // 2. months —— merge 模式下应合并已有 dates（不要把已有数据踢掉）
      for (const m of (payload.months || [])) {
        if (!m || !m._id) continue
        try {
          let dates = Array.isArray(m.dates) ? m.dates.slice() : []
          if (mode === 'merge') {
            const cur = utools.db.get(m._id)
            if (cur && Array.isArray(cur.dates)) {
              const merged = new Set([...cur.dates, ...dates])
              dates = Array.from(merged).sort((a, b) => a - b)
            }
          }
          if (safePut({ _id: m._id, dates })) imported.months++
        } catch (e) {
          console.warn('import month 失败:', m._id, e)
        }
      }

      // 3. reports
      for (const r of (payload.reports || [])) {
        if (!r || !r._id) continue
        try {
          if (safePut({
            _id: r._id,
            content: r.content || '',
            model: r.model || '',
            generatedAt: r.generatedAt || 0,
            slotCount: r.slotCount || 0,
            stats: r.stats || null
          })) imported.reports++
        } catch (e) {
          console.warn('import report 失败:', r._id, e)
        }
      }

      // 4. screenshots（如果导出包里有 dataUrl）
      for (const sh of (payload.screenshots || [])) {
        if (!sh || !sh._id || !sh.dataUrl) continue
        try {
          // 先写文档元数据
          const doc = {
            _id: sh._id,
            app: sh.app || '',
            time: sh.time || '',
            timestamp: sh.timestamp || 0,
            mime: sh.mime || 'image/png'
          }
          // 注意：postAttachment 会自动创建文档，不能先 put 否则 rev 冲突
          // 这里覆盖现有文档：先删后写
          try {
            const cur = utools.db.get(sh._id)
            if (cur) utools.db.remove(sh._id)
          } catch (e) {}
          const bytes = dataUrlToUint8Array(sh.dataUrl)
          const r2 = utools.db.postAttachment(sh._id, bytes, doc.mime)
          if (!r2.ok) continue
          // postAttachment 已建文档，再 put 一次补 metadata 字段（带最新 rev）
          const cur2 = utools.db.get(sh._id)
          if (cur2) {
            utools.db.put({ ...doc, _rev: cur2._rev })
          }
          imported.screenshots++
        } catch (e) {
          console.warn('import screenshot 失败:', sh._id, e)
        }
      }

      console.log('[FocusFlow] importAllData 完成:', imported, 'mode=', mode)
      return { ok: true, imported, mode }
    } catch (e) {
      console.error('importAllData 失败:', e)
      return { ok: false, message: String(e) }
    }
  }

  // 清空所有 focusflow 相关数据（截图、时间轴、月份索引；不含设置）
  // 使用 utools.db.allDocs(key前缀) 列出所有匹配文档
  window.clearAllData = () => {
    try {
      let removed = 0
      // 清理所有 focusflow 业务数据：截图（含附件）、时间槽、月份索引、AI 日报告
      // 注意：设置（focusflow-settings / settings/focusflow）不在此处清理
      const prefixes = ['screenshot/', 'timeslot/', 'month/', 'dailyreport/']
      for (const prefix of prefixes) {
        try {
          const docs = utools.db.allDocs(prefix) || []
          for (const doc of docs) {
            try {
              utools.db.remove(doc._id)
              removed++
            } catch (e) {
              console.error('clearAllData 删除失败:', doc._id, e)
            }
          }
        } catch (e) {
          console.error('clearAllData allDocs 失败:', prefix, e)
        }
      }
      console.log('[FocusFlow] clearAllData 已删除', removed, '个文档（含 dailyreport）')
      return { ok: true, removed }
    } catch (e) {
      console.error('clearAllData 失败:', e)
      return { ok: false, removed: 0, message: String(e) }
    }
  }

  // 按指定日期清空截图数据（YYYY-MM-DD）
  // 删除当天所有的 timeslot/<秒> 及其对应的 screenshot/<毫秒> 文档与附件
  // 同时更新 month/<YYYY-MM> 的 dates 数组，移除该天
  window.clearDateData = (dateStr) => {
    try {
      if (!dateStr) return { ok: false, removed: 0, message: '日期不能为空' }
      const target = new Date(dateStr)
      if (Number.isNaN(target.getTime())) {
        return { ok: false, removed: 0, message: '日期格式不正确' }
      }
      const startOfDay = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0, 0).getTime()
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1
      const startSec = Math.floor(startOfDay / 1000)
      const endSec = Math.floor(endOfDay / 1000)

      let removed = 0

      // 1) 删除当天 timeslot，并收集 screenshot docId 集合
      const screenshotIds = new Set()
      try {
        const slots = utools.db.allDocs('timeslot/') || []
        for (const slot of slots) {
          const id = slot._id || ''
          const sec = Number(id.replace('timeslot/', ''))
          if (Number.isFinite(sec) && sec >= startSec && sec <= endSec) {
            // 收集引用的 screenshot
            if (Array.isArray(slot.screenshots)) {
              for (const s of slot.screenshots) {
                if (s && s.docId) screenshotIds.add(s.docId)
              }
            }
            try {
              utools.db.remove(slot._id)
              removed++
            } catch (e) {
              console.error('clearDateData 删除 timeslot 失败:', slot._id, e)
            }
          }
        }
      } catch (e) {
        console.error('clearDateData 读取 timeslot 失败:', e)
      }

      // 2) 删除当天 screenshot/<ts>（按时间戳范围，避免遗漏未被任何 timeslot 引用的截图）
      try {
        const shots = utools.db.allDocs('screenshot/') || []
        for (const shot of shots) {
          const id = shot._id || ''
          const ts = Number(id.replace('screenshot/', ''))
          const inDay = Number.isFinite(ts) && ts >= startOfDay && ts <= endOfDay
          if (inDay || screenshotIds.has(id)) {
            try {
              utools.db.remove(shot._id)
              removed++
            } catch (e) {
              console.error('clearDateData 删除 screenshot 失败:', shot._id, e)
            }
          }
        }
      } catch (e) {
        console.error('clearDateData 读取 screenshot 失败:', e)
      }

      // 3) 更新 month 文档：从 dates 中移除该天
      try {
        const y = target.getFullYear()
        const m = String(target.getMonth() + 1).padStart(2, '0')
        const day = target.getDate()
        const monthId = `month/${y}-${m}`
        const monthDoc = utools.db.get(monthId)
        if (monthDoc && Array.isArray(monthDoc.dates)) {
          const newDates = monthDoc.dates.filter((d) => d !== day)
          if (newDates.length === 0) {
            utools.db.remove(monthId)
          } else if (newDates.length !== monthDoc.dates.length) {
            utools.db.put({ ...monthDoc, dates: newDates })
          }
        }
      } catch (e) {
        console.error('clearDateData 更新 month 失败:', e)
      }

      console.log('[FocusFlow] clearDateData', dateStr, '已删除', removed, '个文档')
      return { ok: true, removed }
    } catch (e) {
      console.error('clearDateData 失败:', e)
      return { ok: false, removed: 0, message: String(e) }
    }
  }

  // 仅清理截图（保留 AI 总结：title/summary/categories/detail 与日报告）
  // - scope='all'：删除所有 screenshot/ 文档与附件，并把所有 timeslot.screenshots 数组清空
  // - scope='date'：删除该天范围内的 screenshot 与该天 timeslot.screenshots 引用
  window.clearScreenshotsOnly = (options = {}) => {
    try {
      const scope = options.scope === 'date' ? 'date' : 'all'
      const dateStr = options.dateStr || ''

      let startOfDay = 0
      let endOfDay = 0
      let startSec = 0
      let endSec = 0
      if (scope === 'date') {
        if (!dateStr) return { ok: false, removed: 0, message: '日期不能为空' }
        const target = new Date(dateStr)
        if (Number.isNaN(target.getTime())) {
          return { ok: false, removed: 0, message: '日期格式不正确' }
        }
        startOfDay = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0, 0).getTime()
        endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1
        startSec = Math.floor(startOfDay / 1000)
        endSec = Math.floor(endOfDay / 1000)
      }

      let removed = 0

      // 1) 删除截图文档（含附件）
      const removedShotIds = new Set()
      try {
        const shots = utools.db.allDocs('screenshot/') || []
        for (const shot of shots) {
          const id = shot._id || ''
          let shouldRemove = scope === 'all'
          if (scope === 'date') {
            const ts = Number(id.replace('screenshot/', ''))
            shouldRemove = Number.isFinite(ts) && ts >= startOfDay && ts <= endOfDay
          }
          if (shouldRemove) {
            try {
              utools.db.remove(shot._id)
              removed++
              removedShotIds.add(id)
            } catch (e) {
              console.error('clearScreenshotsOnly 删除 screenshot 失败:', shot._id, e)
            }
          }
        }
      } catch (e) {
        console.error('clearScreenshotsOnly 读取 screenshot 失败:', e)
      }

      // 2) 同步把对应 timeslot 的 screenshots 数组清空（保留 title/summary/categories/detail）
      try {
        const slots = utools.db.allDocs('timeslot/') || []
        for (const slot of slots) {
          const id = slot._id || ''
          let shouldUpdate = false
          if (scope === 'all') {
            shouldUpdate = Array.isArray(slot.screenshots) && slot.screenshots.length > 0
          } else {
            const sec = Number(id.replace('timeslot/', ''))
            shouldUpdate = Number.isFinite(sec) && sec >= startSec && sec <= endSec &&
              Array.isArray(slot.screenshots) && slot.screenshots.length > 0
          }
          if (shouldUpdate) {
            try {
              utools.db.put({ ...slot, screenshots: [] })
            } catch (e) {
              console.error('clearScreenshotsOnly 清空 timeslot.screenshots 失败:', slot._id, e)
            }
          }
        }
      } catch (e) {
        console.error('clearScreenshotsOnly 读取 timeslot 失败:', e)
      }

      console.log('[FocusFlow] clearScreenshotsOnly', scope, dateStr, '已删除', removed, '张截图')
      return { ok: true, removed }
    } catch (e) {
      console.error('clearScreenshotsOnly 失败:', e)
      return { ok: false, removed: 0, message: String(e) }
    }
  }

  // 打开文件或目录
  window.shellOpenPath = (path) => {
    try {
      if (typeof utools.shellOpenPath === 'function') {
        utools.shellOpenPath(path)
        return true
      }
      return false
    } catch (e) {
      console.error('shellOpenPath 失败:', e)
      return false
    }
  }

  // ========== uTools 内置 AI（仅支持文本） ==========
  // 获取所有 uTools 内置 AI 模型
  window.getUtoolsAiModels = async () => {
    try {
      if (typeof utools.allAiModels !== 'function') {
        return { available: false, models: [] }
      }
      const models = await utools.allAiModels()
      return { available: true, models: Array.isArray(models) ? models : [] }
    } catch (e) {
      console.error('getUtoolsAiModels 失败:', e)
      return { available: false, models: [], error: String(e) }
    }
  }

  // 通过 uTools 内置 AI 进行对话
  // option: { model?, messages: [{role, content}] }
  // 返回 { content } 或抛出 Error
  window.callUtoolsAi = async (option) => {
    try {
      if (typeof utools.ai !== 'function') {
        throw new Error('当前 uTools 版本不支持内置 AI（需 v6+）')
      }
      const result = await utools.ai(option)
      return result || {}
    } catch (e) {
      console.error('callUtoolsAi 失败:', e)
      throw e
    }
  }

  // 是否可用 uTools 内置 AI
  window.isUtoolsAiAvailable = () => {
    return typeof utools.ai === 'function' && typeof utools.allAiModels === 'function'
  }
} else {
  // ========== 开发环境（浏览器，无 utools） ==========
  console.log('Dev environment: using localStorage mock')

  // 开发环境：mock utools 挂到 window
  window.utools = {
    showNotification: (message) => {
      console.log('Notification:', message)
      if (window.Notification && Notification.permission === 'granted') {
        new Notification('FocusFlow', { body: message })
      }
    },
    onPluginEnter: () => {},
    onPluginOut: () => {},
    getCurrentWindow: () => ({ title: document.title, process: { name: 'browser' } }),
    getForegroundProcess: () => ({ name: 'browser', path: window.location.href }),
    getAppName: () => {
      const apps = ['Chrome', 'VS Code', '微信', 'Finder', '终端', 'Slack', 'Notion']
      return apps[Math.floor(Math.random() * apps.length)]
    }
  }

  // mock 数据库（localStorage）
  const DB_PREFIX = 'focusflow:mock:'
  const ATTACH_PREFIX = 'focusflow:mock:attachments:'

  function mockGet(id) {
    try {
      const raw = localStorage.getItem(DB_PREFIX + id)
      return raw ? JSON.parse(raw) : null
    } catch (e) {
      return null
    }
  }
  function mockPut(doc) {
    try {
      const existing = mockGet(doc._id)
      doc._rev = existing ? String(Date.now()) : '1-' + Date.now()
      localStorage.setItem(DB_PREFIX + doc._id, JSON.stringify(doc))
      return { ok: true, rev: doc._rev }
    } catch (e) {
      return { ok: false, message: String(e) }
    }
  }
  function mockRemove(id) {
    try {
      localStorage.removeItem(DB_PREFIX + id)
      localStorage.removeItem(ATTACH_PREFIX + id)
      return { ok: true }
    } catch (e) {
      return { ok: false, message: String(e) }
    }
  }
  function mockPostAttachment(id, dataUrl) {
    try {
      localStorage.setItem(ATTACH_PREFIX + id, dataUrl)
      return { ok: true }
    } catch (e) {
      return { ok: false, message: String(e) }
    }
  }
  function mockGetAttachment(id) {
    try {
      return localStorage.getItem(ATTACH_PREFIX + id) || null
    } catch (e) {
      return null
    }
  }

  // 暴露一个 mock db（结构上与 utools.db 不完全一致，但保留常用方法）
  window.utoolsDb = {
    get: mockGet,
    put: mockPut,
    remove: mockRemove,
    postAttachment: mockPostAttachment,
    getAttachment: mockGetAttachment
  }

  window.getRoundedTime = getRoundedSeconds

  window.getSettingsFromDb = () => {
    try {
      const doc = mockGet('settings/focusflow')
      if (!doc) return {}
      const { _id, _rev, ...rest } = doc
      return rest
    } catch (e) {
      return {}
    }
  }

  window.saveSettingsToDb = (settings) => {
    try {
      const doc = { _id: 'settings/focusflow', ...settings }
      return !!mockPut(doc).ok
    } catch (e) {
      return false
    }
  }

  window.getCurrentAppName = () => {
    try {
      return window.utools.getAppName() || '未知应用'
    } catch (e) {
      return '未知应用'
    }
  }

  // 开发环境模拟截图：生成一个小的彩色占位图
  window.captureScreen = async () => {
    try {
      const apps = ['Chrome', 'VS Code', '微信', 'Finder', '终端']
      const label = apps[Math.floor(Math.random() * apps.length)] + ' @ ' + new Date().toLocaleTimeString()
      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 360
      const ctx = canvas.getContext('2d')
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      grad.addColorStop(0, '#6366f1')
      grad.addColorStop(1, '#8b5cf6')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#ffffff'
      ctx.font = '24px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('FocusFlow (dev mock screenshot)', canvas.width / 2, canvas.height / 2 - 10)
      ctx.font = '18px sans-serif'
      ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 24)
      const dataUrl = canvas.toDataURL('image/png')
      return dataUrl
    } catch (e) {
      console.error('dev captureScreen 失败:', e)
      return null
    }
  }

  window.saveScreenshotToDb = async (screenshotData) => {
    try {
      const { imageData, app, time, timestamp } = screenshotData || {}
      if (!imageData) return null

      const ts = timestamp || Date.now()
      const screenshotId = `screenshot/${ts}`
      const rounded = getRoundedSeconds(ts)
      const timeslotId = `timeslot/${rounded}`

      const screenshotDoc = {
        _id: screenshotId,
        timestamp: ts,
        app: app || '未知应用',
        time: time || new Date(ts).toLocaleString()
      }
      mockPut(screenshotDoc)
      mockPostAttachment(screenshotId, imageData)

      // 更新 timeslot
      const cur = mockGet(timeslotId) || {}
      const screenshots = Array.isArray(cur.screenshots) ? cur.screenshots.slice() : []
      const exists = screenshots.some((s) => s.docId === screenshotId)
      if (!exists) {
        screenshots.push({
          docId: screenshotId,
          app: screenshotDoc.app,
          time: screenshotDoc.time,
          timestamp: screenshotDoc.timestamp
        })
      }
      mockPut({
        _id: timeslotId,
        title: cur.title || '',
        categories: cur.categories || [],
        summary: cur.summary || '',
        detail: cur.detail || '',
        // 时段固定显示为 "HH:mm - HH:mm"
        time: formatTimeslotRange(rounded),
        screenshots
      })

      // 更新 month
      const d = new Date(ts)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = d.getDate()
      const monthId = `month/${y}-${m}`
      const mcur = mockGet(monthId) || {}
      const dates = Array.isArray(mcur.dates) ? mcur.dates.slice() : []
      if (!dates.includes(day)) {
        dates.push(day)
        dates.sort((a, b) => a - b)
        mockPut({ _id: monthId, dates })
      }

      return screenshotId
    } catch (e) {
      console.error('dev saveScreenshotToDb 失败:', e)
      return null
    }
  }

  window.getScreenshotFromDb = async (screenshotDocId) => {
    try {
      if (!screenshotDocId) return null
      return mockGetAttachment(screenshotDocId)
    } catch (e) {
      console.error('dev getScreenshotFromDb 失败:', e)
      return null
    }
  }

  window.getTimelineSlot = (roundedSeconds) => {
    try {
      return mockGet(`timeslot/${roundedSeconds}`)
    } catch (e) {
      return null
    }
  }

  // 开发环境：列出指定日期的所有 timeslot
  window.listTimelineSlotsByDate = (dateStr) => {
    try {
      if (!dateStr) return []
      const target = new Date(dateStr)
      if (Number.isNaN(target.getTime())) return []
      const startMs = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0, 0).getTime()
      const endMs = startMs + 24 * 60 * 60 * 1000 - 1
      const startSec = Math.floor(startMs / 1000)
      const endSec = Math.floor(endMs / 1000)

      const result = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key || !key.startsWith(DB_PREFIX + 'timeslot/')) continue
        const sec = Number(key.replace(DB_PREFIX + 'timeslot/', ''))
        if (!Number.isFinite(sec) || sec < startSec || sec > endSec) continue
        try {
          const doc = JSON.parse(localStorage.getItem(key) || 'null')
          if (doc) result.push(doc)
        } catch (e) {}
      }
      result.sort((a, b) => {
        const sa = Number((a._id || '').replace('timeslot/', '')) || 0
        const sb = Number((b._id || '').replace('timeslot/', '')) || 0
        return sa - sb
      })
      return result
    } catch (e) {
      console.error('dev listTimelineSlotsByDate 失败:', e)
      return []
    }
  }

  window.saveTimelineSlot = (roundedSeconds, data) => {
    try {
      const id = `timeslot/${roundedSeconds}`
      const cur = mockGet(id) || {}
      const doc = {
        _id: id,
        title: (data && data.title) || cur.title || '',
        categories: (data && data.categories) || cur.categories || [],
        summary: (data && data.summary) || cur.summary || '',
        detail: (data && data.detail) || cur.detail || '',
        // 时段固定为 "HH:mm - HH:mm"
        time: formatTimeslotRange(roundedSeconds),
        screenshots: (data && data.screenshots) || cur.screenshots || []
      }
      return !!mockPut(doc).ok
    } catch (e) {
      console.error('dev saveTimelineSlot 失败:', e)
      return false
    }
  }

  window.getMonthDates = (year, month) => {
    try {
      const m = String(month).padStart(2, '0')
      const doc = mockGet(`month/${year}-${m}`)
      if (!doc || !Array.isArray(doc.dates)) return []
      return doc.dates.slice()
    } catch (e) {
      return []
    }
  }

  window.markDateHasData = (year, month, day) => {
    try {
      const m = String(month).padStart(2, '0')
      const id = `month/${year}-${m}`
      const cur = mockGet(id) || {}
      const dates = Array.isArray(cur.dates) ? cur.dates.slice() : []
      if (!dates.includes(day)) {
        dates.push(day)
        dates.sort((a, b) => a - b)
      }
      return !!mockPut({ _id: id, dates }).ok
    } catch (e) {
      return false
    }
  }

  // 开发环境：AI 日报告 CRUD（mock）
  window.getDailyReport = (dateStr) => {
    try {
      if (!dateStr) return null
      const doc = mockGet(`dailyreport/${dateStr}`)
      if (!doc) return null
      return {
        content: doc.content || '',
        model: doc.model || '',
        generatedAt: doc.generatedAt || 0,
        slotCount: doc.slotCount || 0,
        stats: doc.stats || null
      }
    } catch (e) {
      return null
    }
  }

  window.saveDailyReport = (dateStr, payload) => {
    try {
      if (!dateStr) return false
      const doc = {
        _id: `dailyreport/${dateStr}`,
        content: String(payload?.content || ''),
        model: String(payload?.model || ''),
        generatedAt: Number(payload?.generatedAt || Date.now()),
        slotCount: Number(payload?.slotCount || 0),
        stats: payload?.stats || null
      }
      return !!mockPut(doc).ok
    } catch (e) {
      return false
    }
  }

  window.removeDailyReport = (dateStr) => {
    try {
      if (!dateStr) return false
      mockRemove(`dailyreport/${dateStr}`)
      return true
    } catch (e) {
      return false
    }
  }

  // 开发环境：export/import（不含截图，dev 环境本来就是 mock 图）
  window.exportAllData = async (options = {}) => {
    try {
      const payload = {
        meta: { app: 'focusflow', version: 1, exportedAt: Date.now(), includeScreenshots: false },
        timeslots: [],
        months: [],
        reports: [],
        screenshots: []
      }
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key || !key.startsWith(DB_PREFIX)) continue
        const id = key.slice(DB_PREFIX.length)
        let doc = null
        try { doc = JSON.parse(localStorage.getItem(key) || 'null') } catch (e) {}
        if (!doc) continue
        if (id.startsWith('timeslot/')) {
          payload.timeslots.push({
            _id: id,
            title: doc.title || '',
            summary: doc.summary || '',
            detail: doc.detail || '',
            categories: doc.categories || [],
            time: doc.time || '',
            screenshots: doc.screenshots || []
          })
        } else if (id.startsWith('month/')) {
          payload.months.push({ _id: id, dates: doc.dates || [] })
        } else if (id.startsWith('dailyreport/')) {
          payload.reports.push({
            _id: id,
            content: doc.content || '',
            model: doc.model || '',
            generatedAt: doc.generatedAt || 0,
            slotCount: doc.slotCount || 0,
            stats: doc.stats || null
          })
        }
      }
      return payload
    } catch (e) {
      return null
    }
  }

  window.importAllData = async (payload, options = {}) => {
    try {
      if (!payload || payload.meta?.app !== 'focusflow') {
        return { ok: false, message: '文件格式不正确（不是 FocusFlow 导出包）' }
      }
      const mode = options.mode === 'overwrite' ? 'overwrite' : 'merge'
      let imported = { timeslots: 0, months: 0, reports: 0, screenshots: 0 }
      if (mode === 'overwrite') {
        const toRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (
            key &&
            (key.startsWith(DB_PREFIX + 'timeslot/') ||
              key.startsWith(DB_PREFIX + 'month/') ||
              key.startsWith(DB_PREFIX + 'dailyreport/'))
          ) {
            toRemove.push(key)
          }
        }
        toRemove.forEach((k) => localStorage.removeItem(k))
      }
      for (const s of (payload.timeslots || [])) {
        if (!s || !s._id) continue
        mockPut({
          _id: s._id,
          title: s.title || '',
          summary: s.summary || '',
          detail: s.detail || '',
          categories: s.categories || [],
          time: s.time || '',
          screenshots: s.screenshots || []
        })
        imported.timeslots++
      }
      for (const m of (payload.months || [])) {
        if (!m || !m._id) continue
        let dates = Array.isArray(m.dates) ? m.dates.slice() : []
        if (mode === 'merge') {
          const cur = mockGet(m._id)
          if (cur && Array.isArray(cur.dates)) {
            dates = Array.from(new Set([...cur.dates, ...dates])).sort((a, b) => a - b)
          }
        }
        mockPut({ _id: m._id, dates })
        imported.months++
      }
      for (const r of (payload.reports || [])) {
        if (!r || !r._id) continue
        mockPut({
          _id: r._id,
          content: r.content || '',
          model: r.model || '',
          generatedAt: r.generatedAt || 0,
          slotCount: r.slotCount || 0,
          stats: r.stats || null
        })
        imported.reports++
      }
      return { ok: true, imported, mode }
    } catch (e) {
      return { ok: false, message: String(e) }
    }
  }

  window.clearAllData = () => {
    try {
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (
          key &&
          (key.startsWith(DB_PREFIX + 'screenshot/') ||
            key.startsWith(DB_PREFIX + 'timeslot/') ||
            key.startsWith(DB_PREFIX + 'month/') ||
            key.startsWith(DB_PREFIX + 'dailyreport/') ||
            key.startsWith(ATTACH_PREFIX + 'screenshot/'))
        ) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k))
      return { ok: true, removed: keysToRemove.length }
    } catch (e) {
      console.error('dev clearAllData 失败:', e)
      return { ok: false, removed: 0, message: String(e) }
    }
  }

  // 开发环境：按日期清空
  window.clearDateData = (dateStr) => {
    try {
      if (!dateStr) return { ok: false, removed: 0, message: '日期不能为空' }
      const target = new Date(dateStr)
      if (Number.isNaN(target.getTime())) {
        return { ok: false, removed: 0, message: '日期格式不正确' }
      }
      const startOfDay = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0, 0).getTime()
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1
      const startSec = Math.floor(startOfDay / 1000)
      const endSec = Math.floor(endOfDay / 1000)

      let removed = 0
      const removeKeys = []
      const screenshotIds = new Set()

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        if (key.startsWith(DB_PREFIX + 'timeslot/')) {
          const sec = Number(key.replace(DB_PREFIX + 'timeslot/', ''))
          if (Number.isFinite(sec) && sec >= startSec && sec <= endSec) {
            try {
              const slot = JSON.parse(localStorage.getItem(key) || '{}')
              if (Array.isArray(slot.screenshots)) {
                for (const s of slot.screenshots) {
                  if (s && s.docId) screenshotIds.add(s.docId)
                }
              }
            } catch (e) {}
            removeKeys.push(key)
          }
        } else if (key.startsWith(DB_PREFIX + 'screenshot/')) {
          const ts = Number(key.replace(DB_PREFIX + 'screenshot/', ''))
          if (Number.isFinite(ts) && ts >= startOfDay && ts <= endOfDay) {
            removeKeys.push(key)
            removeKeys.push(ATTACH_PREFIX + key.replace(DB_PREFIX, ''))
          }
        }
      }

      // 兜底：通过 screenshotIds 反查那些 timestamp 不在范围但仍被引用的
      for (const id of screenshotIds) {
        removeKeys.push(DB_PREFIX + id)
        removeKeys.push(ATTACH_PREFIX + id)
      }

      const unique = Array.from(new Set(removeKeys))
      unique.forEach((k) => {
        if (localStorage.getItem(k) !== null) {
          localStorage.removeItem(k)
          removed++
        }
      })

      // 更新 month 文档
      try {
        const y = target.getFullYear()
        const m = String(target.getMonth() + 1).padStart(2, '0')
        const day = target.getDate()
        const monthId = `month/${y}-${m}`
        const monthDoc = mockGet(monthId)
        if (monthDoc && Array.isArray(monthDoc.dates)) {
          const newDates = monthDoc.dates.filter((d) => d !== day)
          if (newDates.length === 0) {
            localStorage.removeItem(DB_PREFIX + monthId)
          } else if (newDates.length !== monthDoc.dates.length) {
            mockPut({ ...monthDoc, dates: newDates })
          }
        }
      } catch (e) {
        console.error('dev clearDateData 更新 month 失败:', e)
      }

      return { ok: true, removed }
    } catch (e) {
      console.error('dev clearDateData 失败:', e)
      return { ok: false, removed: 0, message: String(e) }
    }
  }

  // 开发环境：仅清截图（保留 timeslot 上的 AI 总结字段）
  window.clearScreenshotsOnly = (options = {}) => {
    try {
      const scope = options.scope === 'date' ? 'date' : 'all'
      const dateStr = options.dateStr || ''
      let startOfDay = 0
      let endOfDay = 0
      let startSec = 0
      let endSec = 0
      if (scope === 'date') {
        if (!dateStr) return { ok: false, removed: 0, message: '日期不能为空' }
        const target = new Date(dateStr)
        if (Number.isNaN(target.getTime())) {
          return { ok: false, removed: 0, message: '日期格式不正确' }
        }
        startOfDay = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0, 0).getTime()
        endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1
        startSec = Math.floor(startOfDay / 1000)
        endSec = Math.floor(endOfDay / 1000)
      }

      let removed = 0
      const removeKeys = []
      const slotsToUpdate = []

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        if (key.startsWith(DB_PREFIX + 'screenshot/')) {
          let inScope = scope === 'all'
          if (scope === 'date') {
            const ts = Number(key.replace(DB_PREFIX + 'screenshot/', ''))
            inScope = Number.isFinite(ts) && ts >= startOfDay && ts <= endOfDay
          }
          if (inScope) {
            removeKeys.push(key)
            removeKeys.push(ATTACH_PREFIX + key.replace(DB_PREFIX, ''))
          }
        } else if (key.startsWith(DB_PREFIX + 'timeslot/')) {
          let inScope = scope === 'all'
          if (scope === 'date') {
            const sec = Number(key.replace(DB_PREFIX + 'timeslot/', ''))
            inScope = Number.isFinite(sec) && sec >= startSec && sec <= endSec
          }
          if (inScope) {
            try {
              const slot = JSON.parse(localStorage.getItem(key) || '{}')
              if (Array.isArray(slot.screenshots) && slot.screenshots.length > 0) {
                slotsToUpdate.push({ key, slot })
              }
            } catch (e) {}
          }
        }
      }

      Array.from(new Set(removeKeys)).forEach((k) => {
        if (localStorage.getItem(k) !== null) {
          localStorage.removeItem(k)
          removed++
        }
      })
      slotsToUpdate.forEach(({ key, slot }) => {
        try {
          localStorage.setItem(key, JSON.stringify({ ...slot, screenshots: [] }))
        } catch (e) {}
      })

      return { ok: true, removed }
    } catch (e) {
      console.error('dev clearScreenshotsOnly 失败:', e)
      return { ok: false, removed: 0, message: String(e) }
    }
  }

  window.shellOpenPath = (path) => {
    console.log('Dev: shellOpenPath (simulated):', path)
    return true
  }

  // 请求通知权限
  if (window.Notification && Notification.permission === 'default') {
    try {
      Notification.requestPermission()
    } catch (e) {}
  }
}

// ========== 全局错误处理 ==========
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
