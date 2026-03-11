import dayjs from 'dayjs'

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
  }

  loadData() {
    try {
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
      localStorage.setItem('focusflow-data', JSON.stringify(this.data))
    } catch (error) {
      console.error('Failed to save data:', error)
    }
  }

  async startTracking() {
    if (this.isTracking) return

    this.isTracking = true
    this.currentApp = await this.getCurrentApp()
    this.startTime = Date.now()
    this.screenshots = []

    // 开始监听应用切换
    this.startAppListener()

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
            this.saveScreenshot(screenshotData)
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
    }, 10000) // 每10秒检查一次
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
  getScreenshots() {
    return this.screenshots
  }

  // 保存截图数据
  saveScreenshot(screenshotData) {
    try {
      // 添加截图到数组
      this.screenshots.push(screenshotData)
      
      // 保存到本地存储
      this.saveData()
      
      console.log('Screenshot saved successfully')
    } catch (error) {
      console.error('Failed to save screenshot:', error)
    }
  }
} 
