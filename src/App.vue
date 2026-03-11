<template>
  <div class="app">
    <header class="app-header">
      <h1>FocusFlow 活动追踪</h1>
      <div class="header-actions">
        <button @click="toggleTracking" :class="['btn', { 'btn-danger': isTracking }]">
          {{ isTracking ? '停止追踪' : '开始追踪' }}
        </button>
        <button class="btn btn-primary" @click="generateReport">
          AI 生成报告
        </button>
        <button class="btn btn-primary" @click="generateActivityReport">
          活动分析报告
        </button>
      </div>
    </header>

    <main class="app-main">
      <div class="stats-grid">
        <div class="stat-card">
          <h3>今日使用时间</h3>
          <div class="stat-value">{{ formatTime(todayStats.totalTime) }}</div>
        </div>
        <div class="stat-card">
          <h3>活跃应用</h3>
          <div class="stat-value">{{ todayStats.activeApps }}</div>
        </div>
        <div class="stat-card">
          <h3>切换次数</h3>
          <div class="stat-value">{{ todayStats.appSwitches }}</div>
        </div>
        <div class="stat-card">
          <h3>专注度</h3>
          <div class="stat-value">{{ todayStats.focusScore }}%</div>
        </div>
      </div>

      <div class="charts-section">
        <h2>使用统计</h2>
        <div class="chart-container">
          <AppUsageChart :data="chartData" />
        </div>
      </div>

      <div class="apps-section">
        <h2>应用使用排行</h2>
        <div class="apps-list">
          <div v-for="app in topApps" :key="app.name" class="app-item">
            <div class="app-info">
              <span class="app-icon">{{ app.icon }}</span>
              <span class="app-name">{{ app.name }}</span>
            </div>
            <div class="app-usage">
              <div class="usage-bar">
                <div class="usage-fill" :style="{ width: app.percentage + '%' }"></div>
              </div>
              <span class="usage-time">{{ formatTime(app.time) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="aiReport" class="ai-report-section">
        <h2>AI 总结报告</h2>
        <div class="ai-report">
          <div class="report-content">
            {{ aiReport }}
          </div>
          <button class="btn btn-secondary" @click="copyReport">复制报告</button>
        </div>
      </div>

      <div v-if="activityReport" class="ai-report-section">
        <h2>活动分析报告</h2>
        <div class="ai-report">
          <div class="report-content">
            {{ activityReport }}
          </div>
          <button class="btn btn-secondary" @click="copyActivityReport">复制报告</button>
        </div>
      </div>

      <div v-if="screenshots.length > 0" class="screenshots-section">
        <div class="screenshots-header">
          <h2>截图记录</h2>
          <button class="btn btn-secondary" @click="openScreenshotDir">打开截图目录</button>
        </div>
        <div class="screenshots-grid">
          <div v-for="(screenshot, index) in screenshots" :key="index" class="screenshot-item">
            <div class="screenshot-info">
              <span class="screenshot-time">{{ screenshot.time }}</span>
              <span class="screenshot-app">{{ screenshot.app }}</span>
              <span v-if="screenshot.filePath" class="screenshot-path">{{ screenshot.filePath }}</span>
            </div>
            <div class="screenshot-preview">
              <img :src="screenshot.imageData" :alt="`Screenshot ${index + 1}`" class="screenshot-img">
            </div>
          </div>
        </div>
        <div class="screenshot-video-section">
          <h3>截图视频</h3>
          <div class="video-controls">
            <button class="btn btn-primary" @click="startScreenshotVideo">开始播放</button>
            <input type="range" v-model="videoProgress" min="0" :max="screenshots.length - 1" class="progress-bar">
            <span>{{ currentScreenshotIndex + 1 }} / {{ screenshots.length }}</span>
          </div>
          <div v-if="currentScreenshot" class="video-preview">
            <img :src="currentScreenshot.imageData" :alt="`Screenshot ${currentScreenshotIndex + 1}`" class="video-img">
            <div class="video-info">
              <span>{{ currentScreenshot.time }}</span>
              <span>{{ currentScreenshot.app }}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ActivityTracker } from './services/ActivityTracker'
import { AIService } from './services/AIService'
import AppUsageChart from './components/AppUsageChart.vue'

console.log('App.vue script started')

const activityTracker = new ActivityTracker()
const aiService = new AIService()

// 从数据库中获取追踪状态，默认为false
const loadTrackingState = () => {
  try {
    if (typeof window.getSettingsFromDb === 'function') {
      const settings = window.getSettingsFromDb()
      return settings.isTracking || false
    }
    return false
  } catch (error) {
    console.error('Failed to load tracking state:', error)
    return false
  }
}

const isTracking = ref(loadTrackingState())
const todayStats = ref({
  totalTime: 0,
  activeApps: 0,
  appSwitches: 0,
  focusScore: 0
})

const topApps = ref([])
const chartData = ref([])
const aiReport = ref('')
const activityReport = ref('')
const screenshots = ref([])
const videoProgress = ref(0)
const currentScreenshotIndex = ref(0)
const videoInterval = ref(null)
const isPlaying = ref(false)

const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  }
  return `${minutes}分钟`
}

const toggleTracking = async () => {
  try {
    if (isTracking.value) {
      await activityTracker.stopTracking()
    } else {
      await activityTracker.startTracking()
    }
    isTracking.value = !isTracking.value
    await updateStats()
  } catch (error) {
    console.error('Error in toggleTracking:', error)
  }
}

const updateStats = async () => {
  try {
    console.log('Updating stats...')
    const stats = await activityTracker.getTodayStats()
    todayStats.value = stats
    console.log('Today stats:', stats)

    const apps = await activityTracker.getTopApps(10)
    topApps.value = apps
    console.log('Top apps:', apps)

    const chart = await activityTracker.getChartData()
    chartData.value = chart
    console.log('Chart data:', chart)

    // 获取截图数据
    const screenshotData = await activityTracker.getScreenshots()
    screenshots.value = screenshotData
    console.log('Screenshots:', screenshotData)
  } catch (error) {
    console.error('Error in updateStats:', error)
  }
}

const generateReport = async () => {
  try {
    const data = await activityTracker.getTodayData()
    const report = await aiService.generateReport(data)
    aiReport.value = report
  } catch (error) {
    console.error('Error in generateReport:', error)
  }
}

const copyReport = () => {
  try {
    navigator.clipboard.writeText(aiReport.value)
    // 检查utools.showNotification方法是否存在
    if (typeof utools !== 'undefined' && typeof utools.showNotification === 'function') {
      utools.showNotification('报告已复制到剪贴板')
    } else {
      console.log('报告已复制到剪贴板')
    }
  } catch (error) {
    console.error('Error in copyReport:', error)
  }
}

const generateActivityReport = async () => {
  try {
    const today = new Date()
    const startTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    const endTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).getTime()
    
    const activityData = activityTracker.generateActivityReport({ startTime, endTime })
    
    if (activityData.totalActions > 0) {
      const report = await aiService.analyzeUserActivity(activityData)
      activityReport.value = report
    } else {
      activityReport.value = '今日暂无活动数据可供分析。'
    }
  } catch (error) {
    console.error('Error in generateActivityReport:', error)
  }
}

const copyActivityReport = () => {
  try {
    navigator.clipboard.writeText(activityReport.value)
    // 检查utools.showNotification方法是否存在
    if (typeof utools !== 'undefined' && typeof utools.showNotification === 'function') {
      utools.showNotification('活动报告已复制到剪贴板')
    } else {
      console.log('活动报告已复制到剪贴板')
    }
  } catch (error) {
    console.error('Error in copyActivityReport:', error)
  }
}

// 计算属性：当前截图
const currentScreenshot = computed(() => {
  if (screenshots.value.length === 0) return null
  return screenshots.value[currentScreenshotIndex.value]
})

// 打开截图目录
const openScreenshotDir = () => {
  try {
    console.log('Opening screenshot directory...')
    // 获取截图保存目录
    const settings = JSON.parse(localStorage.getItem('focusflow-settings') || '{}')
    let dir = settings.screenshotDir || ''
    
    // 如果没有设置目录，使用默认目录
    console.log('settings.screenshotDir process dir:', 
    settings.screenshotDir,process.env.HOME,process.env.USERPROFILE)
    if (!dir) {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '/Users/zhaoqi'
      dir = `${homeDir}/Pictures/FocusFlow`
    }
    
    // 使用window.shellOpenPath调用preload.js中定义的方法
    if (typeof window.shellOpenPath === 'function') {
      const result = window.shellOpenPath(dir)
      if (result) {
        console.log('Opened screenshot directory:', dir)
      } else {
        console.error('Failed to open screenshot directory')
      }
    } else {
      console.error('shellOpenPath function not available')
    }
  } catch (error) {
    console.error('Failed to open screenshot directory:', error)
  }
}

// 开始/暂停截图视频播放
const startScreenshotVideo = () => {
  if (isPlaying.value) {
    // 暂停播放
    clearInterval(videoInterval.value)
    videoInterval.value = null
    isPlaying.value = false
  } else {
    // 开始播放
    if (screenshots.value.length === 0) return
    
    videoInterval.value = setInterval(() => {
      currentScreenshotIndex.value = (currentScreenshotIndex.value + 1) % screenshots.value.length
      videoProgress.value = currentScreenshotIndex.value
    }, 500) // 每500毫秒切换一张截图
    
    isPlaying.value = true
  }
}

// 压缩截图
const compressScreenshot = (imageData) => {
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

onMounted(async () => {
  try {
    console.log('onMounted called')
    await updateStats()
    console.log('onMounted completed')
  } catch (error) {
    console.error('Error in onMounted:', error)
  }
})
</script>

<style scoped>
.app {
  min-height: 100vh;
  background: #f8f9fa;
}

.app-header {
  background: white;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.app-header h1 {
  margin: 0;
  color: #2c3e50;
  font-size: 24px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover {
  background: #2980b9;
}

.btn-danger {
  background: #e74c3c;
  color: white;
}

.btn-danger:hover {
  background: #c0392b;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-secondary:hover {
  background: #7f8c8d;
}

.app-main {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: center;
}

.stat-card h3 {
  margin: 0 0 10px 0;
  color: #7f8c8d;
  font-size: 14px;
  text-transform: uppercase;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #2c3e50;
}

.charts-section,
.apps-section,
.ai-report-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.charts-section h2,
.apps-section h2,
.ai-report-section h2 {
  margin: 0 0 20px 0;
  color: #2c3e50;
}

.chart-container {
  height: 300px;
}

.apps-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.app-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

.app-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.app-icon {
  font-size: 24px;
  margin-right: 10px;
}

.app-name {
  font-weight: 500;
  color: #2c3e50;
}

.app-usage {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  max-width: 300px;
}

.usage-bar {
  flex: 1;
  height: 8px;
  background: #ecf0f1;
  border-radius: 4px;
  overflow: hidden;
}

.usage-fill {
  height: 100%;
  background: #3498db;
  transition: width 0.3s ease;
}

.usage-time {
  font-size: 12px;
  color: #7f8c8d;
  min-width: 60px;
  text-align: right;
}

.ai-report {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 6px;
  border-left: 4px solid #3498db;
}

.report-content {
  line-height: 1.6;
  color: #2c3e50;
  margin-bottom: 15px;
}

.screenshots-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.screenshots-section h2 {
  margin: 0 0 20px 0;
  color: #2c3e50;
}

.screenshots-grid {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.screenshot-item {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 6px;
  border-left: 4px solid #2ecc71;
}

.screenshot-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.screenshot-time {
  font-weight: 500;
  color: #2c3e50;
  font-size: 14px;
}

.screenshot-app {
  font-size: 14px;
  color: #7f8c8d;
  background: #ecf0f1;
  padding: 4px 8px;
  border-radius: 12px;
}

.screenshot-preview {
  width: 100%;
  max-width: 400px;
  overflow: hidden;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.screenshot-img {
  width: 100%;
  height: auto;
  display: block;
}

.screenshots-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.screenshot-path {
  font-size: 12px;
  color: #7f8c8d;
  margin-top: 5px;
  word-break: break-all;
  display: block;
}

.screenshot-video-section {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e1e5e9;
}

.screenshot-video-section h3 {
  margin: 0 0 15px 0;
  color: #2c3e50;
}

.video-controls {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #ecf0f1;
  outline: none;
  -webkit-appearance: none;
}

.progress-bar::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #3498db;
  cursor: pointer;
}

.progress-bar::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #3498db;
  cursor: pointer;
  border: none;
}

.video-preview {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 6px;
  border-left: 4px solid #3498db;
}

.video-img {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 15px;
}

.video-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.video-info span {
  font-size: 14px;
  color: #2c3e50;
}

@media (max-width: 768px) {
  .screenshot-preview {
    max-width: 100%;
  }
  
  .screenshots-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .video-controls {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  
  .video-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
}

@media (max-width: 768px) {
  .app-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .app-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .app-usage {
    width: 100%;
    max-width: none;
  }
}
</style>