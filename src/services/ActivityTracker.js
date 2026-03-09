import dayjs from 'dayjs'

export class ActivityTracker {
  constructor() {
    this.isTracking = false
    this.currentApp = null
    this.startTime = null
    this.data = this.loadData()
  }

  loadData() {
    try {
      const stored = localStorage.getItem('focusflow-data')
      return stored ? JSON.parse(stored) : { sessions: [], daily: {} }
    } catch (error) {
      console.error('Failed to load data:', error)
      return { sessions: [], daily: {} }
    }
  }

  saveData() {
    try {
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
    // 模拟应用切换监听（实际项目中需要使用 uTools API 或系统 API）
    this.appListenerInterval = setInterval(async () => {
      if (!this.isTracking) return

      const newApp = await this.getCurrentApp()
      if (newApp !== this.currentApp) {
        // 应用切换
        if (this.currentApp && this.startTime) {
          await this.endSession(this.currentApp, this.startTime, Date.now())
        }

        this.currentApp = newApp
        this.startTime = Date.now()
        console.log('App switched to:', newApp)
      }
    }, 1000) // 每秒检查一次
  }

  stopAppListener() {
    if (this.appListenerInterval) {
      clearInterval(this.appListenerInterval)
      this.appListenerInterval = null
    }
  }

  async getCurrentApp() {
    // 模拟获取当前应用（实际项目中需要使用 uTools API）
    try {
      // 这里应该使用 uTools API 获取当前活动应用
      // const currentApp = utools.getCurrentWindow()

      // 模拟数据
      const apps = ['Chrome', 'VS Code', '微信', 'Finder', '终端']
      return apps[Math.floor(Math.random() * apps.length)]
    } catch (error) {
      console.error('Failed to get current app:', error)
      return '未知应用'
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
    const focusScore = this.calculateFocusScore(dayData)

    return {
      totalTime: Math.floor(dayData.totalTime / 1000), // 转换为秒
      activeApps: Object.keys(dayData.apps).length,
      appSwitches: appSwitches,
      focusScore: focusScore
    }
  }

  calculateFocusScore(dayData) {
    if (!dayData.sessions.length) return 0

    // 计算专注度分数
    const sessions = dayData.sessions
    let totalFocusTime = 0
    let totalTime = 0

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i]
      const duration = session.duration
      totalTime += duration

      // 认为超过5分钟的会话是专注的
      if (duration > 5 * 60 * 1000) {
        totalFocusTime += duration
      }
    }

    return totalTime > 0 ? Math.floor((totalFocusTime / totalTime) * 100) : 0
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
      focusScore: this.calculateFocusScore(dayData)
    }
  }
}