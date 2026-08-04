<template>
  <div class="app">
    <header class="app-header">
      <div class="header-left">
        <h1>FocusFlow 活动追踪</h1>
        <div class="status-bar">
          <span :class="['status-dot', { active: isTracking }]"></span>
          <span class="status-text">{{ isTracking ? '正在追踪' : '已停止' }}</span>
          <span class="status-sep">·</span>
          <span class="status-text status-refresh">{{ lastRefreshLabel }}</span>
          <button v-if="loading" class="refresh-spinner" disabled>⟳</button>
          <button v-else class="btn-link" @click="refreshAll" title="立即刷新">↻ 刷新</button>
        </div>
      </div>
      <div class="header-actions">
        <div class="date-picker-container">
          <button class="btn btn-secondary" @click="toggleDatePicker">
            {{ formatSelectedDate(selectedDate) }}
          </button>
          <div v-if="showDatePicker" class="date-picker-dropdown">
            <div class="calendar-header">
              <button class="btn btn-secondary btn-sm" @click="changeMonth(-1)">← 上月</button>
              <h3>{{ currentYear }}年{{ currentMonth + 1 }}月</h3>
              <button class="btn btn-secondary btn-sm" @click="changeMonth(1)">下月 →</button>
            </div>
            <div class="calendar-grid">
              <div class="calendar-day header">日</div>
              <div class="calendar-day header">一</div>
              <div class="calendar-day header">二</div>
              <div class="calendar-day header">三</div>
              <div class="calendar-day header">四</div>
              <div class="calendar-day header">五</div>
              <div class="calendar-day header">六</div>
              <div v-for="empty in startEmptyCells" :key="'empty-' + empty" class="calendar-day empty"></div>
              <div
                v-for="day in daysInMonth"
                :key="day"
                :class="['calendar-day', {
                  'has-data': datesWithData.includes(day),
                  'today': isToday(day),
                  'disabled': isFutureDate(day),
                  'selected': isSelectedDate(day)
                }]"
                @click="selectDate(day)"
              >
                {{ day }}
              </div>
            </div>
            <p class="calendar-footer">点击日期查看当天活动</p>
          </div>
        </div>

        <button @click="toggleTracking" :class="['btn', isTracking ? 'btn-danger' : 'btn-success']">
          {{ isTracking ? '停止追踪' : '开始追踪' }}
        </button>
        <button class="btn btn-primary" :disabled="generatingReport" @click="openReport">
          {{ generatingReport ? '生成中…' : (aiReport ? '查看 AI 报告' : 'AI 生成报告') }}
        </button>
        <button class="btn btn-secondary" @click="openSettings">设置</button>
      </div>
    </header>

    <!-- 设置面板 -->
    <SettingsPanel v-if="showSettings" @close="showSettings = false" @settings-updated="onSettingsUpdated" />

    <!-- AI 总结报告弹窗（尺寸与设置弹窗一致） -->
    <div v-if="showReport" class="report-panel" @click.self="closeReport">
      <div class="report-container">
        <div class="report-panel-header">
          <div class="report-panel-title">
            <h2>AI 总结报告</h2>
            <p v-if="aiReportMeta.generatedAt" class="ai-report-meta">
              <span>📅 {{ formatSelectedDate(selectedDate) }}</span>
              <span>· 生成于 {{ formatReportTime(aiReportMeta.generatedAt) }}</span>
              <span v-if="aiReportMeta.model">· 模型 {{ aiReportMeta.model }}</span>
              <span v-if="aiReportMeta.slotCount">· 基于 {{ aiReportMeta.slotCount }} 个时段</span>
              <span v-if="aiReportMeta.cached" class="ai-report-cached">· 已缓存</span>
            </p>
          </div>
          <div class="report-panel-actions">
            <button
              class="btn btn-secondary btn-sm"
              :disabled="generatingReport"
              @click="generateReport(true)"
              title="忽略缓存，重新调用 AI 生成报告"
            >
              {{ generatingReport ? '生成中…' : '↻ 重新生成' }}
            </button>
            <button
              v-if="aiReport && !generatingReport"
              class="btn btn-secondary btn-sm"
              @click="copyReport"
            >复制报告</button>
            <button class="btn btn-secondary btn-sm" @click="closeReport">关闭</button>
          </div>
        </div>
        <div class="report-panel-body">
          <div v-if="generatingReport && !aiReport" class="report-loading">
            <div class="report-loading-spinner"></div>
            <p>正在调用 AI 生成今日报告，请稍候…</p>
          </div>
          <div v-else-if="reportError" class="ai-report-error">
            ✗ {{ reportError }}
          </div>
          <div
            v-else-if="aiReport"
            class="report-content markdown-body"
            v-html="aiReportHtml"
          ></div>
          <div v-else class="report-empty">
            <p>今日还没有生成 AI 报告</p>
            <button class="btn btn-primary" :disabled="generatingReport" @click="generateReport(false)">
              {{ generatingReport ? '生成中…' : '✨ 立即生成报告' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <main class="app-main">
      <div class="stats-grid">
        <div class="stat-card">
          <h3>截图数量</h3>
          <div class="stat-value">{{ todayStats.totalScreenshots }}</div>
        </div>
        <div class="stat-card">
          <h3>活跃分类</h3>
          <div class="stat-value">{{ todayStats.activeCategories }}</div>
        </div>
        <div class="stat-card">
          <h3>活跃时段</h3>
          <div class="stat-value">{{ todayStats.totalSessions }}</div>
        </div>
        <div class="stat-card">
          <h3>专注度</h3>
          <div class="stat-value">{{ todayStats.focusScore }}%</div>
        </div>
      </div>

      <div v-if="chartData.length > 0" class="charts-section">
        <h2>活动分类分布</h2>
        <div class="chart-container">
          <AppUsageChart :data="chartData" />
        </div>
      </div>

      <div v-if="topCategories.length > 0" class="apps-section">
        <h2>分类统计</h2>
        <div class="apps-list">
          <div v-for="cat in topCategories" :key="cat.name" class="app-item">
            <div class="app-info">
              <span class="cat-dot" :style="{ background: cat.color }"></span>
              <span class="app-name">{{ cat.name }}</span>
            </div>
            <div class="app-usage">
              <div class="usage-bar">
                <div
                  class="usage-fill"
                  :style="{ width: cat.percent + '%', background: cat.color }"
                ></div>
              </div>
              <span class="usage-time">{{ cat.count }} 个时段 · {{ cat.percent }}%</span>
            </div>
          </div>
        </div>
        <p v-if="unanalyzedSlots > 0" class="cat-tip">
          还有 {{ unanalyzedSlots }} 个时段未分类
          <button class="btn-link" @click="analyzeAllPending" :disabled="analyzing">
            {{ analyzing ? '分析中…' : '立即分析' }}
          </button>
        </p>
      </div>

      <div v-if="aiReport && !showReport" class="ai-report-hint" @click="openReport">
        <span class="report-hint-icon">📄</span>
        <span class="report-hint-text">
          今日已有 AI 总结报告
          <span v-if="aiReportMeta.generatedAt" class="report-hint-meta">
            （生成于 {{ formatReportTime(aiReportMeta.generatedAt) }}）
          </span>
        </span>
        <button class="btn-link">点击查看 →</button>
      </div>

      <!-- 时间轴 -->
      <div v-if="timelineData.length > 0" class="timeline-section">
        <h2>活动时间轴</h2>
        <div class="timeline">
          <div v-for="item in timelineData" :key="item.id" class="timeline-item" @click="openTimelineDetail(item)">
            <div class="timeline-marker" :style="{ background: timelineItemColor(item) }"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <h3 class="timeline-title">{{ item.title || '未命名时段' }}</h3>
                <span
                  v-for="cat in item.categories"
                  :key="cat"
                  class="cat-badge"
                  :style="{ background: getCategoryColor(cat) }"
                >{{ cat }}</span>
                <span v-if="!item.categories || !item.categories.length" class="cat-badge pending">未分类</span>
                <div class="timeline-actions">
                  <button
                    class="btn-mini"
                    :disabled="analyzingSlotIds.has(item.id)"
                    :title="(item.categories && item.categories.length) ? '重新 AI 分析此时段' : 'AI 分析此时段'"
                    @click.stop="reanalyzeSlot(item)"
                  >
                    {{ analyzingSlotIds.has(item.id)
                        ? '分析中…'
                        : (item.categories && item.categories.length ? '↻ 重新分析' : '✨ AI 分析') }}
                  </button>
                </div>
              </div>
              <p class="timeline-time">{{ item.time }}</p>
              <p v-if="item.summary" class="timeline-summary">{{ item.summary }}</p>
              <p class="timeline-meta">
                {{ item.screenshots.length > 0
                    ? `截图 ${item.screenshots.length} 张`
                    : '截图已清理（保留 AI 总结）' }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="timelineData.length === 0 && !loading" class="empty-state">
        <p>还没有活动数据，点击「开始追踪」开始记录你的活动。</p>
      </div>
    </main>

    <!-- 时间轴详情弹窗（截图轮播） -->
    <div v-if="showDetail" class="modal-overlay" @click="closeDetail">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ selectedItem?.title || '时间轴详情' }}</h3>
          <div class="modal-header-actions">
            <button
              v-if="selectedItem"
              class="btn btn-primary btn-sm"
              :disabled="analyzingSlotIds.has(selectedItem.id)"
              @click="reanalyzeSlot(selectedItem)"
            >
              {{ analyzingSlotIds.has(selectedItem.id)
                  ? '分析中…'
                  : (selectedItem.categories && selectedItem.categories.length ? '↻ 重新 AI 分析' : '✨ AI 分析此时段') }}
            </button>
            <button class="close-btn" @click="closeDetail">×</button>
          </div>
        </div>
        <div class="modal-body">
          <div v-if="selectedItem" class="ai-summary">
            <p><strong>时段：</strong>{{ selectedItem.time }}</p>
            <p v-if="selectedItem.summary"><strong>AI 摘要：</strong>{{ selectedItem.summary }}</p>
            <p v-if="selectedItem.detail"><strong>详细内容：</strong>{{ selectedItem.detail }}</p>
            <p v-if="selectedItem.categories && selectedItem.categories.length">
              <strong>分类：</strong>{{ formatCategories(selectedItem.categories) }}
            </p>
          </div>
          <div v-if="loadingScreenshots && slotScreenshots.length === 0" class="screenshot-loading">
            <span class="spinner spinner-lg"></span>
            <span>正在加载截图…</span>
          </div>
          <div v-if="slotScreenshots.length > 0" class="screenshot-video-section">
            <h4>截图回放（{{ slotScreenshots.length }} 张）</h4>
            <div class="video-controls">
              <button class="btn btn-primary" @click="togglePlay" :title="isPlaying ? '暂停 (空格)' : '播放 (空格)'">
                {{ isPlaying ? '⏸ 暂停' : '▶ 播放' }}
              </button>
              <input
                type="range"
                v-model.number="screenshotIndex"
                :min="0"
                :max="slotScreenshots.length - 1"
                class="progress-bar"
              />
              <span class="shot-counter">{{ screenshotIndex + 1 }} / {{ slotScreenshots.length }}</span>
              <select v-model.number="playSpeed" class="speed-select" :title="'播放速度'">
                <option :value="2000">0.5×</option>
                <option :value="1500">1×</option>
                <option :value="800">2×</option>
              </select>
            </div>
            <div class="video-preview" v-if="currentScreenshot">
              <div class="shot-stage">
                <button
                  class="nav-btn nav-prev"
                  :disabled="screenshotIndex === 0"
                  @click="prevShot"
                  title="上一张 (←)"
                >‹</button>
                <div class="shot-canvas" @click="openZoom" :title="'点击查看大图'">
                  <div v-if="imgLoading" class="shot-loading"><span class="spinner"></span>加载中…</div>
                  <img
                    v-if="currentScreenshot.imageData && !imgError"
                    :src="currentScreenshot.imageData"
                    class="video-img is-zoomable"
                    alt="screenshot"
                    @load="onImgLoad"
                    @error="onImgError"
                  />
                  <div v-if="imgError || (!currentScreenshot.imageData && !imgLoading)" class="video-img video-img-placeholder">
                    <span>⚠ 截图加载失败或为空</span>
                  </div>
                  <span class="zoom-hint" v-if="!imgError && currentScreenshot.imageData">🔍 点击放大</span>
                </div>
                <button
                  class="nav-btn nav-next"
                  :disabled="screenshotIndex === slotScreenshots.length - 1"
                  @click="nextShot"
                  title="下一张 (->)"
                >›</button>
              </div>
              <div class="video-info">
                <span class="app-name">{{ currentScreenshot.app }}</span>
                <span class="shot-time">{{ currentScreenshot.time }}</span>
              </div>
            </div>
            <div class="thumb-strip" v-if="slotScreenshots.length > 1">
              <div
                v-for="(sc, idx) in slotScreenshots"
                :key="sc.docId || idx"
                class="thumb-item"
                :class="{ active: idx === screenshotIndex }"
                @click="jumpTo(idx)"
                :title="sc.time"
              >
                <img v-if="sc.imageData" :src="sc.imageData" alt="thumb" />
                <div v-else class="thumb-empty">×</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 截图大图查看器 -->
    <div v-if="showZoom" class="zoom-overlay" @click="closeZoom">
      <div class="zoom-stage" @click.stop>
        <button class="zoom-close" @click="closeZoom" title="关闭 (Esc)">×</button>
        <button
          class="nav-btn nav-prev zoom-nav"
          :disabled="screenshotIndex === 0"
          @click="prevShot"
          title="上一张 (←)"
        >‹</button>
        <img
          v-if="currentScreenshot && currentScreenshot.imageData"
          :src="currentScreenshot.imageData"
          class="zoom-img"
          alt="screenshot"
          @click="closeZoom"
        />
        <div v-else class="zoom-empty">截图不可用</div>
        <button
          class="nav-btn nav-next zoom-nav"
          :disabled="screenshotIndex === slotScreenshots.length - 1"
          @click="nextShot"
          title="下一张 (->)"
        >›</button>
        <div class="zoom-info" v-if="currentScreenshot">
          <span>{{ currentScreenshot.app }}</span>
          <span>{{ screenshotIndex + 1 }} / {{ slotScreenshots.length }}</span>
          <span>{{ currentScreenshot.time }}</span>
        </div>
      </div>
    </div>

    <!-- 清空数据弹窗已迁移到「设置 -> 数据管理」 -->
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { ActivityTracker, trackerInstance } from './services/ActivityTracker'
import { AIService } from './services/AIService'
import settingsService from './services/Settings.js'
import AppUsageChart from './components/AppUsageChart.vue'
import SettingsPanel from './components/SettingsPanel.vue'

// 配置 marked：开启 GFM、自动换行（AI 输出常含单换行）
marked.setOptions({
  gfm: true,
  breaks: true
})

// 使用应用级单例 tracker，避免组件重挂载时丢失追踪状态
const activityTracker = trackerInstance
const aiService = new AIService()

// 在 window 上保留 tracker 引用，方便从 preload 中调用 tracker 方法
if (typeof window !== 'undefined') {
  window.__focusflowTracker = activityTracker
}

// 状态
const isTracking = ref(false)
const showSettings = ref(false)
const showReport = ref(false)
const loading = ref(false)
const todayStats = ref({ totalScreenshots: 0, activeApps: 0, activeCategories: 0, totalSessions: 0, focusScore: 0 })
const topApps = ref([])
const topCategories = ref([])
const unanalyzedSlots = ref(0)
const analyzing = ref(false)
// 正在分析的时间槽 ID 集合（用 shallowRef + 新 Set 触发响应式）
const analyzingSlotIds = ref(new Set())
const categoriesConfig = ref([]) // 用户配置的分类（含颜色）
const chartData = ref([])
const aiReport = ref('')
// AI 报告 Markdown 渲染（marked → DOMPurify 防 XSS）
const aiReportHtml = computed(() => {
  const text = aiReport.value
  if (!text) return ''
  try {
    const rawHtml = marked.parse(text)
    return DOMPurify.sanitize(rawHtml, {
      // 允许常见富文本标签 + checkbox（GFM 任务列表）
      ADD_ATTR: ['target', 'rel']
    })
  } catch (e) {
    console.error('[FocusFlow] 渲染 Markdown 失败:', e)
    return ''
  }
})
// 日报告附加信息（生成模型、时间）
const aiReportMeta = ref({ model: '', generatedAt: 0, slotCount: 0, cached: false })
const generatingReport = ref(false)
const reportError = ref('')
const timelineData = ref([])

// 日历
const currentDate = ref(new Date())
const selectedDate = ref(new Date())
const showDatePicker = ref(false)
const datesWithData = ref([])

const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth())
const daysInMonth = computed(() => new Date(currentYear.value, currentMonth.value + 1, 0).getDate())
const startEmptyCells = computed(() => new Date(currentYear.value, currentMonth.value, 1).getDay())

// 详情弹窗
const showDetail = ref(false)
const selectedItem = ref(null)
const slotScreenshots = ref([])
const screenshotIndex = ref(0)
const isPlaying = ref(false)
let playTimer = null
const playSpeed = ref(1500)
const showZoom = ref(false)
const imgLoading = ref(false)
const imgError = ref(false)
const loadingScreenshots = ref(false)

// 清空数据相关 state 已移至 SettingsPanel

// 自动刷新（追踪开启时启用）
let autoRefreshTimer = null
const AUTO_REFRESH_INTERVAL = 10000 // 每 10 秒刷一次
const lastRefreshAt = ref(0)
const nowTick = ref(Date.now())
let nowTickTimer = null
// Tracker AI 分析状态订阅的取消函数
let unsubscribeAnalysisState = null

// 「N 秒前」展示用
const lastRefreshLabel = computed(() => {
  if (!lastRefreshAt.value) return '未刷新'
  const diff = Math.max(0, Math.floor((nowTick.value - lastRefreshAt.value) / 1000))
  if (diff < 5) return '刚刚刷新'
  if (diff < 60) return `${diff} 秒前刷新`
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前刷新`
  return `${Math.floor(diff / 3600)} 小时前刷新`
})

// ========== 生命周期 ==========

onMounted(async () => {
  // 监听 uTools 插件进入
  window.addEventListener('utools:enter', onUtoolsEnter)
  // 监听 preload 层快捷命令导致的追踪状态变化
  window.addEventListener('focusflow:tracking-changed', onTrackingChanged)
  // 监听浏览器/插件页面重新可见
  document.addEventListener('visibilitychange', onVisibilityChange)
  // 截图查看器键盘快捷键
  window.addEventListener('keydown', onDetailKeydown)
  // 启动每秒滴答（仅用于更新「N 秒前」文案）
  nowTickTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)

  // 订阅 Tracker 的 AI 分析状态变化（用于自动同步时间轴 UI 上的「分析中」）
  unsubscribeAnalysisState = activityTracker.onAnalysisStateChange(onAnalysisStateChange)

  // 同步追踪器实际状态到 UI（处理从其他视图返回后状态不一致的情况）
  isTracking.value = !!activityTracker.isTracking
  if (isTracking.value) {
    startAutoRefresh()
  }

  await refreshAll()

  // 处理在 Vue 挂载前已经触发的 onPluginEnter（preload.js 会缓存到 window.__focusflowPendingEnter）
  // 否则用户用关键词进入插件时，事件可能已派发但还没有监听器
  try {
    const pending = (typeof window !== 'undefined' && window.__focusflowPendingEnter) || null
    if (pending) {
      window.__focusflowPendingEnter = null
      await handlePluginEnter(pending)
    }
  } catch (e) {
    console.error('[FocusFlow] 处理 pending enter 失败:', e)
  }

  // 自动开始追踪：根据「设置 → 追踪设置 → 自动开始追踪」决定
  try {
    const tracking = settingsService.loadTrackingSettings() || {}
    if (tracking.autoStart && !isTracking.value && !activityTracker.isTracking) {
      console.log('[FocusFlow] 检测到 autoStart=true，自动开始追踪')
      await toggleTracking()
    }
  } catch (e) {
    console.error('[FocusFlow] 自动开始追踪失败：', e)
  }

  // 根据「设置 → 显示桌面悬浮图标」启动悬浮窗
  syncFloatingIconBySettings()
})

onBeforeUnmount(() => {
  stopPlay()
  stopAutoRefresh()
  if (nowTickTimer) {
    clearInterval(nowTickTimer)
    nowTickTimer = null
  }
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('keydown', onDetailKeydown)
  window.removeEventListener('utools:enter', onUtoolsEnter)
  window.removeEventListener('focusflow:tracking-changed', onTrackingChanged)
  if (typeof unsubscribeAnalysisState === 'function') {
    unsubscribeAnalysisState()
    unsubscribeAnalysisState = null
  }
  // 注意：不要在组件卸载时停止 activityTracker
  // uTools 插件在隐藏 / 切换时可能会卸载视图，但用户期望追踪持续在后台
  // 真正的停止只应通过用户点击「停止追踪」或快捷命令「停止记录」触发
})

// 监听 utools:enter 事件
async function onUtoolsEnter(event) {
  const detail = (event && event.detail) || {}
  await handlePluginEnter(detail)
}

// 监听由 preload 层派发的追踪状态变化事件，同步 UI
function onTrackingChanged(event) {
  const tracking = !!(event && event.detail && event.detail.tracking)
  isTracking.value = tracking
  if (tracking) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
  // 同步到悬浮窗（preload 内部已经推过一次，这里再补一次保证 UI 一致）
  try {
    if (typeof window !== 'undefined' && typeof window.updateFloatingIconState === 'function') {
      window.updateFloatingIconState(tracking)
    }
  } catch (e) {}
  refreshAll()
}

// 统一的进入处理逻辑（来自事件 或 来自 pending 缓存）
// 注意：实际的「开始/停止记录」已由 preload.js 在 onPluginEnter 中直接执行
// 这里只负责 UI 状态同步与刷新
async function handlePluginEnter(detail) {
  const code = detail && detail.code
  const typedCmd = detail && detail.payload

  const cmd = String(typedCmd || '').replace(/\s+/g, '').toLowerCase()
  const startCmds = ['开始记录']
  const stopCmds = ['停止记录']
  const isShortcut = code === 'FocusFlow' && (startCmds.includes(cmd) || stopCmds.includes(cmd))

  // 快捷命令时，等 preload 端执行完毕后同步 UI
  if (isShortcut) {
    setTimeout(() => {
      isTracking.value = !!activityTracker.isTracking
      if (isTracking.value) {
        startAutoRefresh()
      } else {
        stopAutoRefresh()
      }
      refreshAll()
    }, 200)
    return
  }
  // 普通打开：仅刷新
  refreshAll()
}

function onVisibilityChange() {
  // 页面重新可见时刷新一次（避免长时间隐藏数据陈旧）
  if (!document.hidden) {
    refreshAll()
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  autoRefreshTimer = setInterval(() => {
    // 只刷新当前选中的日期是今天，避免历史日期被反复重刷
    const today = new Date()
    if (isSameDay(selectedDate.value, today)) {
      refreshAll()
    }
  }, AUTO_REFRESH_INTERVAL)
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// 当月份变化时，加载月份数据
watch([currentYear, currentMonth], async () => {
  const monthNum = currentMonth.value + 1
  datesWithData.value = await activityTracker.getMonthData(currentYear.value, monthNum)
})

// ========== 日历方法 ==========

function changeMonth(delta) {
  currentDate.value = new Date(currentYear.value, currentMonth.value + delta, 1)
}

function toggleDatePicker() {
  showDatePicker.value = !showDatePicker.value
}

function formatSelectedDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isSelectedDate(day) {
  return (
    day === selectedDate.value.getDate() &&
    currentMonth.value === selectedDate.value.getMonth() &&
    currentYear.value === selectedDate.value.getFullYear()
  )
}

function isToday(day) {
  const t = new Date()
  return day === t.getDate() && currentMonth.value === t.getMonth() && currentYear.value === t.getFullYear()
}

function isFutureDate(day) {
  const target = new Date(currentYear.value, currentMonth.value, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return target.getTime() > today.getTime()
}

function selectDate(day) {
  if (isFutureDate(day)) return
  selectedDate.value = new Date(currentYear.value, currentMonth.value, day)
  showDatePicker.value = false
  // 切换日期时关闭报告弹窗（避免显示上一天的内容）
  showReport.value = false
  refreshAll()
}

function formatCategories(categories) {
  if (!categories || !categories.length) return '未分类'
  return categories.join(' · ')
}

// ========== 核心操作 ==========

async function toggleTracking() {
  if (isTracking.value) {
    await activityTracker.stopTracking()
    isTracking.value = false
    stopAutoRefresh()
  } else {
    await activityTracker.startTracking()
    isTracking.value = true
    startAutoRefresh()
  }
  // 同步追踪状态到悬浮窗
  try {
    if (typeof window !== 'undefined' && typeof window.updateFloatingIconState === 'function') {
      window.updateFloatingIconState(isTracking.value)
    }
  } catch (e) {}
  await refreshAll()
}

// 根据设置中的 floatingIcon 开关，打开或关闭悬浮窗
function syncFloatingIconBySettings() {
  try {
    const tracking = settingsService.loadTrackingSettings() || {}
    const want = !!tracking.floatingIcon
    if (typeof window === 'undefined') return
    if (want) {
      if (typeof window.openFloatingIcon === 'function') {
        window.openFloatingIcon()
      }
    } else {
      if (typeof window.closeFloatingIcon === 'function') {
        window.closeFloatingIcon()
      }
    }
  } catch (e) {
    console.error('[FocusFlow] 同步悬浮图标设置失败:', e)
  }
}

async function generateReport(force = false) {
  if (generatingReport.value) return
  reportError.value = ''
  generatingReport.value = true
  try {
    const dateStr = formatSelectedDate(selectedDate.value)
    if (force) {
      aiReport.value = '正在重新生成报告…'
    } else if (!aiReport.value) {
      aiReport.value = '正在生成报告…'
    }
    const result = await activityTracker.generateDailyReport(dateStr, {
      force,
      stats: {
        totalScreenshots: todayStats.value.totalScreenshots,
        activeCategories: todayStats.value.activeCategories,
        totalSessions: todayStats.value.totalSessions,
        focusScore: todayStats.value.focusScore
      }
    })
    aiReport.value = result.content
    aiReportMeta.value = {
      model: result.model || '',
      generatedAt: result.generatedAt || Date.now(),
      slotCount: result.slotCount || 0,
      cached: !!result.cached
    }
    if (window.utools?.showNotification) {
      window.utools.showNotification(
        result.cached ? '已加载缓存中的日报告' : 'AI 报告生成完成'
      )
    }
  } catch (e) {
    console.error('generateReport 失败:', e)
    const msg = (e && e.message) ? e.message : String(e || '未知错误')
    aiReport.value = ''
    reportError.value = msg
  } finally {
    generatingReport.value = false
  }
}

/**
 * 打开 AI 报告弹窗：若该日已有缓存 → 直接展示；否则自动调 AI 生成
 */
async function openReport() {
  showReport.value = true
  reportError.value = ''
  if (aiReport.value) {
    // 已有内容（包括 refreshAll 自动加载的缓存）→ 直接展示
    return
  }
  // 否则立即触发一次生成（非 force）
  await generateReport(false)
}

function closeReport() {
  showReport.value = false
}

// 切换日期或首次进入时，自动展示已有报告
async function loadExistingReport() {
  try {
    const dateStr = formatSelectedDate(selectedDate.value)
    const cached = activityTracker.loadDailyReport(dateStr)
    if (cached && cached.content) {
      aiReport.value = cached.content
      aiReportMeta.value = {
        model: cached.model || '',
        generatedAt: cached.generatedAt || 0,
        slotCount: cached.slotCount || 0,
        cached: true
      }
      reportError.value = ''
    } else {
      aiReport.value = ''
      aiReportMeta.value = { model: '', generatedAt: 0, slotCount: 0, cached: false }
      reportError.value = ''
    }
  } catch (e) {
    console.error('loadExistingReport 失败:', e)
  }
}

function formatReportTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function copyReport() {
  try {
    navigator.clipboard.writeText(aiReport.value)
    if (window.utools?.showNotification) {
      window.utools.showNotification('报告已复制到剪贴板')
    } else {
      console.log('报告已复制到剪贴板')
    }
  } catch (e) {
    console.error(e)
  }
}

function openSettings() {
  showSettings.value = true
}

function onSettingsUpdated(payload) {
  // 只有「保存设置」事件才需要按新截图间隔重启定时器并提示用户
  // （清理数据/导入数据 走的是 __clearedAll 路径，不会改 screenshotInterval，但同样会发 settings-updated）
  if (payload && payload.__settingsSaved) {
    try {
      if (activityTracker.isTracking && typeof activityTracker.restartScreenshotTimer === 'function') {
        const sec = activityTracker.restartScreenshotTimer()
        if (sec > 0 && window.utools?.showNotification) {
          window.utools.showNotification(`截图间隔已更新为 ${sec} 秒`)
        }
      }
    } catch (e) {
      console.error('onSettingsUpdated 失败:', e)
    }
    // 应用悬浮图标开关
    syncFloatingIconBySettings()
  }

  // 如果是「清理数据 / 导入数据」事件，需要把页面状态全部重置（包括 AI 报告/弹窗/分析中等内存态）
  if (payload && payload.__clearedAll) {
    try {
      aiReport.value = ''
      aiReportMeta.value = { model: '', generatedAt: 0, slotCount: 0, cached: false }
      reportError.value = ''
      showReport.value = false
      analyzingSlotIds.value = new Set()
      timelineData.value = []
      topApps.value = []
      topCategories.value = []
      chartData.value = []
      datesWithData.value = []
    } catch (e) {
      console.warn('清除后重置 App 内存态失败：', e)
    }
    // 异步触发一次完整刷新（从已空/部分清空的 db 读回，所有 section 都会更新）
    refreshAll()
  }
}

// ========== 时间轴详情 ==========

async function openTimelineDetail(item) {
  selectedItem.value = item
  showDetail.value = true
  // 立即清空旧数据，显示加载态
  slotScreenshots.value = []
  screenshotIndex.value = 0
  loadingScreenshots.value = true
  resetImgState()

  // 渐进式加载：每加载完一张即更新 UI，避免一次性阻塞
  await activityTracker.loadScreenshotsForSlot(item.id, (results, loaded, total) => {
    // 用新数组引用触发响应式更新
    slotScreenshots.value = results.slice()
    // 第一张加载完成后即可显示，并初始化图片状态
    if (loaded === 1) {
      resetImgState()
    }
  })
  loadingScreenshots.value = false
  // 不再调用 resetImgState()：图片已通过 @load 设置 imgLoading=false，
  // 此处再调会因 src 未变而 @load 不触发，导致 imgLoading 卡在 true
  if (slotScreenshots.value.length === 0) {
    imgLoading.value = false
  }
}

function closeDetail() {
  stopPlay()
  closeZoom()
  showDetail.value = false
  selectedItem.value = null
  slotScreenshots.value = []
  loadingScreenshots.value = false
}

const currentScreenshot = computed(() => {
  if (!slotScreenshots.value.length) return null
  return slotScreenshots.value[screenshotIndex.value]
})

function resetImgState() {
  const sc = currentScreenshot.value
  imgError.value = false
  if (!sc || !sc.imageData) {
    // 图片数据为空：仅在仍在加载截图时显示加载态
    imgLoading.value = !!(sc && loadingScreenshots.value)
    return
  }
  // 图片数据就绪：设为加载中，再用 nextTick 检查 img 是否已缓存渲染完成
  // （src 未变时浏览器不会触发 @load，需要手动检测）
  imgLoading.value = true
  nextTick(() => {
    const el = document.querySelector('.shot-canvas .video-img')
    if (el && el.complete && el.naturalWidth > 0) {
      imgLoading.value = false
    }
  })
}

function onImgLoad() {
  imgLoading.value = false
}

function onImgError(e) {
  imgLoading.value = false
  imgError.value = true
  console.error('截图渲染失败:', currentScreenshot.value && currentScreenshot.value.docId)
}

// 监听索引变化，重置加载/错误状态
watch(screenshotIndex, () => {
  resetImgState()
})

function prevShot() {
  if (screenshotIndex.value > 0) {
    screenshotIndex.value--
  }
}

function nextShot() {
  if (screenshotIndex.value < slotScreenshots.value.length - 1) {
    screenshotIndex.value++
  }
}

function jumpTo(idx) {
  if (idx >= 0 && idx < slotScreenshots.value.length) {
    screenshotIndex.value = idx
  }
}

function openZoom() {
  if (currentScreenshot.value && currentScreenshot.value.imageData) {
    stopPlay()
    showZoom.value = true
  }
}

function closeZoom() {
  showZoom.value = false
}

function togglePlay() {
  if (isPlaying.value) {
    stopPlay()
  } else {
    startPlay()
  }
}

function startPlay() {
  if (!slotScreenshots.value.length) return
  if (slotScreenshots.value.length === 1) return
  // 已播放到最后一张时，重新从第一张开始
  if (screenshotIndex.value >= slotScreenshots.value.length - 1) {
    screenshotIndex.value = 0
  }
  isPlaying.value = true
  playTimer = setInterval(() => {
    // 播放到最后一张自动停止，避免无限循环
    if (screenshotIndex.value >= slotScreenshots.value.length - 1) {
      stopPlay()
      return
    }
    screenshotIndex.value = (screenshotIndex.value + 1) % slotScreenshots.value.length
  }, playSpeed.value)
}

// 播放速度变化时若正在播放则重启定时器
watch(playSpeed, () => {
  if (isPlaying.value) {
    stopPlay()
    startPlay()
  }
})

function stopPlay() {
  isPlaying.value = false
  if (playTimer) {
    clearInterval(playTimer)
    playTimer = null
  }
}

// 键盘快捷键：弹窗内 ←/-> 翻页、空格 播放/暂停、Esc 关闭
function onDetailKeydown(e) {
  if (!showDetail.value && !showZoom.value) return
  const tag = (e.target && e.target.tagName) || ''
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault()
      prevShot()
      break
    case 'ArrowRight':
      e.preventDefault()
      nextShot()
      break
    case ' ':
    case 'Spacebar':
      e.preventDefault()
      togglePlay()
      break
    case 'Escape':
      if (showZoom.value) {
        closeZoom()
      } else {
        closeDetail()
      }
      break
  }
}

// ========== 数据刷新 ==========

async function refreshAll() {
  loading.value = true
  try {
    // 加载分类配置（用于显示颜色）
    try {
      categoriesConfig.value = settingsService.loadCategories() || []
    } catch (e) {
      categoriesConfig.value = []
    }

    const dateStr = formatSelectedDate(selectedDate.value)
    const slots = await activityTracker.loadTimelineForDate(dateStr)
    timelineData.value = slots

    // 同步 Tracker 内部「正在分析中的 slot」到 UI（避免页面刷新后丢失「分析中」状态）
    try {
      const trackerActive = activityTracker.listAnalyzingSlots
        ? activityTracker.listAnalyzingSlots()
        : []
      const merged = new Set(analyzingSlotIds.value)
      trackerActive.forEach((id) => merged.add(Number(id)))
      // 清掉那些已经不在当前时间轴里的旧 id，避免脏数据残留
      for (const id of [...merged]) {
        if (!trackerActive.includes(Number(id)) && !slots.some((s) => Number(s.id) === Number(id))) {
          merged.delete(id)
        }
      }
      analyzingSlotIds.value = merged
    } catch (e) {
      console.warn('[FocusFlow] 同步分析中 slot 失败：', e)
    }

    // 统计：应用 & 分类
    const appCount = new Map()
    const catCount = new Map()
    let total = 0
    let appTotal = 0 // 排除 uTools 后用于应用百分比
    let unanalyzed = 0
    slots.forEach((s) => {
      s.screenshots.forEach((sc) => {
        const app = sc.app || '未知应用'
        total++
        // uTools 自身（插件窗口前台时识别到的应用）不计入应用排行
        if (isUtoolsApp(app)) return
        appCount.set(app, (appCount.get(app) || 0) + 1)
        appTotal++
      })
      // 分类按时段统计（一个时段算一次，多个分类各算一次）
      const cats = Array.isArray(s.categories) ? s.categories.filter((c) => c && String(c).trim()) : []
      if (cats.length > 0) {
        cats.forEach((c) => {
          const name = String(c).trim()
          catCount.set(name, (catCount.get(name) || 0) + 1)
        })
      } else {
        unanalyzed++
        // AI 无法识别分类或尚未分析的时段，归为「未分类」并纳入饼图
        catCount.set('未分类', (catCount.get('未分类') || 0) + 1)
      }
    })

    const apps = Array.from(appCount.entries())
      .map(([name, count]) => ({
        name,
        count,
        percent: appTotal > 0 ? Math.floor((count / appTotal) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
    topApps.value = apps

    const totalCatTagged = Array.from(catCount.values()).reduce((a, b) => a + b, 0)
    const cats = Array.from(catCount.entries())
      .map(([name, count]) => ({
        name,
        count,
        color: getCategoryColor(name),
        percent: totalCatTagged > 0 ? Math.floor((count / totalCatTagged) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
    topCategories.value = cats
    unanalyzedSlots.value = unanalyzed

    // 图表数据：优先用活动分类统计；分类为空时回退到应用统计（已排除 uTools）
    if (cats.length > 0) {
      chartData.value = cats.slice(0, 8).map((c) => ({ label: c.name, value: c.count, color: c.color }))
    } else {
      chartData.value = apps.slice(0, 8).map((a) => ({ label: a.name, value: a.count }))
    }

    const focusScore = Math.max(20, 100 - Math.max(0, apps.length - 1) * 10 - slots.length * 0.5)
    todayStats.value = {
      totalScreenshots: total,
      activeApps: apps.length,
      activeCategories: cats.length,
      totalSessions: slots.length,
      focusScore: Math.min(100, Math.floor(focusScore))
    }

    // 同时刷新当前月日期列表
    const y = selectedDate.value.getFullYear()
    const m = selectedDate.value.getMonth() + 1
    datesWithData.value = await activityTracker.getMonthData(y, m)
    lastRefreshAt.value = Date.now()

    // 自动加载所选日期已有的 AI 日报告（不会触发 AI 调用）
    await loadExistingReport()
  } catch (e) {
    console.error('refreshAll 失败:', e)
  } finally {
    loading.value = false
  }
}

// 从配置中找分类颜色，找不到给默认色
function getCategoryColor(name) {
  // 「未分类」固定用灰色，与其他分类区分
  if (name === '未分类') return '#95a5a6'
  const found = categoriesConfig.value.find((c) => c.name === name)
  if (found && found.color) return found.color
  // 简单 hash 给个稳定的兜底色
  const palette = ['#3498db', '#2ecc71', '#e67e22', '#9b59b6', '#1abc9c', '#e74c3c', '#34495e', '#f39c12']
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xff
  return palette[h % palette.length]
}

// 判断是否为 uTools 自身（插件窗口前台时识别到的应用名，大小写不敏感）
function isUtoolsApp(app) {
  if (!app) return false
  const n = String(app).trim().toLowerCase()
  return n === 'utools' || n === 'u tools' || n === 'utool'
}

// 时间轴左侧标记的颜色（取第一个分类）
function timelineItemColor(item) {
  if (item && Array.isArray(item.categories) && item.categories.length > 0) {
    return getCategoryColor(item.categories[0])
  }
  return '#bdc3c7'
}

// 手动分析所有未分类的时段
async function analyzeAllPending() {
  if (analyzing.value) return
  analyzing.value = true
  try {
    const pending = timelineData.value.filter(
      (s) => !s.categories || s.categories.length === 0
    )
    if (pending.length === 0) {
      window.utools?.showNotification?.('没有需要分析的时段')
      return
    }
    let ok = 0
    let fail = 0
    for (const s of pending) {
      try {
        markAnalyzing(s.id, true)
        const r = await activityTracker.analyzeSlot(s.id, { source: 'batch' })
        if (r && r.categories && r.categories.length) ok++
        else fail++
      } catch (e) {
        fail++
      } finally {
        markAnalyzing(s.id, false)
      }
    }
    window.utools?.showNotification?.(`分析完成：成功 ${ok}，失败 ${fail}`)
    await refreshAll()
  } catch (e) {
    console.error('analyzeAllPending 失败:', e)
  } finally {
    analyzing.value = false
  }
}

// 标记某个时段为「分析中」状态（响应式）
function markAnalyzing(id, on) {
  const next = new Set(analyzingSlotIds.value)
  if (on) next.add(id)
  else next.delete(id)
  analyzingSlotIds.value = next
}

/**
 * 接收 Tracker 派发的 AI 分析状态变化
 * - 自动同步时间轴 UI 上的「分析中」徽标
 * - 分析成功后对应行用最新 slot 数据局部刷新，避免整页 refreshAll 抖动
 * - 失败仅在控制台留痕（自动触发的失败不打扰用户）
 */
async function onAnalysisStateChange(payload) {
  if (!payload || payload.id == null) return
  const id = Number(payload.id)
  if (payload.analyzing) {
    markAnalyzing(id, true)
    return
  }
  // analyzing === false：分析结束
  markAnalyzing(id, false)
  if (payload.success) {
    try {
      // 局部刷新该时段的数据 + 顶部统计 + 分类饼图
      await refreshAll()
    } catch (e) {
      console.warn('[FocusFlow] onAnalysisStateChange 刷新失败：', e)
    }
  } else if (payload.error) {
    console.warn('[FocusFlow] 自动 AI 分析失败：', payload.error && payload.error.message)
  }
}

// 重新（或首次）分析单个时段
async function reanalyzeSlot(item) {
  if (!item || item.id == null) return
  if (analyzingSlotIds.value.has(item.id)) return
  // 检查 AI 是否已配置（v2: 用 active provider）
  try {
    settingsService.loadProviders()
    const provider = settingsService.loadActiveProvider()
    if (!provider) {
      window.alert('请先在「设置 → AI 模型」中添加并激活一个模型')
      return
    }
    if (!provider.model) {
      window.alert(`「${provider.name || provider.id}」未指定模型 ID，请前往「设置 → AI 模型」编辑`)
      return
    }
    if (provider.protocol === 'claude' && !provider.apiKey) {
      window.alert(`「${provider.name || provider.id}」需要 API Key，请前往「设置 → AI 模型」补全`)
      return
    }
  } catch (e) {
    // ignore
  }
  markAnalyzing(item.id, true)
  try {
    const result = await activityTracker.analyzeSlot(item.id, { source: 'manual' })
    if (result) {
      window.utools?.showNotification?.(`已分析：${result.title || '时段'}`)
      // 局部更新 timelineData 中的对应项（避免整页刷新闪烁）
      const idx = timelineData.value.findIndex((t) => t.id === item.id)
      if (idx >= 0) {
        timelineData.value[idx] = {
          ...timelineData.value[idx],
          title: result.title || timelineData.value[idx].title,
          summary: result.summary || timelineData.value[idx].summary,
          detail: result.detail || timelineData.value[idx].detail,
          categories: result.categories || timelineData.value[idx].categories
        }
        // 若详情弹窗正在打开，同步更新
        if (selectedItem.value && selectedItem.value.id === item.id) {
          selectedItem.value = timelineData.value[idx]
        }
      }
      // 刷新分类统计（不重新加载时间轴主体，体验更稳）
      await refreshAll()
    }
  } catch (e) {
    console.error('reanalyzeSlot 失败:', e)
    const msg = (e && e.message) ? e.message : String(e || '未知错误')
    window.alert('AI 分析失败：\n' + msg + '\n\n详细日志请查看 uTools 开发者工具 Console（Cmd+Option+I）')
  } finally {
    markAnalyzing(item.id, false)
  }
}
</script>

<style scoped>
.app {
  min-height: 100vh;
  background: #f8f9fa;
}

.app-header {
  background: white;
  padding: 16px 24px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.app-header h1 {
  margin: 0;
  color: #2c3e50;
  font-size: 20px;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #7f8c8d;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #bdc3c7;
}
.status-dot.active {
  background: #27ae60;
  box-shadow: 0 0 0 3px rgba(39, 174, 96, 0.2);
  animation: pulse 1.6s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(39, 174, 96, 0.2); }
  50%      { box-shadow: 0 0 0 6px rgba(39, 174, 96, 0.1); }
}
.status-text { font-weight: 500; }
.status-sep { color: #bdc3c7; }
.status-refresh { color: #95a5a6; }
.btn-link {
  background: none;
  border: none;
  color: #3498db;
  cursor: pointer;
  padding: 2px 4px;
  font-size: 12px;
  border-radius: 4px;
}
.btn-link:hover { background: #ecf6fd; }
.refresh-spinner {
  background: none;
  border: none;
  color: #3498db;
  font-size: 14px;
  cursor: default;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  position: relative;
}

.btn {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
  color: white;
}
.btn-primary { background: #3498db; }
.btn-primary:hover { background: #2980b9; }
.btn-danger { background: #e74c3c; }
.btn-danger:hover { background: #c0392b; }
.btn-success { background: #27ae60; color: #fff; }
.btn-success:hover { background: #1f8b4d; }
.btn-secondary { background: #95a5a6; }
.btn-secondary:hover { background: #7f8c8d; }
.btn-warning { background: #f39c12; }
.btn-warning:hover { background: #d68910; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-sm { padding: 4px 8px; font-size: 12px; }

.date-picker-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
  padding: 12px;
  z-index: 100;
  min-width: 280px;
}
.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.calendar-header h3 { margin: 0; font-size: 14px; color: #2c3e50; }
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.calendar-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #34495e;
  transition: background 0.15s;
}
.calendar-day.header { background: #f1f3f5; cursor: default; font-weight: 600; color: #7f8c8d; }
.calendar-day.empty { background: transparent; cursor: default; }
.calendar-day.has-data { background: #e3f2fd; color: #1565c0; }
.calendar-day.has-data:hover { background: #bbdefb; }
.calendar-day.today { background: #4caf50; color: white; font-weight: 600; }
.calendar-day.selected { background: #1976d2; color: white; font-weight: 600; }
.calendar-day.disabled { color: #bdbdbd; cursor: not-allowed; }
.calendar-footer { text-align: center; font-size: 12px; color: #7f8c8d; margin: 8px 0 0; }

.app-main {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.stat-card {
  background: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  text-align: center;
  min-width: 0;
}
.stat-card h3 {
  margin: 0 0 8px 0;
  color: #7f8c8d;
  font-size: 13px;
  font-weight: 500;
  text-transform: uppercase;
}
.stat-value { font-size: 26px; font-weight: bold; color: #2c3e50; }

.charts-section, .apps-section, .ai-report-section, .timeline-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  margin-bottom: 20px;
}

.charts-section h2, .apps-section h2, .ai-report-section h2, .timeline-section h2 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #2c3e50;
}

.chart-container { height: 260px; }

.apps-list { display: flex; flex-direction: column; gap: 10px; }
.app-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #f8f9fa;
  border-radius: 6px;
}
.app-name { font-weight: 500; color: #2c3e50; font-size: 14px; }
.app-info { display: flex; align-items: center; gap: 8px; }
.cat-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.cat-tip {
  margin: 12px 0 0;
  font-size: 12px;
  color: #7f8c8d;
  display: flex;
  align-items: center;
  gap: 6px;
}
.app-usage { display: flex; align-items: center; gap: 10px; flex: 1; max-width: 340px; margin-left: 16px; }
.usage-bar { flex: 1; height: 8px; background: #ecf0f1; border-radius: 4px; overflow: hidden; }
.usage-fill { height: 100%; background: #3498db; transition: width 0.3s ease; }
.usage-time { font-size: 12px; color: #7f8c8d; min-width: 60px; text-align: right; }

.ai-report { background: #f8f9fa; padding: 16px; border-radius: 6px; border-left: 4px solid #3498db; }
.report-content {
  margin: 0;
  word-break: break-word;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.7;
  color: #2c3e50;
}

/* ========== AI 报告主页内提示 ========== */
.ai-report-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(90deg, #ebf5fb 0%, #f8fbfd 100%);
  border: 1px solid #d6eaf8;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.ai-report-hint:hover {
  border-color: #3498db;
  box-shadow: 0 2px 8px rgba(52, 152, 219, 0.15);
}
.report-hint-icon { font-size: 20px; }
.report-hint-text { flex: 1; font-size: 14px; color: #2c3e50; }
.report-hint-meta { color: #7f8c8d; font-size: 12px; margin-left: 4px; }

/* ========== AI 报告弹窗（仿设置弹窗）========== */
.report-panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: stretch;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
  box-sizing: border-box;
}
.report-container {
  background: white;
  border-radius: 10px;
  width: 100%;
  max-width: 1400px;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
}
.report-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid #e1e5e9;
  background: white;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.report-panel-title h2 {
  margin: 0 0 4px 0;
  color: #2c3e50;
  font-size: 18px;
}
.report-panel-title .ai-report-meta {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  color: #7f8c8d;
}
.report-panel-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.report-panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px;
  background: #f8f9fa;
}
.report-panel-body .report-content {
  background: white;
  padding: 24px 28px;
  border-radius: 8px;
  border: 1px solid #ecf0f1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  font-size: 15px;
  line-height: 1.8;
}

/* ========== Markdown 渲染样式（仅作用于 .markdown-body 内部） ========== */
/* 注意：本组件 <style scoped>，所以 v-html 注入的子节点必须用 :deep() 才能命中 */
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin: 1.4em 0 0.6em;
  color: #2c3e50;
  font-weight: 600;
  line-height: 1.35;
}
.markdown-body :deep(h1:first-child),
.markdown-body :deep(h2:first-child),
.markdown-body :deep(h3:first-child) {
  margin-top: 0;
}
.markdown-body :deep(h1) { font-size: 1.6em; border-bottom: 1px solid #ecf0f1; padding-bottom: 0.3em; }
.markdown-body :deep(h2) { font-size: 1.35em; border-bottom: 1px solid #ecf0f1; padding-bottom: 0.25em; }
.markdown-body :deep(h3) { font-size: 1.18em; color: #3498db; }
.markdown-body :deep(h4) { font-size: 1.06em; }
.markdown-body :deep(p) {
  margin: 0.6em 0;
  color: #34495e;
}
.markdown-body :deep(strong) { color: #2c3e50; font-weight: 600; }
.markdown-body :deep(em) { color: #34495e; }
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.6em;
}
.markdown-body :deep(li) {
  margin: 0.25em 0;
  color: #34495e;
}
.markdown-body :deep(li > p) { margin: 0.2em 0; }
.markdown-body :deep(blockquote) {
  margin: 0.8em 0;
  padding: 0.4em 0.9em;
  color: #5d6d7e;
  border-left: 4px solid #3498db;
  background: #f8fbfd;
  border-radius: 0 6px 6px 0;
}
.markdown-body :deep(code) {
  background: #f4f6f8;
  color: #c0392b;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.markdown-body :deep(pre) {
  margin: 0.8em 0;
  padding: 14px 16px;
  background: #2c3e50;
  color: #ecf0f1;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.55;
}
.markdown-body :deep(pre code) {
  background: transparent;
  color: inherit;
  padding: 0;
  border-radius: 0;
  font-size: inherit;
}
.markdown-body :deep(a) {
  color: #3498db;
  text-decoration: none;
  border-bottom: 1px dashed #3498db;
}
.markdown-body :deep(a:hover) { color: #2980b9; border-bottom-style: solid; }
.markdown-body :deep(hr) {
  margin: 1.4em 0;
  border: none;
  border-top: 1px solid #ecf0f1;
}
.markdown-body :deep(table) {
  border-collapse: collapse;
  margin: 0.8em 0;
  width: 100%;
  font-size: 0.95em;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #e1e5e9;
  padding: 8px 12px;
  text-align: left;
}
.markdown-body :deep(th) {
  background: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
}
.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 6px;
}
.markdown-body :deep(input[type="checkbox"]) {
  margin-right: 6px;
  vertical-align: middle;
}
.report-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #7f8c8d;
  gap: 16px;
}
.report-loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #ecf0f1;
  border-top-color: #3498db;
  border-radius: 50%;
  animation: report-spin 0.8s linear infinite;
}
@keyframes report-spin {
  to { transform: rotate(360deg); }
}
.report-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #7f8c8d;
  gap: 16px;
  background: white;
  border-radius: 8px;
  border: 1px dashed #d0d7de;
}

.ai-report-cached {
  color: #16a085;
  font-weight: 500;
}
.ai-report-error {
  margin: 0;
  padding: 14px 16px;
  background: #fdedec;
  color: #c0392b;
  border-radius: 6px;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-word;
  border: 1px solid #f5b7b1;
}

@media (max-width: 768px) {
  .report-panel { padding: 0; }
  .report-container { border-radius: 0; }
  .report-panel-body { padding: 12px; }
  .report-panel-body .report-content { padding: 16px; font-size: 14px; }
}

.empty-state {
  background: white;
  padding: 40px;
  border-radius: 8px;
  text-align: center;
  color: #7f8c8d;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

.timeline { position: relative; padding-left: 24px; }
.timeline::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 0; bottom: 0;
  width: 2px;
  background: #3498db;
}
.timeline-item {
  position: relative;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 6px;
  cursor: pointer;
  transition: transform 0.15s, background 0.15s;
}
.timeline-item:hover { transform: translateX(3px); background: #eef4f9; }
.timeline-marker {
  position: absolute;
  left: -20px;
  top: 18px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #3498db;
  border: 3px solid white;
  box-shadow: 0 0 0 2px #3498db;
}
.timeline-title { margin: 0 0 4px 0; font-size: 15px; color: #2c3e50; font-weight: 600; }
.timeline-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
}
.cat-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  color: white;
  font-weight: 500;
  line-height: 1.4;
}
.cat-badge.pending {
  background: #bdc3c7;
  color: #34495e;
}
.timeline-actions {
  margin-left: auto;
}
.btn-mini {
  padding: 3px 10px;
  border: 1px solid #3498db;
  background: white;
  color: #3498db;
  border-radius: 12px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  line-height: 1.4;
}
.btn-mini:hover:not(:disabled) {
  background: #3498db;
  color: white;
}
.btn-mini:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.modal-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.timeline-time { margin: 0 0 6px 0; font-size: 12px; color: #7f8c8d; }
.timeline-summary { margin: 6px 0; font-size: 13px; color: #34495e; line-height: 1.5; }
.timeline-meta { margin: 6px 0 0 0; font-size: 12px; color: #95a5a6; }

/* 弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-content {
  background: white;
  border-radius: 10px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e1e5e9;
}
.modal-header h3 { margin: 0; color: #2c3e50; font-size: 16px; }
.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #7f8c8d;
  cursor: pointer;
  line-height: 1;
}
.close-btn:hover { color: #2c3e50; }
.modal-body { padding: 20px; }

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px 16px;
  border-top: 1px solid #e1e5e9;
}

.ai-summary p { margin: 6px 0; font-size: 14px; line-height: 1.6; color: #34495e; }

.screenshot-video-section { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e1e5e9; }

/* 截图加载态 */
.screenshot-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 24px;
  padding: 48px 16px;
  border-top: 1px solid #e1e5e9;
  color: #7f8c8d;
  font-size: 14px;
}
.spinner-lg {
  width: 20px;
  height: 20px;
  border: 3px solid #e1e5e9;
  border-top-color: #3498db;
  border-radius: 50%;
  animation: ff-spin 0.7s linear infinite;
}
.screenshot-video-section h4 { margin: 0 0 12px 0; color: #2c3e50; font-size: 14px; }
.video-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.progress-bar { flex: 1; accent-color: #3498db; }
.shot-counter { font-size: 13px; color: #2c3e50; min-width: 56px; text-align: center; font-variant-numeric: tabular-nums; }
.speed-select {
  padding: 4px 6px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  font-size: 12px;
  color: #2c3e50;
  background: #fff;
  cursor: pointer;
}
.speed-select:focus { outline: none; border-color: #3498db; }
.video-preview { background: #f8f9fa; padding: 12px; border-radius: 8px; border-left: 4px solid #3498db; }

/* 截图舞台：左右翻页按钮 + 图片画布 */
.shot-stage {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}
.shot-canvas {
  position: relative;
  flex: 1;
  min-width: 0;
  cursor: zoom-in;
}
.video-img {
  width: 100%;
  max-height: 480px;
  object-fit: contain;
  background: #222;
  border-radius: 6px;
  margin-bottom: 10px;
  transition: filter 0.2s ease;
}
.shot-canvas:hover .video-img.is-zoomable { filter: brightness(0.92); }
.video-img-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  color: #ecf0f1;
  font-size: 13px;
}

/* 翻页按钮 */
.nav-btn {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(52, 152, 219, 0.12);
  color: #3498db;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, transform 0.1s ease;
}
.nav-btn:hover:not(:disabled) { background: rgba(52, 152, 219, 0.28); }
.nav-btn:active:not(:disabled) { transform: scale(0.9); }
.nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* 加载与缩放提示 */
.shot-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ecf0f1;
  font-size: 13px;
  background: rgba(0, 0, 0, 0.45);
  padding: 8px 14px;
  border-radius: 6px;
  pointer-events: none;
}
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: ff-spin 0.7s linear infinite;
}
@keyframes ff-spin { to { transform: rotate(360deg); } }
.zoom-hint {
  position: absolute;
  bottom: 16px;
  right: 10px;
  font-size: 11px;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
  padding: 3px 8px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}
.shot-canvas:hover .zoom-hint { opacity: 1; }

.video-info { display: flex; justify-content: space-between; font-size: 13px; color: #2c3e50; }
.video-info .app-name { font-weight: 600; }

/* 缩略图条 */
.thumb-strip {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  padding: 10px;
  background: #fff;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  overflow-x: auto;
}
.thumb-item {
  flex: 0 0 auto;
  width: 64px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  background: #222;
  transition: border-color 0.15s ease, transform 0.1s ease;
}
.thumb-item:hover { transform: translateY(-2px); }
.thumb-item.active { border-color: #3498db; }
.thumb-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #ecf0f1;
  font-size: 16px;
}

/* 大图查看器 */
.zoom-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ff-fade 0.18s ease;
}
@keyframes ff-fade { from { opacity: 0; } to { opacity: 1; } }
.zoom-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0 56px;
  box-sizing: border-box;
}
.zoom-img {
  max-width: 90%;
  max-height: 86vh;
  object-fit: contain;
  border-radius: 6px;
  cursor: zoom-out;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
}
.zoom-empty {
  color: #bdc3c7;
  font-size: 15px;
}
.zoom-close {
  position: absolute;
  top: 16px;
  right: 20px;
  background: rgba(255, 255, 255, 0.12);
  border: none;
  color: #fff;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}
.zoom-close:hover { background: rgba(255, 255, 255, 0.25); }
.zoom-nav { background: rgba(255, 255, 255, 0.12); color: #fff; }
.zoom-nav:hover:not(:disabled) { background: rgba(255, 255, 255, 0.25); }
.zoom-info {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 20px;
  font-size: 13px;
  color: #ecf0f1;
  background: rgba(0, 0, 0, 0.5);
  padding: 6px 16px;
  border-radius: 20px;
}

@media (max-width: 768px) {
  .app-header { flex-direction: column; align-items: flex-start; }
  .stats-grid { gap: 8px; }
  .stat-card { padding: 10px 6px; }
  .stat-card h3 { font-size: 11px; }
  .stat-value { font-size: 20px; }
  .app-usage { max-width: none; margin-left: 0; margin-top: 8px; }
  .video-controls { flex-wrap: wrap; }
  .nav-btn { width: 32px; height: 32px; font-size: 22px; }
  .zoom-stage { padding: 0 12px; }
}
</style>
