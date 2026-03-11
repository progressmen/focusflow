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
  async getScreenshots() {
    try {

      const roundedTime = window.getRoundedTime(Date.now())

      // 文档ID格式：screenshot/roundedTime
      const docId = `roundedTime/${roundedTime}`
      console.log('roundedTime1 docId:', docId)


      // 获取当前文档
      const currentDoc = utools.db.get(docId) || {}
      console.log('roundedTime1 docId: currentDoc', currentDoc)

      // 获取当前文档的截图数组
      const screenshots = currentDoc.screenshots || []
      console.log('roundedTime1 docId: screenshots', screenshots)


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

      // {
//     "imageData": "data:image/jpeg;base64,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DnB323M/Fp/QPQ5wd9tzPxaf0AfGAfZ/Q5wd9tzPxaf0D0OcHfbcz8Wn9AHxgH2f0OcHfbcz8Wn9A9DnB323M/Fp/QB8YB9n9DnB323M/Fp/QPQ5wd9tzPxaf0AfGAfZ/Q5wd9tzPxaf0D0OcHfbcz8Wn9AHxgH2f0OcHfbcz8Wn9A9DnB323M/Fp/QB8YB9n9DnB323M/Fp/QPQ5wd9tzPxaf0AfGAfZ/Q5wd9tzPxaf0D0OcHfbcz8Wn9AHxgH2f0OcHfbcz8Wn9A9DnB323M/Fp/QB8YB9n9DnB323M/Fp/QPQ5wd9tzPxaf0AfGAfZ/Q5wd9tzPxaf0D0OcHfbcz8Wn9AHxgH2f0OcHfbcz8Wn9A9DnB323M/Fp/QB8YB9n9DnB323M/Fp/QPQ5wd9tzPxaf0AfGAfZ/Q5wd9tzPxaf0D0OcHfbcz8Wn9AHxgH2f0OcHfbcz8Wn9A9DnB323M/Fp/QB8YB9n9DnB323M/Fp/QPQ5wd9tzPxaf0AfGAfZ/Q5wd9tzPxaf0D0OcHfbcz8Wn9AHxgH2f0OcHfbcz8Wn9A9DnB323M/Fp/QB8YB9n9DnB323M/Fp/QPQ5wd9tzPxaf0AfGAfZ/Q5wd9tzPxaf0D0OcHfbcz8Wn9AHxgH2f0OcHfbcz8Wn9A9DnB323M/Fp/QB8YB9n9DnB323M/Fp/QPQ5wd9tzPxaf0AfGAfZ/Q5wd9tzPxaf0D0OcHfbcz8Wn9AHxgH2f0OcHfbcz8Wn9A9DnB323M/Fp/QB8YB9n9DnB323M/Fp/QPQ5wd9tzPxaf0AfGAfZ/Q5wd9tzPxaf0D0OcHfbcz8Wn9AHxgH2f0OcHfbcz8Wn9A9DnB323M/Fp/QB8YB9n9DnB323M/Fp/QPQ5wd9tzPxaf0AfGAfZ/Q5wd9tzPxaf0D0OcHfbcz8Wn9AHxgH2f0OcHfbcz8Wn9A9DnB323M/Fp/QB8YB9n9DnB323M/Fp/QPQ5wd9tzPxaf0AfGAfZ/Q5wd9tzPxaf0D0OcHfbcz8Wn9AHxgH2f0OcHfbcz8Wn9A9DnB323M/Fp/QB8YB9n9DnB323M/Fp/QPQ5wd9tzPxaf0AfGAfZ/Q5wd9tzPxaf0D0OcHfbcz8Wn9AHxgH2f0OcHfbcz8Wn9A9DnB323M/Fp/QB8YB9n9DnB323M/Fp/QPQ5wd9tzPxaf0AfGAfZ/Q5wd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k1Tio20O+x9CstmzfznGpb1++iBG0Ouu9eYtDrrvXmdfA4zJf0RSw+Mp0nVjq/8AKabl62nXJes47Y7YyT5tLtcvjieCDjJSwErppRkqlSN/Vi7tXezVrTtttptd3LdI7cG0Ouu9eYtDrrvXmd14jglJ1lHBOmtEuLk51W7vn37bcy2LbtJRx3BaWJjiZYCEW67lOnappUeMWnStVraL6k+lJDo7cC0Ouu9eYtDrrvXmdjK8Rwdp4KEMdh6c6jd6l1Uu2nOyTT2Rs4btt077CeYV+DNXDV3hKFOFayVJ2qrYoRW69m29Tv02vcdHbiWh113rzFoddd68zWA6O2zaHXXevMWh113rzNYDo7bNoddd68xaHXXevM1gOjts2h113rzFoddd68zWA6O2zaHXXevMWh113rzNYDo7bNoddd68xaHXXevM1gOjts2h113rzFoddd68zWA6O2zaHXXevMWh113rzNYDo7bNoddd68xaHXXevM1gOjts2h113rzFoddd68zWA6O2zaHXXevMWh113rzNYDo7bNoddd68xaHXXevM1gOjts2h113rzFoddd68zWA6O2zaHXXevMWh113rzNYDo7bNoddd68xaHXXevM1gOjts2h113rzFoddd68zWA6O2zaHXXevMWh113rzNYDo7bNoddd68xaHXXevM1gOjts2h113rzFoddd68zWA6O2zaHXXevMWh113rzNYDo7bNoddd68xaHXXevM1gOjts2h113rzFoddd68zWA6O2zaHXXevMWh113rzNYDo7bNoddd68xaHXXevM1gOjts2h113rzFoddd68zWA6O2zaHXXevMWh113rzNYDo7bNoddd68xaHXXevM1gOjts2h113rzFoddd68zWA6O2zaHXXevMWh113rzNYDo7bNoddd68xaHXXevM1gOjts2h113rzFoddd68zWA6O2zaHXXevMWh113rzNYDo7bNoddd68xaHXXevM1gOjts2h113rzFoddd68zWA6O2zaHXXevMWh113rzNYDo7bNoddd68xaHXXevM1gOjts2h113rzFoddd68zWA6O2zaHXXevMWh113rzNYDo7bNoddd68xaHXXevM1gOjts2h113rzFoddd68zWA6O2zaHXXevMWh113rzNYDo7bNoddd68xaHXXevM1gOjts2h113rzFoddd68zWA6O2zaHXXevMWh113rzNYDo7bNoddd68xaHXXevM1gOjts2h113rzDUU2m5XXZ/M9BmmaZPW4Pxw9CC43StMUtsX/pb5nEp1I06tTU2rvmV+camto3d6VWh1pd38xaHWl3fzNlYjDKyVJpO2rYnzeYdbDRjJQpv1k98Vs2WXP0kLNa0OtLu/mLQ60u7+ZfGrhtEVOlJvc3+RONfC2SdF819i6ANW0OtLu/mZUYvc5d38wqkeJcOLjqvfXz26DMdtNpbXt2dwDi49b+HmOLj1v4eZvYLE4ejh40sThZ1LSnK8Y7dsUkr9G/5EqWIwcMRNzw05U5RSsqaW1La7X2fP8A0A5/Fx638PMcXHrfw8zp8dlbcW8HWtFK6UEtXqtdPS079hTjauDq0NOGw1SFTWndwSurbefpsBoaY3teV1+H+YtDrS7v5mW/1svzLsPiKdKk4zi3K916t+jtXaBRaHWl3fzFodaXd/M2FiKClK9NtObktm1bu33lqxOD1L9S9KumtK3Xezf27wNK0OtLu/mZjBTkox1Sb3JRuW16tCcbUqendtt77/6G/keMoYeNanOusNWqNcXXdJS0WvfvWz8wOU1HROzf2Jc3YzKpM2s0r4fFY+tVwsNFKULJaFG3q9CL4Ya63Ey6WmO2g6bRBwOjOhbmNepSsaTJXLBrKJLTYnaxhotVZEbEWSbIsqlEAbiUJROjhXFJNnPiXwk0tjI3ppi6NTEpR2GhVxTuZbckU1IkzOpz9KatZyNd7y2cSto2lcmSJhmWYZKi/WNZrqZnUZabeTZUySmzVUySmNI8m3GqWKqaPGGVVI8Vpm6MK3aXxrdpylV7S2NV9JXxXnI6sK9ucvhWucqFR9Js06hW4tMc3SVS63mHI1Y1CfGFNNfJswntNulNHLVQ2adTYRYtjk7+Dqdp1KMzzWHxOi12dKljoaftHPli68bLNOzKpGxy8dNWZGWMTWySOdi8VdPaUkRcHm8Rho1cXWltblVlsSXS+wrWDg3Zam3stZeRdyiEMRKfGQUo1G9r7SVXGqtiJV6lWEpylqe1K51T082+1UstlGGuVOoo9ZwVv4EqWVTrxUqcXJOSgvs7W+YuqZhCpR4p8SlZbVJ3/iW4POZYKjKlTnTcZO7vUkudPma6q27whprK5uUoxpzm4uz0xUrP8kYWWyauqdRppO+hc+7mOjDhBVp1Kk4zop1J65es9/f2F64V17JNYXZp6VtXPse8DkLK5tpKlVu20loXNv5iLy5qOpwqKKSd9CtZ7nuO7Q4WaJrjaOHcU1JKnJwd1LUufddGtW4R1K+Fnh58m0zgotq/Nz77XA5HJKfS+5eRnkkOl9y8ifHUvvIfEhx1L7yHxICPEL7yfy8hxC+8n8vIlx1L7yHxIcdS+8h8SJ3UaiPEL7yfy8hxC+8n8vIlx1L7yHxIcdS+8h8SG6eMR4hfeT+XkOIX3k/l5EuOpfeQ+JDjqX3kPiQ3TxiEqOmLfGT2K/N5HPp1cRUjNxmvUjqastx0p1abhJKpFtrpOMm0mk3Z710lpl+qLjPss5VW6/yQ5VW6/wAkVAbpqLeVVuv8kOVVuv8AJFQG6ai3lVbr/JDlVbr/ACRUBumot5VW6/yQ5VW6/wAkVAbpqLeVVuv8kOVVuv8AJFQG6ai3lVbr/JDlVbr/ACRUBumot5VW6/yQ5VW6/wAkVAbpqLeVVuv8kOVVuv8AJFQG6ai3lVbr/JDlVbr/ACRUBumot5VW6/yQ5VW6/wAkVAbpqLeVVuv8kOVVuv8AJFQG6ai3lVbr/JDlVbr/ACRUBumot5VW6/yQ5VW6/wAkVAbpqLeVVuv8kOVVuv8AJFQG6ai3lVbr/JDlVbr/ACRUBumot5VW6/yQ5VW6/wAkVAbpqLeVVuv8kOVVuv8AJFQG6ai3lVbr/JDlVbr/ACRUBumot5VW6/yQ5VW6/wAkVAbpqLeVVuv8kOVVuv8AJFQG6ai3lVbr/JDlVbr/ACRUBumot5VW6/yQ5VW6/wAkVAbpqLeVVuv8kOVVuv8AJFQG6ai3lVbr/JDlVbr/ACRUBumot5VW6/yQ5VW6/wAkVAbpqLeVVuv8kOVVuv8AJFQG6ai3lVbr/JDlVbr/ACRUBumot5VW6/yQ5VW6/wAkVAbpqLeVVuv8kOVVuv8AJFQG6ai3lVbr/JDlVbr/ACRUBumot5VW6/yQ5VW6/wAkVAbpqLeVVuv8kOVVuv8AJFQG6ai3lVbr/JDlVbr/ACRUBumot5VW6/yQ5VW6/wAkVAbpqLeVVuv8kOVVuv8AJFQG6ai3lVbr/JDlVbr/ACRUBumot5VW6/yQ5VW6/wAkVAbpqLeVVuv8kOVVuv8AJFQG6ai3lVbr/JDlVbr/ACRUBumot5VW6/yQ5VW6/wAkVAbpqLeVVuv8kOVVuv8AJFQG6ai3lVbr/JDlVbr/ACRUBumot5VW6/yQ5VW6/wAkVAbpqLeVVuv8kOVVuv8AJFQG6ai3lVbr/JGOOn0r4UVgjdTqRPjp/h+FDjp/h+FEABPjp/h+FDjp/h+FEABPjp/h+FDjp/h+FEABPjp/h+FDjp/h+FEABPjp/h+FDjp/h+FEABPjp/h+FDjp/h+FEABPjp/h+FDjp/h+FEABPjp/h+FDjp/h+FEABdTqzlOzttT/AGV0HqaVC8dx5Sh/ar3P+B7ejFaSmV034ZvbQq0bcxo16aR2cQlY5eI5y2FWzjmT2MgWVF6zKmzdy1iRBkpMgEbGYMmCVUoM2IM1U9pfSkRlF8K2Yq5GpAshuJNXRlL231uNGcDXkjeqxNSaOjGuXkihkWTkVs0YKySFjNiuk7ExcAA2YuAEJRkXQkUItg9pCWzCW02ITNSLLFOxWxpjW4qvaZ47tNLje0w6vaU0182+q/aWRxNlvOXx3aOP7R4kzdfljXOZWYSS+0cZ4jtK5YjtI8FvrWO5LM5JfaNarmUpb5HIlXfSVyrN85H04fmMm/DTVxEdctMZyWp9CbLJ0cPHH8TDEcZQ4xR47Ta6vvsasHenF9iJb3ZFEe3dzTB4Clg60qNKVKdKoo0m4yXGLn2t7em6NfLMLgK+FlPFTUZqotjnFXjeOxXkt93ttbZzGnXwWKoUozrU2obltvbyIU8JiKtF1qdGUqabTklsuo6n8k2RLL6Xzwywuspp0qOV4Cvi60ZY6nTpQq2upxV425ry29G9ksXlOWYbCVasczhVnCLcKdOcXqeqyX5Lb29hyXQrKcoOlNSiryjpd0uky8LiErvD1Uv3GSo62GyvKq8Iasx4uehSlrnFJvSnZdG12/JlqyLK5WSzakr6dsqkF73a/wD3ztbjhVKVSk0qlOUL7tStcgB6N8HcBGHGPMI8U7WqcZHTdxb0X6dm/d+ew5eaYLC4OVJYXFxxCnG8mpJ2f5bv+/caOp6dN3ZbbGAAAAAAAAAMx+2vea5sR+2vea4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABZR/tV7n/A9pSn6p4ql/afk/4HqqdX1SmU224rra+vPYcrEyNutV2HOrzuXxi2eW2tOW0qb2kpbWQNnNRq5ixm5G5KGZLYVtFm8w0TEVWXUntKmicHYX0jH23ab2Fpq06mwt4xWMdOmXoq7TUqF85lE2a4sORrzK2WzKmaxzUSM2JqJmxAqsYsWOJBokRMGTBAE4yKzFwNhTDqFGoaiE7Wur2kXUK95gJWcYOMIADLmyLkDABsi2ZZFlamR0aX9lD91FkJunOM1vi00VUv7GH7qLadOdWrGlTi5Tm1GMVzt7jnrojfxeZwr4edOnRcHVac25X3dBDA5vicvpuFFU3FqaanG/2kl8rbDrZ7wdeAy3jqdOCeEnGlXlGd9d4p6muba2u45+W4TLsThnyrEqjW/WNOUrKyhsVunU9nTZo5/j8vHy4eXH6dHyM+TPLfJ7IZ/iqeJqV40qKc6ejS1Jpetqum3e930llPhPj6dVVXGnOUZOUdep2bcm+f8AE9/8TEMrwE8wlh3mEKUOL1RnKcWr3tZtO3Q+xX6C+eT5RTpwqfpRSU5NJRnC6Vk02r7N7XvXd0OdzMbmVbHUaFOtGH6hWU1dylsS2tvbuRqHejlGWVeKhTx+qpUvaMZRb+0kk9u9qX/SzWzbK8Nl9KDpYlTquTjOm5Rco/kv+/8AUOUAAAAAAAAAAMx+2vea5sR+2vea4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABKn9v8n/A9DGps3nnofaf7r/gdhTJk2mXSyrPZvNOpIulO5rVJXZpIi5IXMAwyyoRaDZFsaRtm4bIuRG5bSu0mzKZC4uNG1qnYlxpQ5EXMr4p817qXISkVamL3JkUuW2WyDMkWXilbWgw4m06ViuUbBOms0Vy3l80Uy3hVWzDMswwIsBghIAAkAAQCxlIlGNyUIWMWNlUG1uK50XEja2qpaISLXFlbRWpjoUU3SppJtuKSSJrUpK11JPZbfcxhpukqVSO+Glq/YXV8VWxOLliqslKrKWpu1rs53QnXeMVO1epUcG7NSndXI0cHiMRBSpU9Sc1BbUryfN8yVfGcdTlBQ06pand35i3BZtXwFCVGlGLjKV3eU1zp8zXVW3ea8uHFjlrivSuNys/xNfktf17UnLQ7S0+tbuFfC4jCy016M6bWz1lz2vb5m7DPsXTqVZxjTTrVI1Jb96adt+71VvK8ZnGIx2GVCrCCWpSvHVd2cmt7t+2zJZoptNNOzW5mG7u7AAAAAAAAAAAADMftr3mubEftr3muAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAShvf7r/gdRPYcuG9/uv+DOhr2FsEWszlZGvJ7Sc5XKm9ptpntJMEeYIhbY4kXFlhZCKcSYitOSszFy2srSKrFlBbTNrkoxOjhMC6q3BFcppkWdHGYZUmaUokqVSZuyWkaSTaLFiVhpYHdlR7DWqUjsTo9hq1aPYZyt7i5FSBrTidKtSNOpAuysajRhoslGxBoKoNGCbRBoAAYuQsyZMC4VSRs0IJs1UzYo1EmL6Wx9upSwylHYQq4XsJ4autm034RVZbjmtsrqkljz9WhbmNWUNp6TEYB2ew5dbByUtxeZ7ZZYaqmnspxXYiyCUpxTdk3YjbTs6NgM2jvZ1lWDweAhVobJakk9bfGKy27v4dJq5bhMuxOGfKsSqNb9Y05SsrKGxW6dT2dNmjmNt2u27bjAHVeXYBYypSePjCEaWtScoyu07abrY21tVjb/AEPlEa0qX6RU21smqsFGPrQV7327JSduz8zz4A71LJcsqR9bNadN+rtlUhZpva9j+TtbnORjaNLD4upSo1VVpxtaSad9nSu4oAAAAAAAAAAAAZj9te81zYj9te81wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADMf2v3ZfwZtp3NSP7X7sv4M6+EwUqjWwtjZPaPG5XUacovfYqd0zvVcucKd3E5FalpmzTHOZHJxXD2pTMmLWMlmbJbSexooubeDp8bPSTIi1rVleZCNNuSR3a2SVXBTUXtNejl01WScWX0parwuAc7Ox1IwWFo9DOrhMBGlQUpLmORmteKbUWTZpG9uTjKnGTZoyRfJ3bZVIqVUzBlkWyVGQY1GbhL2TsyipFFfKO0jKunzmGnZbGvXgjn1oG/VqJmnV2mkZZNKcdpW4mxJFTRZkpaINF8kVSQQqZG5ORWytWjNzOogLjadLEySlZlSZJMnaNNyjXaa2nZwGIWpXZ51Oxt4bEuEltKZ47i2Odj32Gw9LFUua5r4vJ0r2RzcszNxa9Y9LRxccRS27WcOUyxreWZPnuKhxeLrQ6s5L5lRs5l/wCJ4r/jT/izWNp6AAEgAAAAAAAAAAAAAAADMftr3mubEftr3muAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWYeOuvGHWuvkfVsq4NwhSUppXsfLMD/AL7R/ePuFOqqeHbvayMuRfDK4+nks+o08PFxjbYeLxVnNs9RwhxcZ1ZbTydeqm2a8M1FeTK5e1EiDDltMXOhhsOpk0NWKiu05fOdjJNmLg+01wx2yzy0+p4HKaNXLIzqRW44GOwVGhWbSR6TD46CymME9qR5rGt1Kjbd7mvDhvLdcnJy66jn4/HaKLhE8li6sqlRts9LjaF4NtnmsXFRm7GnPJPTThts7azZVNkmyubORvVcmQuZk9pW2EJ3MpldzNwl1+U9pjlHac7ju0yqpGl/JvuvcrlO5rKoTUiUbTkyuRK5iSCFcimRbPcUyCFciD3k2VsrV4yDBkhZgXACEkycZFSZJMnaLHRwmIcJLaenyzG7k2eLhPS0zq4HGaGtplyY7WxujMHfMcS+mrL+LNcsry14ipLrTb+ZWZNgAEgAAAAAAAAAAAAAAADMftr3mubEftr3muAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWUJ8XWU+rd/I95DP6lag1qe48DHn/df8GeiwkXxDl2FcpPulrZpi5VKjbZyZVG2X5hUfGNFOCp8dXSZ0Y6mO2N3ctGmVrtEW7Ho6+U6cIppb0edr0pU5tNDj5Jkty8VwjEXtO5k2l1Y3ODF7TdwuIlRmpRZ2cd0485t9RwuHnUwqcJXVjlY/Exwzabu0c3A8KJ0MNxd+Y42ZZrLFVG7mmOVl7ct4t1fj811XSZxKtV1JXZGc3J7yBlyZbrqwmoMhKLZPnLqSi95THHa1umjKElzFbT6DsvCwlG6NSvh1AvlxWKzNoGSco2ZFxMdNELkkysupQ1MrtbScE2XRgzZw+F1JbDa5E0txW8kaTitc9IOJtVKGnmKZRsWllUuNjVmthRM26iNWoWVUyIE5EClWgZMGQlgyYMhKLM3DMBCVydOq4PeVGLkVOnUi9UVLpVzJGl/ZQ/dRIwbAAAAAAAAAAAAAAAAAAAzH7a95rmxH7a95rgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE6S1Tt0p/wPV06Do4N3R5bDf28T3mPpKOCbXQZcmWrIvjN7eEzCV67NvI6LniE+00sd/vL956HgxhHOpF2OnO+PGz4cfLlerWFjPCRg1zHks8y/ipOSR7yNJpJWONn+Ei6Dk0ebw8lmb1efjmWD53a0rFkZWGJio1WiCZ7eN62+fynelyqO28i53IXM2LeSumbmUYSJJFVmApOL2GbGLEDZp4lpFdaprZUltJJGvnbNKeMVuJXKBsuJXJFbExoGxh5JSNczGTTMK3l1XosFWhG1zo8dTnE8rSxLjzm1DHPpMMuOunHlkmnUrqLbsaVVWI8qut5VUrXL4yxTOyqqrsatRltSdzXk7mznQkRJNkSqwZACWDIAGDBIwwMEWSIsrUx06P9jD91fwJkKP9hT/dX8CZi1AAAAAAAAAAAAAAAAAABmP217zXNiP217zXAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALKDtWT9/8AA91mNe2Wx7UeEpO079j/AIHr8fiqVTLqcYyTdjPPHysWmXjK8nOLq4trtPp3AbInWgpuOxLeeAy7DcdjlsveR934IYKOGyqDttki/wAiW4aivFfHLampkehXSPH8LafJ6Dhax9VlCNtp80/pBVOOpRaucOHHcc5t1Xmtmq+S4p3rtkI7SWJ/tWVKVj256eZl7WbmZRWpXLIslRIkYRkgDAuABlGBcmUSbISDZCTJ2jTSABk1ESTaImUELFUaM8YysySgk7kGyTRFoJiLMGWjBVZkABIAABhmTAGCLJEWVqXTo/2FP91fwJmvhcRTdGMJTUZR2es7XL+MpffUvEj5mNasgjxlL76l4kfMzxlL76l4kfMDIMa6f3tLxI+Zm8LX4ynb/iLzAAXh95T+NeYvH7yn8a8wAF4/eU/jXmPV+8p/GvMAB6vXp/GvMzs68PjQGAZ2deHxoWXXh8aAwDNl14fGhb8UPjRAR+2vea5sxS1L1ob+uiji30x+JARBLi30x+JDi5dMfiQEQS4uXTH4kOLl0x+JARBLi5dMfiQ4uXTH4kBEEuLl0x+JDi30x+JARBLi30x+JDQ+mPxICIJaH0x+JDQ+mPxICIJcW+mPxIzxcvw/EgIAnxcvw/EhxUuz4kBAE+Kn2fEhxU+hfEglAE+Jn0L4kOJn0L4kBAE+Kn2fEhxUvw/EghAE+Kn0L4kOJn0L4kEoAnxcvw/Ehxcl1fiQQgCfFy/D8SHFS/D8SAgCfFy/D8SHFy/D8SAgCfFS/D8SHFT7PiQEAT4mfQviQ4mfQviQSgCfEz6F8SHFTXR8SAgCXFvpj8SHFvpj8SCEQS4t9MfiQ0Ppj8SAiCfFS/D8SIuNt8ofGgMAzGOt2jKEn2TTM8W07Xjf95ARBPipfh+JEXZOznTX/OvMDAF4rfUp/GvMxqh97S8SPmBkGNdP72l4kfMaqf3tLxI+ZIyDGqH3tLxI+Y1U/vaXiR8wMgxrp/e0vEj5jVT+9peJHzAyDGqn97S8SPmNUPvaXiR8wMgxqh97S8SPmNVP72l4kfMDIMaqf3tLxI+Y1U/vaXiR8wMgxqh97S8SPmSST3Tg/wDnQGAZ0/ih8aM6fxQ+NECIM6dttUPjRnQ+tH4kBEEtD6Y/EhofTH4kBEGbJftw+NC1/wBqHxoDAM6fxQ+NC34ofGgMAkqcnucfiQcGt7j8SAiCWhvnj8SHFy3er8SAiCzianQu9DiKnVXehtKsFnEVOr80OIqdX5obQrBZxFXq/NGHSmt9l/zIbSgCfFT7PiRnianQu9DYrBZxFTqrvRiVKcVeVkulyQQgBeP3lP415i8PvKfiLzAAaofe0/EXmY1Q+9peJHzAyDGqH3tLxI+Y1U/vaXiR8wMgxrp/e0vEj5jXT++peJHzAyDGun97S8SPmNdP72l4kfMkZBjXT+9peJHzGqH3tLxI+YGQY1Q+9peJHzGqH3tLxI+YGQY1Q+9peJHzGqH3tLxI+YGQY1Q+9peJHzGqH3tLxI+YGQY1Q+9peJHzGqH3tPxF5gZvaM30Ql/BltPGznFRbZr1KsIwklJSck0lF33lVF2aNMMdqZV6/g3SVTGQvt2n3bJ0oYCnFdB8F4M4lU8VBt859vynM8PLA03xsbpbdpnySrYutWu4NI+fcKskxOMnKSi2j29TM8PGN9af5nNx2cYd0mtj2HNnudxpNW9vkcuCdZzd4MjU4JVIxu4WPUZlwio4ectKiebxnCuVSelS2MvjnzZNMsOKRwcfliwjaObezO3jK8sbByZw6sdEmd3FlbO3FyYyek1MzrKNZjUaMmxrMayjWNZA2NY1FGozFuTsgLbtuyJulLTc6OW5NWxUlaDaN/NMs5BQSkrOwuUl01w49zbx4AKKgAJGUSW4gSTJVrNjDRJMwyUINECxkGVq8AAQsAAAAAImGiTMWISg0RaLGjFitidq7GxhaGr12tnMRp0nVqKC5zoVFHD0dnNsSK6Ttqum61eNGG1tm/OkotQj9mCsZyzDOnRlipr1p+rC/wA2bUaI0tGqqJNUew3I0SyNHsK6WaSodhJUOw31Q7CaodgGgqHYSWH7DoKh2E1h+whLnrD9hNYfsOlHD9hYsP2ELSOWsN2E1huw6ccN2FscN2FU6clYXsJcl7DrrDdhJYXsITpx+S9hnkvYdhYXsJcl7CNracbkvYY5L2Hb5L2GOS9g2acTkvYOS9h2+S9g5L2EbNOJyXsHJOw7fJOww8L2DadOG8L2GHhew7bwvYReF7Cdo04vJewcm7Ds8l7DHJuwbNOVTwjlLduNhYPsOphcJqb2G3yNLmKZVfHFweSdhmOE7Dvci/CYWEs9xXyT4uMsH2Elg9u47ccHs3FkcH2EbW8XFWC7CFTBWe49HHBdhGtgti2FfI8Xm3g+wrlg77LHoXhIrbLZFbyt1NH2EoLsLSqXFyYYK1FK21byE8LZXaO2sRXSv6/zKqmJrb25InWSPLH1t57k2ure24tq4O6Ww7UMVUv9uXeXqvVlsi5NvmRbdR4x55YPZuMPCNcx6WKxd9tOt8LLJVJ01acZxf4rojdTqPLLCNvcS5C1zHpFi6l7an3mddatdRjOfuTZG6mYx5uODfQWxwfYdidDEb+Kqr/lZSqk4u2qSa7STTQWD7DKwXYdeliaq/bl3m3TqYqSTjGq0+dJlLavMY89yLsIVsC9D2HqHVxMFeUakV0tNFc8XV0/bl3lfKp8I8VLCWb2EXhew9JXr1JzteTfQV6cSt1Oqv8AlZr5fqzuLz/Jewi8N2HfnVrQ2T1x990VvET6z7y0u0eLlQio0XFrcczEULxls3no6larJbHJ+4o46qppuU1+bG+0ajk8H8DKNWpVcXuLK2Gm67mlznraeIawilteznZHD49SbjOCku0t5XanhLHnKmFnyWUlvirnlJKTknLe1tPp0qk1K8KMnHsjsObnkU8Jrjh3B87UbE4Xszx66fP60r7Ok06u2Ww7FerU1fbl3mvxlRu2uTfvNdOfbmWMpHTccRzxq9zMaqkd7kveNG3OsrEbHT4yfXl3kourP7LnL3XY0bcqwSOq+PW9VF+TIupUTtqkvzJ0bc6wsdHjJ9eXeSlKpCbi5u6dt40jbmWDR0uMn15d5h1Z9eXeNG3NsZSOhxk+vLvCqT68u8jSdtKC2nUwFVJKM1eN+kxCpNfty7zewNao6qWuXeRYmVuwwKnHVF2VrkXh9LsdCeMrQprTOXeaFXF15y21Zd5nem0kqMsJd64r1kV0aMp1rtbDbp1MxpwjWviI0W0tfrab9F9x6Dja9KhB1lUTlFSWq+1dJW2rSSuBSw0qzkoQbUd8uYzPCXi1Y7MMY1LbFWe8sWGjUTlFbGRtNx6eOr0PXezathdh8L6t2tp1swyupGTq007PfZEsDgak4bU7tbLmkm2eV04lek07WJYXC6nKVtx6DF5LpjGb323DB5dujpsisu7tOU/w6auFwTdJuxr4nCNPceshhI06aVjUq4DjW3p2cxXyttTMdSR5yjhrcxuUMJrq+qrtGziKHJ09h1styiUKFLFKWvjY3fRtK5VpI044J6dxOOBfQegWAaW2Ni2ngdm4xuTTxeeWAfQT5A+g9IsB2EuQLoKeatxeZ5B2GhjsA9V7bj2/IF0Gnjsq1R1RXvJmZjO3i4YVp7jdp4O6TsdDkemVmtxu4bCpwtYv5NLg46wPYcrhFQVLAO+y7PcLBK248zw1oKng6MbbXJk45ds7j0+dyhtKpRN2UOwolE3jnsasokHE2JRKpItFapaItFjRFosqgo7RKNkSIt3JQwAZJgWJxi2IRu7Hosl4PVcYtWlu5a2Y91Hvp57TYaTq5xlzy/GTpP8AZOdY0x1ZuIvSGkWJ2M2LeKNq7GbE7Cw8UbQsZSJWM2J0bYSLYbGV2Jp2LSK11cBXdKaaZ6zBZ9WhTUVN954ajUsdGhimucpljtfHJ7aHCCq/tTfeQxWe/qWtW1nleV3W8oq4iUlvKfTlTcjMsZKtUdpM5cptSvcuqyua0ntNsZJGVrbp45xhpua1WrrlcqZgmYydltqWoXIglVK5lMhYyRpKy+w2MDHXiIp9JqJ3OzkGCnisbBRjfaR6hrb69wNyWi8s45wTbWy6PNcNsuqyryUYuy6D6VkGDWX5LTjPZ6t3c8nwmzTCTqzhFRb6Tj495cm3XuTHT4cLmDB0uZm4MADNzKZEXCNLExcjcXJ2jQyLMtmCExgyYASyAAkAAAwAAMGTKi5NJK7bskuchO3puDGDw+FwOJzrFqEoUVppxluc3uRw69VYzG+tJRg5bXbYtu1nZ4SWyzLcBkNN+tShx2Itz1Jc35eRxcHR4yok9xSd9rX9Hd9SbSpK1KC0w93SWQpmKUFGKS5i+KC8YjAtjT2GYotiiEoxplkaZKKLIohKKpk40yaRZFEJjEKRYqSJxRNIrV5EFS7C2NJEoosiilXkRVIlxSLUiSRC2lSpIkqSLUiSRAp4lDiV0GwkZ0kGmvxK6AqHYbOkyoldp01uIRh0VY29JFxG06aTokHSRuOJXKJKK1eKRh0kbNiNiULMDQTi32m4qCvuI4GK0P3m6omWV7bYTprcQugrrU1GUO1m8oq5r4qPrQfaVntOU6I0V0F0aC6CylG8U7F8IFbUyKo0F0GK1D9W3Y3IQ2Ga0E6TK7Trp5/H09GHuudo0aWmF5verJf9/kdTM4/7Ov3jjYifF012tf6np/h2Ez+ThjXkfitynxOTx/R08ohHMs0o4ZPUpTtO3MltfyPc1MmyWtKphVh4RqKCk1G6aTuk/k+4+fcGM5oYPNYzVPjXUfFKzs4NtbT336ToLFKipx45xu0trSXT0HtfiE5JyTx6j5z8L4eGceXnju/u+b18NGjjKtKO6E2j6LwQwFDC5HSrwhHj66cpTa272kvceArvXja8umrL+LO9mmYYrLMgyPFYSo4TjxnuavuZ5M4PqfLvFj1t9Dx5+PxMcr+juY/hLjctxToYjAw6VJSdpLpR0cRyDPcrdOUqc3Up6oxutUHbf2HzzhRwvxOc5PTw+HwUaeKT9esp7l+Fdpuf0acFcRhnVzvMabjOUHHDxlvs98v++06uX4d4+O5ck1f+XD8bLmnPlvPyxvr9Y0MJhFiMZRovYqlSMW/e7Htc64QYPg3Rp4HCwpRqabqL3RXTZb2eTytWzDBt/fU/8yNTh1CvhuEGJryTaqQjOm3zqyXyscv4dxYcvLZl9nV+K8nJx8P+XdWu/huGeYcYpylSrU29q02+aLeFscHmWS4fN6FNRq8YoSdtrTT2P3NGvVWX59lODq5O8JSlCNqsXNQlHZua79pbmuDWE4HU6arQra68ZuUHeLunuZT5V3yWY46jzvw6fL4/k+GeXlhr21OBeAoYrNZ1MRBTjQpuaUlsvdbf4mnw54TZpmGf0uDmTYp4RJJ1akZ6G29u2XMkv4nX4FwbxOLjHe6H+qPM5th6GScNqmZZ3hozwOMqp0KkZ3lGUbNPStttm38jnx/+O19FZcuWYu/wdxXCDg/nmFyjN8xhmeBxUJRjUbvOlNJys29rTSe8cKMBRwubTVCCjCpBVNK3K9727jGQYzAZ/nmJzDBRqzVFRjKrLVxeuzWmCduZ7XbnRu8KotZjTT3rDxXzZXOf5cyq0njzXGM8Gso/9nLF04R11ZSvLnsna3yOz+jsR2d5XwZbWQUEpW9af+ZnUvL7x9yOHk/DOHmy887d39y8+eN1HKxOSSxlCVCvCM4SVtvN2o+W1KGipKD3xdmfaIyaltm32bD45iZJYis3u1y/ib/H+Hx/GlmFvZ9W5+3lcZKVfL44+VSXr4iVNQvsikk1/E0HV37zopYWtksqUcW3Sw8+NqTVN6lqukrN793OafKsBJcnnqjSgk1WjD15Svt/JrYvcu07I4MeS23f6upwbxc5Y7kjk3TqQfqt7mle57HLsDF1bxp8ZN7IxSvd3PEZI8Ks7pTwtac4yhJuE47YbNze5/ke3y3GcRjaE27aakZX90kUv8z0viY+eePX3dLVbUpz9Zb97sZnFxnxLbVTni07m5qynBV61KWNp1VVmlJ6U9MdXSrrbZP+JmNfLYYqhjp46nKc4Qbp6U2npV927arbVzmj6D6t+2N1/wBq+VcNcFRw2axnRgoKtDVKK3artM4VClVqSo4fDr9diJaVZ2vd2Sv7z1P9IDp1M2pui04aXayPN4KvDC5lgq9RtQo1Iyk0r7FK5b7PmvnTx58vGf8Aum8+COeJ2eHp3/xFP6jTzDJcwymnTqYylGEKjai1UjK7XubOpVyuriqtbERw+EqxxGJ4+FSeI0y0Nt6Wr7L395DPafJ8kwtBxpU5cpqT4ulU1KCe5XMplXkYc/JcpLZ3+3/l56StJroZJ4SeLp42aruMcK7QpRTbdudpc1k9vS0Zqq1Wa/EyhY6thqmJhS0LjZS9ZwTlG72tPetl1+ZpnLZ07NZWXx9tfF0OT1IRU3LVTjPb2q5nCTlxmhttNP8AIxXrSxE4ykktMIw2disTwcf9oX7sv4MYy/dpMb49tksrf29T95/xIFlb+3qfvP8Aia6ZPW/0a5dg8bnleWNoUq8KdBtQqwUo3uttn/3tO5Rw9bOsZWxGV5ZlNLCUarjCnPC071Eu1rn/ACPOcCMdPBzzPi4KU+Rzmnzpq3meh/o9zDCzqTy+UFKs56rTbs49K7U0c/LbPTp4ccb7drG5bk2ccB8diKGTYTDYuFOUJqGHjGdKpF7ea/afHKEFUrRg77XzH1irjMXCXDNVYxjTjFygnFNLmTt7rPuPlGHbjXi07NMvhdxlnJMul1SjxW5P3MjSxFSilUhpve1rFlebtd7bFdKzpadM3d2WlJgbDzfETSi4w39B28sowedYOFaClCVaMZKW53Zzq/BTPsNQliqmS5hTpQWqU54aUVGPS+g6zTo4qlWW+E4y7ncrk0w3X0Gi+KoOjNudNbFBpJLbzWW8sU1xFSlCPqzbavFNxb6G0bjwkZybS2MxLDOOzoEne1b31Y8RnVCFDHKlBP1acdTe+T33ZtZZS4yjLsa/gVZ36+b4n8MtPcrHSyGjqw83bnX8DPPLdtro48JjjMYhVweqDVt6I0strYajGrOnZS3XO3yfsOnh6NPFYVUK0k78ye0xvLqL3jl7eTr0eOUdm4sw+XqLTsb+KwqoZvyeK/VtJpdGw6NDCx6LFscprpnZuuVLCJQTttI8mVtx1qtLmtuKZU0kT5rTB5TNsPv2FvBipWePo4aVSTo6vsX2G5mlHU9iJ5FhOKxEa25xdx5TXa3jXrMwwsIzhFJX03KKWHXQbU58oqa73TWwlTgc3JlvKr4TWOlUcMugsWGXQbMYbCxRMkVpcmXQRnhVKLVjf0hxCHkMbhFTxMtmx7TOGo7TqZtQs1O3YauEirNl5enRO4thRVjw39IEtNelTUt0dqPoUUj5xw/m3mWhJaVFO9zTD2y5JqPEyRRJF8yiR1Rx1TLcUzL5LYUyLxSqmiLJsgy0URItErGCREIyNzJg6GW4VVK0W+k93gs0w+V4WytqsfPsNi5UNxOvj6tZWcnYrlh5XtMy03c9zGGPxzqpbXvOaV79pZF32HTx6xmmWV32lYzYIyaqsWFiQCEbCxkAYAYIEouxdCq0UIkmENtVtm8xKrc11IORbRtKUrlbMswShgwZFhpLAJWFhobOGw3GRuVV6XFzsX4PEKnsZbUdOrUUnYpbZU6ljVw2GnWqJKL2n1bgDkFCkljMVaMKe3aeIy50YNSsth2MXworUMDxFKWmNtqRllbl1Gkknb3HCnhxh6GHlhcJJbrNo+aYnN54qq5SlsOHicfUxNVylJ7SqNVrnN+LjmEY5521pgzYGS7FjIASCwAGAGAgAAAwZMAAAAMmABkABLB3eCeCp4jNXi8Rsw2Bg69Vvds3Lv8A4HGpUp1p6YK7PS46nLIOCFHBu0cVmcuMq2e1U1uX8PmVyv2TP1cDMMbUzLMq+MqfarTcrdC5l3G/l9FRSdt/OczD03UqJJHew0bJK24ekzutuCLYkIosiVaRNFkSESaISsRbEqRbEhKyJOO8hEnEhaLk9hNFaZJMq0WxLEVR3E0ylWi6LJplKkSUiErkTRVFlkWVqViMkUSRCUiS3GESRVMCMiTIyISplvK2WyKmXilQZEkyJKG/gdlM3VY0sF/ZP3m5HcY5e2+HpNGti98TZW41sX+z7yMfacvTZwrvTRtQNPCP1LG7Arl7MfS2CJTjeDRiBNq6Zms4OZxvR2c0txw8XQdelaLtJbj01eGrVF7uc5lTAuMrwkrdp1cPLlxZzPD3HLzcWPLjcMvVedhl9WOJhWdGMpQknvte3MeihnVTD0nHDYCFGT231bL9O7aSpU+S1I1qtKnWgt8JXs9nYUSwdWUVJSjZq63np8n4ry8neWM/3/8A152H4ZxYdY2/+/6NWmnvk7t7W+lnqMmz7Lo5YsszehxlKDeiThrVm77VvvtPPxwVXrQ72TWCqSdlKN/zPOvLlc7nvt3zjxmEw109RQq8C6FVVadGOpbVqozdvyaNrMeFuCWDnSwGupVlFxi9DjGPbtPNwyvFxw0qPJ6TlKSaq6ndLoRW8qxdN2k6afRd+ROfyOTP+a7RjwYY+oohOVKUZwdpQaafajtY7OeD+cYONLNYTpzXRBtxfPZq+z3nLlgqsYtylCy7WcyvThUeyav7mU4s8sMt4r8vHjyY6ybeFyngRh8Uq88Xia6TuqdSnLT+do7Tez7hBh8yo0sHgoOOHpyUnJx03aVkkujacKvSVZ0+LhSpaIKL06vXa/ad+dkqOEqX+1DvZvy82fJ/NWPFwcfH/LHY4P5q8px6ruDnTlHROK327O3YOFOQ5Bwox8cwjnWLwlZR0unKjKpTt2LmfuZRRwVV22x7zew2CqU6sJyhTqRi7uEm7M5fOya+zrxx1lM51YxwVybIOC2JnjI5rjMZXlHTo4twp+/Tub7WyzNcc8yxk8S46U0lGPQkYeX1nJtaEm9yb2GXluIasnDvKXO2eP2XstzueV3aZTwlw2V0pYTHRkqSk5QnGOq196aOpHhfkE92J/8A4J+R47N8vq0X+tlBbL7G2aWDUFh61LRSnKenTUlqvCz5vedGGV8XNnhLk9xjuGWW0MPKWC1Vq9vU/VuKT6Xex8+frX1bW95uvCTa+1H5lSwk27KUfmW3tHjJ6eNxOS5hh3Wo4WUZUKzV1dJ2TukzXhwfzOpK0acLv8SPZ1cO4u2uN/zNnDYWrjp0qWHpUKcqUbSlqa17d7I86j6WPtwMjyCvltWWJxUouo46YxjtsdfG1nh4wmlu3o62Jy2rQWmtOCklfY2/9CnE5JUxGXcplWpxppX57lLbbttx5fSsyx9xpUswdaGtKLXO5RKaud0KDtKpCMl0U35F+U4SE4KdOdOrBTV4zTSlt3HE4QYLk+MqSlVpQ1NyUIqVopvcr++xphlu6r0s/wAX+RMdzGf2/wDLnZvjf0hiVUSahFaY33vtOTXitm2xt1Iy2WlH5+RRVoVG0nKPezo69PB5eXPlzvJl7rU0x55xX5PyJRhTTu5proind/IlGrTw8K0KlOnUlOOmMpXvB33oojVp9ddzI0z2tm3OTk97d2a9TD6puSkld3aZa5w38ZH5mNdP7xdzJMcrFSwjf/mQXf5FtKiqF3rUpNWVr2XeXTxNCeHo0owpwlT1aqi1Xnd8/uK9cOuu5lk3kt6ZJ1v7ep+8/wCJVrh94u5mdcN7qLuYUdng7mVPK6+LqzjqdXCypRj0tuP8z039H1LAUswr5hjMbQw2iKjTjUrRjdvfv93zPAxlFyUVNXfYy1RvDUpxt+Znnh5NMc/F9m4W5rksuDGZzoY7AzxNehxb4qrFzqdGxO7PikJOnNSSTa5mScPxx+fkVpxe3Wu5jHHxiMsvK7bMZcfsmt/QdTIqWHp5xgqlZtU6WIp1JPoSkmceFanTtea29jOrl6c3xkXdLfsZOkSvr1fF4jEYieKxWdZfRw0KE41Y4aqpSxd09Ktzc25XPntRJtDDYuhVwyqwmpR9z2EK1R3Tjp7N5XkzueXc024uPDDH/Dfb6Rlme5c8BRdarKNRU0prS3tS2l88+yezaruTXNoZ4DBY+oqeh0oyXTf+R0aeGq1kpRjHb2mFys9tfpy+lOK/XV6lZrbOTl3s9Dwao2y6tUe31naPTZI5kcrryg5TlGNubeXZHjK+CxfJ5RTjOW2/T0mdssa+OUekhTU4KSWxq5x41J0eFMY3tHVu/wCU9DTScdhxcywsIZnDGcck04tQ6bHPhl3Y3yx6b+LpcbVVZfaikRw7qyqNN+rYspYmNeMUlZtWfvNijS0pk7uMU8ZardLYaeKeg6ko7DlY7bUsRLtbTnYhKSuzdyyEXC8dzKa1OPFq62W5jZypKOqmnfTb+F/9S99DqUIKnTjFbkbECqJbDeZIq+JMriyxMaZ0DMXMkaHPzOGqhL3XOXhvsv3nbxcdVNrpVji0Vp1J8zJjbH02YyPmXDrZm1R3fMfSdR824eS/9oq0k9XysbcftTl/leRnuKZK5bNlbfYdMcVU1FZGvI2qu41pF4pVb3ECbIMtFKwYZIwShEwSsYJSLoMowSLRFZRJbGRRJbUWlVWpkiuL5iaNsbuKaSMGQWQwLEkjOknSNq7GLFuhvciPFyvZJkCJktjhasv2WT5FUSu0yNxOqoBKUHB2ZEsqGDIJGDIBIspw1GKkNLM0pNMVdpH3SrMqTXOYBI6OBxKjJamTzCvCp9nYjlptbjLk3vZXx7T5daLmdRExcnar/9k=",
//     "timestamp": 1773230455460,
//     "app": "uTools",
//     "time": "20:00:55",
//     "screenshotId": "screenshot/1773230455523"
// }
      console.log('roundedTime docId: dbScreenshots', dbScreenshots)
      
      //按照时间戳排序
      dbScreenshots.sort((a, b) => a.timestamp - b.timestamp);
      

      this.screenshots = dbScreenshots;
      console.log('roundedTime docId: recentScreenshots', dbScreenshots);
      
      //  fallback to local screenshots
      return this.screenshots;
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
} 
