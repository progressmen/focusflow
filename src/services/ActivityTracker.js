import dayjs from 'dayjs'
import { getRoundedTime } from '../utils/time.js'

export class ActivityTracker {
  constructor() {
    this.isTracking = false
    this.currentApp = null
    this.startTime = null
    this.data = this.loadData()
    this.userActions = []
    this.windowHistory = []
    this.lastWindow = null
    this.screenshots = []
    this.timelineData = []
  }

  loadData() {
    try {
      // 尝试从 uTools 数据库加载数据
      if (typeof window.getSettingsFromDb === 'function') {
        const settings = window.getSettingsFromDb()
        // 这里可以从设置中获取追踪状态等信息
        console.log('Loaded settings from database:', settings)
      }
      
      // 暂时使用localStorage作为备份
      const stored = localStorage.getItem('focusflow-data')
      return stored ? JSON.parse(stored) : { sessions: [], daily: {}, userActions: [], screenshots: [] }
    } catch (error) {
      console.error('Failed to load data:', error)
      return { sessions: [], daily: {}, userActions: [], screenshots: [] }
    }
  }

  saveData() {
    try {
      // 保存用户操作记录和截图
      this.data.userActions = this.userActions
      this.data.screenshots = this.screenshots
      
      // 保存到localStorage作为备份
      localStorage.setItem('focusflow-data', JSON.stringify(this.data))
      
      // 保存设置到 uTools 数据库
      if (typeof window.saveSettingsToDb === 'function') {
        const settings = {
          isTracking: this.isTracking,
          currentApp: this.currentApp,
          startTime: this.startTime
        }
        window.saveSettingsToDb(settings)
      }
    } catch (error) {
      console.error('Failed to save data:', error)
    }
  }

  // 将timestamp转换为时分秒格式
  formatTime(timestamp) {
    const date = new Date(timestamp)
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
  }

  formatTimeMinute(timestamp) {
    const date = new Date(timestamp)
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  async startTracking() {
    if (this.isTracking) return

    this.isTracking = true
    this.currentApp = await this.getCurrentApp()
    this.startTime = Date.now()
    this.screenshots = []

    // 开始监听应用切换
    this.startAppListener()

    // 保存追踪状态到 uTools 数据库
    if (typeof window.saveSettingsToDb === 'function') {
      const settings = {
        isTracking: this.isTracking,
        currentApp: this.currentApp,
        startTime: this.startTime
      }
      window.saveSettingsToDb(settings)
    }

    console.log('Activity tracking started')
  }

  async stopTracking() {
    if (!this.isTracking) return

    this.isTracking = false

    // 结束当前会话
    if (this.currentApp && this.startTime) {
      await this.endSession(this.currentApp, this.startTime, Date.now())
    }

    this.stopAppListener()
    this.currentApp = null
    this.startTime = null

    // 保存追踪状态到 uTools 数据库
    if (typeof window.saveSettingsToDb === 'function') {
      const settings = {
        isTracking: this.isTracking,
        currentApp: this.currentApp,
        startTime: this.startTime
      }
      console.log('Saving settings:', settings)
      window.saveSettingsToDb(settings)
    }

    console.log('Activity tracking stopped')
  }

  startAppListener() {
    // 监听应用切换和截图
    this.appListenerInterval = setInterval(async () => {
      console.log('Checking for app switch and capturing screenshot', 
        typeof window.captureScreen, this.isTracking)
      
      if (!this.isTracking) return
      
      console.log('Current app:', this.currentApp)

      try {
        console.log('Current in try')
        // 截图
        if (typeof window.captureScreen === 'function') {
          console.log('Capturing screenshot')
          const screenshot = await window.captureScreen()
          console.log('Screenshot captured:', screenshot)
          if (screenshot) {
            const screenshotData = {
              imageData: screenshot,
              timestamp: Date.now(),
              app: this.currentApp,
              time: dayjs().format('HH:mm:ss')
            }
            console.log('Screenshot data:', screenshotData)
            await this.saveScreenshot(screenshotData)
            this.recordUserAction('screenshot', { app: this.currentApp })
            console.log('Screenshot captured for app:', this.currentApp)
          }
        }

        // 检查应用切换
        const newApp = await this.getCurrentApp()
        console.log('Current app:', newApp)
        if (newApp !== this.currentApp) {
          // 应用切换
          if (this.currentApp && this.startTime) {
            await this.endSession(this.currentApp, this.startTime, Date.now())
          }

          // 记录应用切换事件
          this.recordUserAction('app_switch', {
            from: this.currentApp,
            to: newApp
          })

          this.currentApp = newApp
          this.startTime = Date.now()
          console.log('App switched to:', newApp)
        }
      } catch (error) {
        console.error('Error in app listener:', error)
      }
    }, 3000) // 每3秒检查一次
  }

  stopAppListener() {
    if (this.appListenerInterval) {
      clearInterval(this.appListenerInterval)
      this.appListenerInterval = null
    }
  }

  async getCurrentApp() {
    try {
      if (typeof window.getCurrentAppName === 'function') {
        const appName = window.getCurrentAppName()
        return appName || '未知应用'
      } else {
        // 模拟数据
        const apps = ['Chrome', 'VS Code', '微信', 'Finder', '终端']
        return apps[Math.floor(Math.random() * apps.length)]
      }
    } catch (error) {
      console.error('Failed to get current app:', error)
      return '未知应用'
    }
  }

  async getCurrentWindow() {
    try {
      if (typeof utools !== 'undefined' && typeof utools.getCurrentWindow === 'function') {
        return utools.getCurrentWindow()
      } else {
        // 模拟数据
        return {
          title: document.title,
          process: { name: 'browser', path: window.location.href }
        }
      }
    } catch (error) {
      console.error('Failed to get current window:', error)
      return null
    }
  }

  async endSession(appName, startTime, endTime) {
    const duration = endTime - startTime
    const today = dayjs().format('YYYY-MM-DD')

    // 保存会话记录
    const session = {
      app: appName,
      start: startTime,
      end: endTime,
      duration: duration,
      date: today
    }

    this.data.sessions.push(session)

    // 更新每日统计
    if (!this.data.daily[today]) {
      this.data.daily[today] = {
        totalTime: 0,
        sessions: [],
        apps: {}
      }
    }

    const dayData = this.data.daily[today]
    dayData.totalTime += duration
    dayData.sessions.push(session)

    if (!dayData.apps[appName]) {
      dayData.apps[appName] = {
        time: 0,
        sessions: 0
      }
    }

    dayData.apps[appName].time += duration
    dayData.apps[appName].sessions += 1

    this.saveData()
  }

  // 记录用户操作
  recordUserAction(actionType, details) {
    const action = {
      type: actionType,
      details: details,
      timestamp: Date.now(),
      date: dayjs().format('YYYY-MM-DD'),
      time: dayjs().format('HH:mm:ss')
    }
    this.userActions.push(action)
    
    // 限制记录数量，避免内存占用过大
    if (this.userActions.length > 1000) {
      this.userActions.shift()
    }
    
    console.log('User action recorded:', action)
  }

  // 获取用户操作记录
  getUserActions(timeRange) {
    if (!timeRange) {
      return this.userActions
    }
    const { startTime, endTime } = timeRange
    return this.userActions.filter(action => 
      action.timestamp >= startTime && action.timestamp <= endTime
    )
  }

  // 生成用户活动报告
  generateActivityReport(timeRange) {
    const actions = this.getUserActions(timeRange)
    const appUsage = this.getAppUsage(actions)
    
    return {
      totalActions: actions.length,
      appSwitches: actions.filter(a => a.type === 'app_switch').length,
      mostActiveApps: this.getMostActiveApps(appUsage),
      timeDistribution: this.getTimeDistribution(actions),
      focusScore: this.calculateFocusScore(actions)
    }
  }

  // 获取应用使用情况
  getAppUsage(actions) {
    const appUsage = {}
    
    // 分析应用切换事件
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]
      if (action.type === 'app_switch' && action.details.to) {
        const appName = action.details.to
        if (!appUsage[appName]) {
          appUsage[appName] = {
            startTime: action.timestamp,
            endTime: action.timestamp,
            totalTime: 0
          }
        } else {
          // 更新上一个应用的结束时间和使用时长
          appUsage[appName].endTime = action.timestamp
          appUsage[appName].totalTime += action.timestamp - appUsage[appName].startTime
          // 开始新应用的计时
          appUsage[action.details.to] = {
            startTime: action.timestamp,
            endTime: action.timestamp,
            totalTime: 0
          }
        }
      }
    }
    
    return appUsage
  }

  // 获取最活跃的应用
  getMostActiveApps(appUsage) {
    return Object.entries(appUsage)
      .map(([name, data]) => ({
        name,
        usageTime: Math.floor(data.totalTime / 1000 / 60) // 转换为分钟
      }))
      .sort((a, b) => b.usageTime - a.usageTime)
      .slice(0, 5)
  }

  // 获取时间分布
  getTimeDistribution(actions) {
    const hours = {}
    
    actions.forEach(action => {
      const hour = new Date(action.timestamp).getHours()
      if (!hours[hour]) {
        hours[hour] = 0
      }
      hours[hour]++
    })
    
    return hours
  }

  // 计算专注度分数
  calculateFocusScore(actions) {
    if (!actions.length) return 0

    // 分析应用切换频率
    const appSwitches = actions.filter(a => a.type === 'app_switch').length
    const totalTime = actions[actions.length - 1].timestamp - actions[0].timestamp
    const switchRate = appSwitches / (totalTime / 1000 / 60) // 每分钟切换次数

    // 切换频率越低，专注度越高
    let focusScore = Math.max(0, 100 - (switchRate * 10))
    return Math.floor(focusScore)
  }

  async getTodayStats() {
    const today = dayjs().format('YYYY-MM-DD')
    const dayData = this.data.daily[today]

    if (!dayData) {
      return {
        totalTime: 0,
        activeApps: 0,
        appSwitches: 0,
        focusScore: 0
      }
    }

    const appSwitches = dayData.sessions.length
    const focusScore = this.calculateFocusScore(this.getUserActions())

    return {
      totalTime: Math.floor(dayData.totalTime / 1000), // 转换为秒
      activeApps: Object.keys(dayData.apps).length,
      appSwitches: appSwitches,
      focusScore: focusScore
    }
  }

  async getTopApps(limit = 10) {
    const today = dayjs().format('YYYY-MM-DD')
    const dayData = this.data.daily[today]

    if (!dayData || !dayData.apps) {
      return []
    }

    const apps = Object.entries(dayData.apps)
      .map(([name, data]) => ({
        name,
        time: Math.floor(data.time / 1000),
        sessions: data.sessions,
        icon: this.getAppIcon(name)
      }))
      .sort((a, b) => b.time - a.time)
      .slice(0, limit)

    // 计算百分比
    const totalTime = apps.reduce((sum, app) => sum + app.time, 0)
    apps.forEach(app => {
      app.percentage = totalTime > 0 ? Math.floor((app.time / totalTime) * 100) : 0
    })

    return apps
  }

  getAppIcon(appName) {
    // 返回应用图标（实际项目中需要提供真实的图标）
    const iconMap = {
      'Chrome': '🌐',
      'VS Code': '💻',
      '微信': '💬',
      'Finder': '📁',
      '终端': '⌨️'
    }
    return iconMap[appName] || '📱'
  }

  async getChartData() {
    const today = dayjs().format('YYYY-MM-DD')
    const dayData = this.data.daily[today]

    if (!dayData || !dayData.apps) {
      return []
    }

    return Object.entries(dayData.apps)
      .map(([name, data]) => ({
        label: name,
        value: Math.floor(data.time / 1000 / 60) // 转换为分钟
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }

  async getTodayData() {
    const today = dayjs().format('YYYY-MM-DD')
    const dayData = this.data.daily[today]

    if (!dayData) {
      return null
    }

    return {
      date: today,
      totalTime: Math.floor(dayData.totalTime / 1000 / 60), // 分钟
      apps: Object.entries(dayData.apps).map(([name, data]) => ({
        name,
        time: Math.floor(data.time / 1000 / 60),
        sessions: data.sessions
      })),
      sessions: dayData.sessions.length,
      focusScore: this.calculateFocusScore(this.getUserActions())
    }
  }

  // 获取截图数据
  async getTimelineData(roundedTime) {
    try {

      // 将roundedTime秒级时间戳转换为10:00-10:10格式
      const roundedTimeStr = this.formatTimeMinute(roundedTime*1000-(10*60*1000)) + "-" + this.formatTimeMinute(roundedTime*1000)

      // 文档ID格式：screenshot/roundedTime
      const docId = `roundedTime/${roundedTime}`
      console.log('roundedTime1 docId:', docId)


      // 获取当前文档
      const currentDoc = utools.db.get(docId) || {}
      console.log('roundedTime1 docId: currentDoc', currentDoc)

    

      // 获取当前文档的截图数组
      const screenshots = currentDoc.screenshots || []
      console.log('roundedTime1 docId: screenshots', screenshots)

      if (!screenshots.length) {
        return null;
      }

      // 判断doc中title、categories、summary、detail
      if (!currentDoc.title) {
        currentDoc.title = "未生成"
      }
      if (!currentDoc.categories) {
        currentDoc.categories = []
      }
      if (!currentDoc.summary) {
        currentDoc.summary = "未生成"
      }
      if (!currentDoc.detail) {
        currentDoc.detail = "未生成"
      }
      currentDoc.time = roundedTimeStr

      // 获取数据库中的截图
      // 遍历screenshots 数组，获取每个截图的详细信息
      const dbScreenshots = await Promise.all(screenshots.map(async (screenshot) => {
        const dbData = await window.getScreenshotFromDb(screenshot._id)
        // timestamp转时分秒
        const time = this.formatTime(screenshot.timestamp || 0)
        
        return {
          imageData:  dbData,
          timestamp: screenshot.timestamp || 0,
          app: screenshot.app || "uTools",
          time: time,
          screenshotId: screenshot._id
        }
      }))

      console.log('roundedTime docId: dbScreenshots', dbScreenshots)
      
      //按照时间戳排序
      dbScreenshots.sort((a, b) => a.timestamp - b.timestamp);
      
      currentDoc.screenshots = dbScreenshots;

      // this.screenshots = dbScreenshots;
      console.log('roundedTime docId: recentScreenshots', screenshots);
      return currentDoc;
    } catch (error) {
      console.error('Failed to get screenshots from database:', error);
      return this.screenshots;
    }
  }

  // 获取截图保存目录
  getScreenshotDir() {
    try {
      const settings = JSON.parse(localStorage.getItem('focusflow-settings') || '{}')
      let dir = settings.screenshotDir || ''
      
      // 如果没有设置目录，使用默认目录
      if (!dir) {
        const homeDir = process.env.HOME || process.env.USERPROFILE
        dir = `${homeDir}/Pictures/FocusFlow`
      }
      
      return dir
    } catch (error) {
      console.error('Failed to get screenshot directory:', error)
      // 返回默认目录
      const homeDir = process.env.HOME || process.env.USERPROFILE
      return `${homeDir}/Pictures/FocusFlow`
    }
  }

  // 确保目录存在
  async ensureDirectoryExists(dir) {
    try {
      if (typeof window.utools !== 'undefined' && typeof window.utools.fs === 'object') {
        const fs = window.utools.fs
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
          console.log('Created directory:', dir)
        }
      } else {
        console.warn('fs API not available, cannot ensure directory exists')
      }
    } catch (error) {
      console.error('Failed to ensure directory exists:', error)
    }
  }

  // 压缩截图
  async compressScreenshot(imageData) {
    return new Promise((resolve) => {
      const img = new Image()
      img.src = imageData
      
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        // 计算压缩后的尺寸，保持 aspect ratio
        const maxWidth = 1280
        const maxHeight = 720
        let width = img.width
        let height = img.height
        
        if (width > maxWidth) {
          height = height * (maxWidth / width)
          width = maxWidth
        }
        
        if (height > maxHeight) {
          width = width * (maxHeight / height)
          height = maxHeight
        }
        
        canvas.width = width
        canvas.height = height
        
        // 绘制压缩后的图像
        ctx.drawImage(img, 0, 0, width, height)
        
        // 转换为base64，质量设置为0.7
        const compressedData = canvas.toDataURL('image/jpeg', 0.7)
        resolve(compressedData)
      }
    })
  }

  // 保存截图到 uTools 本地数据库
  async saveScreenshotToDb(screenshotData) {
    try {
      // 压缩截图
      const compressedImageData = await this.compressScreenshot(screenshotData.imageData)
      screenshotData.imageData = compressedImageData
      
      // 使用 window.saveScreenshotToDb 保存到数据库
      if (typeof window.saveScreenshotToDb === 'function') {
        const screenshotId = window.saveScreenshotToDb(screenshotData)
        if (screenshotId) {
          console.log('Screenshot saved to database:', screenshotId)
          return screenshotId
        } else {
          console.error('Failed to save screenshot to database')
          return null
        }
      } else {
        console.error('saveScreenshotToDb function not available')
        return null
      }
    } catch (error) {
      console.error('Failed to save screenshot to database:', error)
      return null
    }
  }

  // 保存截图数据
  async saveScreenshot(screenshotData) {
    try {
      // 添加截图到数组
      this.screenshots.push(screenshotData)
      
      // 保存到 uTools 本地数据库
      const screenshotId = await this.saveScreenshotToDb(screenshotData)
      if (screenshotId) {
        screenshotData.screenshotId = screenshotId
      }
      
      // 保存到本地存储
      this.saveData()
      
      console.log('Screenshot saved successfully')
    } catch (error) {
      console.error('Failed to save screenshot:', error)
    }
  }

  // // 获取时间轴数据
  // async getTimelineData(docKey) {
  //   try {
  //     console.log('Getting timeline data for docKey:', docKey);
      
  //     // 这里应该从数据库中获取时间轴数据
  //     // 暂时返回模拟数据
  //     return [
  //       {
  //         id: '1',
  //         title: '上午工作时间',
  //         time: '09:00 - 10:00',
  //         summary: '主要使用了VS Code进行代码开发，同时使用了Chrome浏览器查阅文档。',
  //         details: '在这个时间段内，用户主要进行了前端代码开发工作，使用VS Code编辑了多个Vue组件文件，并通过Chrome浏览器查阅了相关的技术文档和API参考。',
  //         screenshots: []
  //       },
  //       {
  //         id: '2',
  //         title: '中午休息时间',
  //         time: '12:00 - 13:00',
  //         summary: '使用了Spotify听音乐，同时浏览了社交媒体。',
  //         details: '在午休时间，用户使用Spotify播放了音乐，并通过社交媒体查看了朋友的动态，短暂休息后继续工作。',
  //         screenshots: []
  //       },
  //       {
  //         id: '3',
  //         title: '下午会议时间',
  //         time: '14:00 - 15:00',
  //         summary: '参加了团队视频会议，讨论了项目进展和下一步计划。',
  //         details: '用户参加了团队的视频会议，与团队成员讨论了当前项目的进展情况，以及下一步的开发计划和任务分配。',
  //         screenshots: []
  //       }
  //     ];
  //   } catch (error) {
  //     console.error('Failed to get timeline data:', error);
  //     return [];
  //   }
  // }

  // 保存时间轴项目
  async saveTimelineItem(item) {
    try {
      console.log('Saving timeline item:', item);
      
      // 将时间轴项目保存到数据库
      if (typeof utools !== 'undefined' && typeof utools.db !== 'undefined') {
        // 确保项目有ID
        const docId = item.id || `roundedTime/${getRoundedTime()}`;
        
        // 创建文档
        const doc = {
          _id: docId,
          title: item.title || '活动时间轴',
          categories: item.categories || '',
          summary: item.summary || '',
          detail: item.detail || '',
          screenshots: item.screenshots || []
        };
        
        // 尝试获取现有文档
        const existingDoc = utools.db.get(docId);
        if (existingDoc) {
          doc._rev = existingDoc._rev;
        }
        
        // 保存文档
        const result = utools.db.put(doc);
        if (result.ok) {
          console.log('Timeline item saved to database:', docId);
          // 添加到内存中
          this.timelineData.push(item);
          return true;
        } else {
          console.error('Failed to save timeline item:', result.message);
          return false;
        }
      } else {
        console.error('Database API not available');
        //  fallback to memory storage
        this.timelineData.push(item);
        return true;
      }
    } catch (error) {
      console.error('Failed to save timeline item:', error);
      return false;
    }
  }

  // 生成AI汇总
  async generateAISummary(screenshots, startTime, endTime) {
    try {
      console.log('Generating AI summary...');
      
      // 这里应该调用AI服务生成汇总
      // 暂时返回模拟数据
      return {
        title: '活动汇总',
        summary: '用户在这段时间内主要进行了工作相关活动。',
        details: '根据截图分析，用户在这段时间内主要使用了开发工具和浏览器，进行了代码开发和文档查阅等工作。'
      };
    } catch (error) {
      console.error('Failed to generate AI summary:', error);
      return null;
    }
  }
} 
