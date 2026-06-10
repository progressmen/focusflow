import dayjs from 'dayjs'
import { getRoundedTime, getDayRoundedTimes } from '../utils/time.js'
import AIService from './AIService.js'
import settingsService from './Settings.js'

/**
 * 活动追踪服务
 * 依赖 preload.js 暴露的 window.* API：
 *   getCurrentAppName, captureScreen, saveScreenshotToDb,
 *   getScreenshotFromDb, getTimelineSlot, saveTimelineSlot,
 *   getMonthDates, markDateHasData, getSettingsFromDb, saveSettingsToDb
 */
export class ActivityTracker {
  constructor() {
    this.isTracking = false
    this.currentApp = null
    this.startTime = null
    this.currentSession = null
    this.checkInterval = null
    this.screenshotInterval = null
    // 当前生效的截图间隔（毫秒）
    this.screenshotIntervalMs = 30000
    this.aiService = new AIService()
    // 正在 AI 分析中的 slot id 集合（roundedSec 数字）
    this._analyzingSlots = new Set()
    // 分析状态变更订阅者：(payload: { id, analyzing, success?, result?, error? }) => void
    this._stateListeners = new Set()
    // 「上一时段巡检」定时器（每分钟检查一次，独立于截图节奏）
    this._slotSweepTimer = null
  }

  /**
   * 订阅 AI 分析状态变更
   * 回调 payload:
   *   { id: number, analyzing: true }                 -- 开始分析
   *   { id: number, analyzing: false, success: true, result }  -- 分析完成
   *   { id: number, analyzing: false, success: false, error }  -- 分析失败
   * @returns 取消订阅函数
   */
  onAnalysisStateChange(listener) {
    if (typeof listener !== 'function') return () => {}
    this._stateListeners.add(listener)
    return () => this._stateListeners.delete(listener)
  }

  _emitState(payload) {
    this._stateListeners.forEach((fn) => {
      try {
        fn(payload)
      } catch (e) {
        console.error('[FocusFlow] analysis listener 抛错:', e)
      }
    })
  }

  /**
   * 外部查询某个 slot 是否正在分析（供 UI 初始渲染同步状态用）
   */
  isAnalyzingSlot(roundedSec) {
    return this._analyzingSlots.has(Number(roundedSec))
  }

  /**
   * 外部查询所有正在分析的 slot id
   */
  listAnalyzingSlots() {
    return Array.from(this._analyzingSlots)
  }

  // ========== 开关追踪 ==========

  /**
   * 从设置中读取截图间隔（秒），并返回毫秒
   * 最小 5 秒、最大 600 秒，回退到 30 秒
   */
  resolveScreenshotIntervalMs() {
    try {
      const tracking = settingsService.loadTrackingSettings()
      let sec = Number(tracking.screenshotInterval) || 30
      if (sec < 5) sec = 5
      if (sec > 600) sec = 600
      return sec * 1000
    } catch (e) {
      return 30000
    }
  }

  async startTracking() {
    if (this.isTracking) return
    this.isTracking = true
    this.currentApp = await this.detectCurrentApp()
    this.startTime = Date.now()
    this.currentSession = this.newSession(this.currentApp, this.startTime)

    // 每 3 秒检查一次应用切换
    this.checkInterval = setInterval(() => this.tick(), 3000)
    // 按设置启动截图定时器
    this.screenshotIntervalMs = this.resolveScreenshotIntervalMs()
    this.screenshotInterval = setInterval(() => this.takeAndSaveScreenshot(), this.screenshotIntervalMs)
    console.log('[FocusFlow] 截图间隔:', this.screenshotIntervalMs / 1000, '秒')

    // 立即先截一张，保证有数据
    this.takeAndSaveScreenshot()

    // 启动「上一时段巡检」定时器：每分钟扫一次，确保即使没有新截图也能在跨入新时段后触发上段分析
    this._startSlotSweepTimer()
    // 立即跑一次（覆盖刚启动追踪时已经跨过整 10 分钟边界的场景）
    setTimeout(() => this._sweepPreviousSlot(), 500)

    // 保存状态到设置
    this.persistTrackingState()
    console.log('[FocusFlow] 开始追踪:', this.currentApp)
  }

  /**
   * 启动「上一时段巡检」定时器（每 60 秒一次）
   * 每 10 分钟跨段边界后，最坏 60 秒内会触发上一时段的 AI 分析
   */
  _startSlotSweepTimer() {
    if (this._slotSweepTimer) {
      clearInterval(this._slotSweepTimer)
    }
    this._slotSweepTimer = setInterval(() => this._sweepPreviousSlot(), 60 * 1000)
  }

  _stopSlotSweepTimer() {
    if (this._slotSweepTimer) {
      clearInterval(this._slotSweepTimer)
      this._slotSweepTimer = null
    }
  }

  /**
   * 扫一次：若上一时段已结束且未分析过 → 异步触发 AI 分析
   * （内部直接调 analyzePreviousSlotIfNeeded，并发由 analyzeSlot 的锁兜底）
   */
  _sweepPreviousSlot() {
    this.analyzePreviousSlotIfNeeded(Date.now()).catch((e) =>
      console.warn('[FocusFlow] _sweepPreviousSlot 异步分析失败：', e && e.message)
    )
  }

  /**
   * 重启截图定时器：在设置中的截图间隔变化后调用
   * 如果当前未在追踪，则什么都不做
   * 返回新的截图间隔（秒）
   */
  restartScreenshotTimer() {
    if (!this.isTracking) return 0
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval)
      this.screenshotInterval = null
    }
    this.screenshotIntervalMs = this.resolveScreenshotIntervalMs()
    this.screenshotInterval = setInterval(() => this.takeAndSaveScreenshot(), this.screenshotIntervalMs)
    console.log('[FocusFlow] 截图间隔已更新:', this.screenshotIntervalMs / 1000, '秒')
    return this.screenshotIntervalMs / 1000
  }

  async stopTracking() {
    if (!this.isTracking) return
    this.isTracking = false

    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval)
      this.screenshotInterval = null
    }
    // 关掉「上一时段巡检」定时器
    this._stopSlotSweepTimer()

    // 结束当前 session
    if (this.currentSession) {
      this.currentSession.end = Date.now()
      this.currentSession.duration = this.currentSession.end - this.currentSession.start
      this.persistSession(this.currentSession)
      this.currentSession = null
    }

    this.persistTrackingState()
    console.log('[FocusFlow] 停止追踪')
  }

  // ========== 轮询逻辑 ==========

  async tick() {
    try {
      const nextApp = await this.detectCurrentApp()
      if (nextApp !== this.currentApp) {
        // 应用切换：结束旧 session，开始新 session
        const now = Date.now()
        if (this.currentSession) {
          this.currentSession.end = now
          this.currentSession.duration = now - this.currentSession.start
          this.persistSession(this.currentSession)
        }
        this.currentApp = nextApp
        this.currentSession = this.newSession(nextApp, now)
        console.log('[FocusFlow] 切换应用:', nextApp)
      }
    } catch (e) {
      console.error('[FocusFlow] tick 异常:', e)
    }
  }

  async takeAndSaveScreenshot() {
    try {
      if (typeof window.captureScreen !== 'function') return
      const imageData = await window.captureScreen()
      if (!imageData) return

      const now = Date.now()
      const screenshotData = {
        imageData,
        app: this.currentApp || '未知应用',
        time: dayjs(now).format('YYYY-MM-DD HH:mm:ss'),
        timestamp: now
      }

      if (typeof window.saveScreenshotToDb === 'function') {
        const id = await window.saveScreenshotToDb(screenshotData)
        if (id) console.log('[FocusFlow] 截图已保存:', id)
      }

      // 尝试分析「上一个已完成的时间槽」（当前槽还在累积，不分析）
      this.analyzePreviousSlotIfNeeded(now).catch((e) =>
        console.warn('[FocusFlow] 异步分析上一时段失败：', e && e.message)
      )
    } catch (e) {
      console.error('[FocusFlow] 截图失败:', e)
    }
  }

  /**
   * 上一个时间槽（10 分钟前的整 10 分钟段）若已结束且未分析过，则触发 AI 分析
   */
  async analyzePreviousSlotIfNeeded(nowMs = Date.now()) {
    try {
      const TEN_MIN_MS = 10 * 60 * 1000
      // 当前所在时段的起始秒
      const currentSlotSec = Math.floor(nowMs / TEN_MIN_MS) * 600
      // 上一个时段的起始秒
      const prevSlotSec = currentSlotSec - 600
      // 该上一时段必须已结束（即 nowMs >= prevSlotSec*1000 + 10min）
      if (nowMs < prevSlotSec * 1000 + TEN_MIN_MS) return

      const slot = window.getTimelineSlot ? window.getTimelineSlot(prevSlotSec) : null
      if (!slot || !Array.isArray(slot.screenshots) || slot.screenshots.length === 0) return
      // 已分析过则跳过
      if (slot.title && slot.summary && Array.isArray(slot.categories) && slot.categories.length > 0) return

      try {
        await this.analyzeSlot(prevSlotSec)
      } catch (e) {
        // 自动触发的 AI 分析失败不打扰用户，只在控制台留痕
        console.warn('[FocusFlow] 自动 AI 分析跳过：', e && e.message)
      }
    } catch (e) {
      console.error('[FocusFlow] analyzePreviousSlotIfNeeded 失败:', e)
    }
  }

  /**
   * 显式分析某个时间槽（可在 UI 中手动触发）
   * 失败时抛出带原因的 Error，便于 UI 展示
   */
  async analyzeSlot(roundedSec) {
    const id = Number(roundedSec)
    // 并发互斥：同一时段不重入（自动触发 + 用户手动点击 可能并发）
    if (this._analyzingSlots.has(id)) {
      console.log('[FocusFlow] analyzeSlot 跳过：已有分析在进行', id)
      return null
    }
    this._analyzingSlots.add(id)
    this._emitState({ id, analyzing: true })

    try {
      const settings = settingsService.loadSettings()
      const model = settings.aiModel || ''
      const apiKey = (settings.apiKeys && settings.apiKeys[model]) || ''
      if (!model) {
        throw new Error('未选择 AI 模型，请前往「设置 → AI 设置」选择模型')
      }
      if (!apiKey) {
        throw new Error(`未配置 ${model} 的 API Key，请前往「设置 → AI 设置」填写`)
      }

      const slot = window.getTimelineSlot ? window.getTimelineSlot(roundedSec) : null
      if (!slot) {
        throw new Error(`找不到时间槽 timeslot/${roundedSec}`)
      }
      if (!Array.isArray(slot.screenshots) || slot.screenshots.length === 0) {
        throw new Error('当前时间槽没有截图')
      }

      // 加载截图原图（任何一张失败都继续，但全部失败则报错）
      console.log('[FocusFlow] analyzeSlot：开始加载', slot.screenshots.length, '张截图')
      const screenshots = []
      const failedDocs = []
      for (const s of slot.screenshots) {
        try {
          const img = window.getScreenshotFromDb ? await window.getScreenshotFromDb(s.docId) : null
          if (img) {
            screenshots.push({ imageData: img, app: s.app, time: s.time })
          } else {
            failedDocs.push(s.docId)
          }
        } catch (e) {
          failedDocs.push(s.docId)
          console.warn('[FocusFlow] 加载截图失败:', s.docId, e)
        }
      }
      if (screenshots.length === 0) {
        throw new Error(
          `所有截图加载失败（共 ${slot.screenshots.length} 张），可能是附件丢失。请尝试清空当日数据后重新追踪。`
        )
      }
      if (failedDocs.length > 0) {
        console.warn('[FocusFlow] 部分截图加载失败：', failedDocs)
      }

      const timeLabel = slot.time || formatTimeslot(roundedSec)
      const categories = Array.isArray(settings.categories) ? settings.categories : []
      if (categories.length === 0) {
        console.warn('[FocusFlow] 未配置任何分类，AI 可能无法准确归类')
      }
      console.log('[FocusFlow] analyzeSlot：调用 AI', {
        model,
        roundedSec,
        images: screenshots.length,
        categories: categories.map((c) => c.name),
        timeLabel
      })

      let result
      try {
        const modelName = (settings.aiModelNames && settings.aiModelNames[model]) || ''
        result = await this.aiService.analyzeTimeslot({
          model,
          modelName,
          apiKey,
          categories,
          defaultCategory: settings.defaultCategory || '',
          screenshots,
          timeLabel
        })
      } catch (e) {
        console.error('[FocusFlow] aiService.analyzeTimeslot 抛出异常:', e)
        throw new Error(`AI 调用失败：${(e && e.message) || e}`)
      }

      if (!result || (!result.title && !result.summary && (!result.categories || result.categories.length === 0))) {
        console.error('[FocusFlow] AI 返回空结果或无法解析:', result)
        throw new Error('AI 返回结果为空或无法解析，请检查模型是否支持图片、或控制台日志')
      }

      // 写回 timeslot 文档
      try {
        if (typeof window.saveTimelineSlot === 'function') {
          const saved = window.saveTimelineSlot(roundedSec, {
            title: result.title,
            summary: result.summary,
            detail: result.detail,
            categories: result.categories,
            time: timeLabel
          })
          if (!saved) {
            console.warn('[FocusFlow] 写回 timeslot 失败')
          }
        }
      } catch (e) {
        console.error('[FocusFlow] 写回 timeslot 异常:', e)
        // 不阻断主流程，仅记录
      }

      console.log('[FocusFlow] AI 分析完成:', result)
      this._emitState({ id, analyzing: false, success: true, result })
      return result
    } catch (e) {
      this._emitState({ id, analyzing: false, success: false, error: e })
      throw e
    } finally {
      this._analyzingSlots.delete(id)
    }
  }

  // ========== 读取与汇总 ==========

  /**
   * 获取指定日期所有时间槽数据（含截图 docId 列表）
   * 优先用 preload 暴露的 listTimelineSlotsByDate（基于 utools.db.allDocs，最准确）
   * 回退到按时间循环 + 单条 get（兼容旧实现）
   */
  async loadTimelineForDate(dateStr) {
    try {
      let rawSlots = []
      if (typeof window.listTimelineSlotsByDate === 'function') {
        rawSlots = window.listTimelineSlotsByDate(dateStr) || []
      } else {
        const roundedTimes = getDayRoundedTimes(dateStr)
        for (const rt of roundedTimes) {
          const slot = window.getTimelineSlot ? window.getTimelineSlot(rt) : null
          if (slot) rawSlots.push(slot)
        }
      }
      const slots = []
      for (const slot of rawSlots) {
        if (!slot || !Array.isArray(slot.screenshots) || slot.screenshots.length === 0) continue
        const id = slot._id
          ? Number(String(slot._id).replace('timeslot/', ''))
          : null
        slots.push({
          id: id,
          time: slot.time || (id ? formatTimeslot(id) : ''),
          title: slot.title || '',
          categories: slot.categories || [],
          summary: slot.summary || '',
          detail: slot.detail || '',
          screenshots: slot.screenshots || []
        })
      }
      console.log('[FocusFlow] loadTimelineForDate', dateStr, '→', slots.length, '个有效时间槽')
      return slots
    } catch (e) {
      console.error('[FocusFlow] loadTimelineForDate 失败:', e)
      return []
    }
  }

  /**
   * 批量读取某个日期所有截图的 imageData（用于播放器）
   */
  async loadScreenshotsForSlot(roundedSeconds) {
    try {
      const slot = window.getTimelineSlot ? window.getTimelineSlot(roundedSeconds) : null
      if (!slot || !slot.screenshots || slot.screenshots.length === 0) return []
      const results = await Promise.all(
        slot.screenshots.map(async (s) => {
          const img = window.getScreenshotFromDb ? await window.getScreenshotFromDb(s.docId) : null
          return {
            docId: s.docId,
            app: s.app,
            time: s.time,
            timestamp: s.timestamp,
            imageData: img
          }
        })
      )
      return results
    } catch (e) {
      console.error('[FocusFlow] loadScreenshotsForSlot 失败:', e)
      return []
    }
  }

  /**
   * 今日统计：基于 timeslot 中聚合的数据 + session 时长
   */
  async getTodayStats() {
    try {
      const today = dayjs().format('YYYY-MM-DD')
      const slots = await this.loadTimelineForDate(today)
      // 统计活跃应用（从 screenshots 中提取）
      const appCount = new Map()
      let totalScreenshots = 0
      slots.forEach((s) => {
        s.screenshots.forEach((sc) => {
          appCount.set(sc.app, (appCount.get(sc.app) || 0) + 1)
          totalScreenshots++
        })
      })
      const totalSessions = slots.length
      const activeApps = appCount.size
      // 专注度：活跃应用数越少，专注度越高（至少 20，最高 100）
      const focusScore = Math.max(20, 100 - (activeApps - 1) * 10 - totalSessions * 0.5)
      return {
        date: today,
        totalScreenshots,
        activeApps,
        totalSessions,
        focusScore: Math.min(100, Math.floor(focusScore))
      }
    } catch (e) {
      console.error('[FocusFlow] getTodayStats 失败:', e)
      return { totalScreenshots: 0, activeApps: 0, totalSessions: 0, focusScore: 0 }
    }
  }

  /**
   * 今日分类排行（从截图 app 字段聚合，简单按应用分组）
   */
  async getTopApps(limit = 8) {
    try {
      const today = dayjs().format('YYYY-MM-DD')
      const slots = await this.loadTimelineForDate(today)
      const appCount = new Map()
      let total = 0
      slots.forEach((s) => {
        s.screenshots.forEach((sc) => {
          const app = sc.app || '未知应用'
          appCount.set(app, (appCount.get(app) || 0) + 1)
          total++
        })
      })
      const entries = Array.from(appCount.entries())
        .map(([name, count]) => ({
          name,
          count,
          percent: total > 0 ? Math.floor((count / total) * 100) : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
      return entries
    } catch (e) {
      console.error('[FocusFlow] getTopApps 失败:', e)
      return []
    }
  }

  /**
   * 图表数据：按应用统计截图数（条形/饼图通用）
   */
  async getChartData() {
    const apps = await this.getTopApps(8)
    return apps.map((a) => ({ label: a.name, value: a.count }))
  }

  async getMonthData(year, month) {
    try {
      if (typeof window.getMonthDates === 'function') {
        return window.getMonthDates(year, month)
      }
      return []
    } catch (e) {
      console.error('[FocusFlow] getMonthData 失败:', e)
      return []
    }
  }

  // ========== AI 日报告 ==========

  /**
   * 读取某一天已生成的日报告（不存在返回 null）
   */
  loadDailyReport(dateStr) {
    try {
      if (typeof window.getDailyReport !== 'function') return null
      return window.getDailyReport(dateStr) || null
    } catch (e) {
      console.error('[FocusFlow] loadDailyReport 失败:', e)
      return null
    }
  }

  /**
   * 生成某一天的 AI 日报告
   * - 若该日已存在报告且未传 force=true，则直接返回缓存
   * - 必须当天至少有 1 个时段（无所谓是否分析过；未分析的就以「未分类」名义带进 prompt）
   * @param {string} dateStr 'YYYY-MM-DD'
   * @param {Object} [opts]
   * @param {boolean} [opts.force=false] 强制重新生成
   * @param {Object}  [opts.stats]  顶部统计卡的数值（可选，写进报告 metadata）
   * @returns {Promise<{content, model, generatedAt, slotCount, stats, cached}>}
   */
  async generateDailyReport(dateStr, opts = {}) {
    if (!dateStr) throw new Error('缺少日期参数')

    // 1. 已有缓存且非强制重生 → 直接返回
    if (!opts.force) {
      const cached = this.loadDailyReport(dateStr)
      if (cached && cached.content) {
        console.log('[FocusFlow] 使用缓存日报告:', dateStr)
        return { ...cached, cached: true }
      }
    }

    // 2. AI 配置校验
    const settings = settingsService.loadSettings()
    const model = settings.aiModel || ''
    const apiKey = (settings.apiKeys && settings.apiKeys[model]) || ''
    if (!model) throw new Error('未选择 AI 模型，请前往「设置 → AI 设置」选择模型')
    if (!apiKey) throw new Error(`未配置 ${model} 的 API Key，请前往「设置 → AI 设置」填写`)

    // 3. 收集当天所有时段
    const allSlots = await this.loadTimelineForDate(dateStr)
    if (!allSlots || allSlots.length === 0) {
      throw new Error(`${dateStr} 当天没有任何时段数据，无法生成报告`)
    }

    // 4. 只把「有意义」的字段交给 AI（标题/摘要/分类/时间）
    const slimSlots = allSlots.map((s) => ({
      time: s.time || '',
      title: s.title || '',
      summary: s.summary || '',
      categories: Array.isArray(s.categories) ? s.categories : []
    }))

    const modelName = (settings.aiModelNames && settings.aiModelNames[model]) || ''
    const categories = Array.isArray(settings.categories) ? settings.categories : []

    console.log('[FocusFlow] generateDailyReport：', {
      dateStr,
      model,
      modelName,
      slotCount: slimSlots.length,
      force: !!opts.force
    })

    let result
    try {
      result = await this.aiService.generateDailyReport({
        model,
        modelName,
        apiKey,
        dateStr,
        slots: slimSlots,
        stats: opts.stats || null,
        categories
      })
    } catch (e) {
      console.error('[FocusFlow] aiService.generateDailyReport 抛出异常:', e)
      throw new Error(`AI 调用失败：${(e && e.message) || e}`)
    }

    const payload = {
      content: result.content,
      model: result.model || model,
      generatedAt: Date.now(),
      slotCount: slimSlots.length,
      stats: opts.stats || null
    }

    // 5. 写回 db
    try {
      if (typeof window.saveDailyReport === 'function') {
        const ok = window.saveDailyReport(dateStr, payload)
        if (!ok) console.warn('[FocusFlow] saveDailyReport 返回 false')
      }
    } catch (e) {
      console.error('[FocusFlow] saveDailyReport 异常:', e)
    }

    return { ...payload, cached: false }
  }

  /**
   * 删除某一天的日报告（用于「清空数据」时同步清理）
   */
  removeDailyReport(dateStr) {
    try {
      if (typeof window.removeDailyReport === 'function') {
        return window.removeDailyReport(dateStr)
      }
    } catch (e) {
      console.error('[FocusFlow] removeDailyReport 失败:', e)
    }
    return false
  }

  // ========== 存储辅助 ==========

  detectCurrentApp() {
    try {
      if (typeof window.getCurrentAppName === 'function') {
        return window.getCurrentAppName()
      }
      return '未知应用'
    } catch (e) {
      return '未知应用'
    }
  }

  newSession(app, start) {
    return {
      app,
      start,
      end: null,
      duration: 0,
      date: dayjs(start).format('YYYY-MM-DD')
    }
  }

  persistSession(session) {
    // session 数据直接存在 localStorage 中，用于显示使用时长汇总（可选）
    try {
      const key = 'focusflow-sessions'
      const raw = localStorage.getItem(key)
      const list = raw ? JSON.parse(raw) : []
      list.push(session)
      // 只保留最近 1000 条，避免膨胀
      if (list.length > 1000) list.splice(0, list.length - 1000)
      localStorage.setItem(key, JSON.stringify(list))
    } catch (e) {
      console.error('[FocusFlow] persistSession 失败:', e)
    }
  }

  persistTrackingState() {
    if (typeof window.saveSettingsToDb === 'function') {
      window.saveSettingsToDb({
        _id: 'settings/focusflow',
        isTracking: this.isTracking
      })
    }
  }

  /**
   * 更新时间槽的 AI 汇总信息（标题、分类、摘要、详情）
   */
  updateTimelineSlot(roundedSeconds, patch) {
    try {
      if (typeof window.saveTimelineSlot !== 'function') return false
      return window.saveTimelineSlot(roundedSeconds, patch)
    } catch (e) {
      console.error('[FocusFlow] updateTimelineSlot 失败:', e)
      return false
    }
  }
}

function formatTimeslot(roundedSeconds) {
  const d = new Date(roundedSeconds * 1000)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const end = new Date(roundedSeconds * 1000 + 10 * 60 * 1000)
  const eh = String(end.getHours()).padStart(2, '0')
  const em = String(end.getMinutes()).padStart(2, '0')
  return `${hh}:${mm} - ${eh}:${em}`
}

export default ActivityTracker
