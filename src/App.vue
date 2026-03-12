<template>
  <div class="app">
    <header class="app-header">
      <h1>FocusFlow 活动追踪</h1>
      <div class="header-actions">
        <!-- 日期选择器 -->
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
              
              <!-- 空白格子 -->
              <div v-for="empty in startEmptyCells" :key="'empty-' + empty" class="calendar-day empty"></div>
              
              <!-- 日期格子 -->
              <div 
                v-for="day in daysInMonth" 
                :key="day"
                :class="['calendar-day', { 'has-data': hasDataForDate(day), 'today': isToday(day), 'past': isPastDate(day), 'disabled': isFutureDate(day), 'selected': isSelectedDate(day) }]"
                @click="selectDate(day)"
              >
                {{ day }}
                <span v-if="hasDataForDate(day)" class="data-indicator"></span>
              </div>
            </div>
            <div class="calendar-footer">
              <p>点击有数据的日期查看当天活动</p>
            </div>
          </div>
        </div>
        
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

      <!-- 时间轴模块 -->
      <div class="timeline-section">
        <h2>活动时间轴</h2>
        <div class="timeline">
          <div v-for="(item, index) in timelineData" :key="index" class="timeline-item" @click="openVideoModal(item)">
            <div class="timeline-marker"></div>
            <div class="timeline-content">
              <h3 class="timeline-title">{{ item.title }}</h3>
              <p class="timeline-time">{{ item.time }}</p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 视频弹窗 -->
    <div v-if="showVideoModal" class="modal-overlay" @click="closeVideoModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ selectedTimelineItem?.title }}</h3>
          <button class="close-btn" @click="closeVideoModal">×</button>
        </div>
        <div class="modal-body">
          <div v-if="selectedTimelineItem">
            <div class="ai-summary">
              <h4>AI 小结</h4>
              <p>{{ selectedTimelineItem.summary }}</p>
              <h4>详细内容</h4>
              <p>{{ selectedTimelineItem.detail }}</p>
            </div>
            <div class="screenshot-video-section">
              <h4>截图视频</h4>
              <div class="video-controls">
                <button class="btn btn-primary" @click="startScreenshotVideo">
                  {{ isPlaying ? '暂停播放' : '开始播放' }}
                </button>
                <input type="range" v-model="videoProgress" min="0" :max="currentScreenshots.length - 1" class="progress-bar">
                <span>{{ currentScreenshotIndex + 1 }} / {{ currentScreenshots.length }}</span>
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
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ActivityTracker } from './services/ActivityTracker'
import { AIService } from './services/AIService'
import AppUsageChart from './components/AppUsageChart.vue'
import { getTodayRoundedTimes } from './utils/time'

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
const timelineData = ref([])
const showVideoModal = ref(false)
const selectedTimelineItem = ref(null)
const currentScreenshots = ref([])
const videoProgress = ref(0)
const currentScreenshotIndex = ref(0)
const videoInterval = ref(null)
const isPlaying = ref(false)

// 日历相关数据
const currentDate = ref(new Date())
const selectedDate = ref(new Date())
const showDatePicker = ref(false)
const datesWithData = ref([1, 5, 10, 15, 20, 25]) // 模拟有数据的日期

// 日历计算属性
const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth())

const daysInMonth = computed(() => {
  return new Date(currentYear.value, currentMonth.value + 1, 0).getDate()
})

const startEmptyCells = computed(() => {
  const firstDay = new Date(currentYear.value, currentMonth.value, 1).getDay()
  return firstDay
})

// 日历方法
const changeMonth = (delta) => {
  const newMonth = currentMonth.value + delta
  currentDate.value = new Date(currentYear.value, newMonth, 1)
}

const toggleDatePicker = () => {
  showDatePicker.value = !showDatePicker.value
}

const formatSelectedDate = (date) => {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

const isSelectedDate = (day) => {
  return day === selectedDate.value.getDate() && 
         currentMonth.value === selectedDate.value.getMonth() && 
         currentYear.value === selectedDate.value.getFullYear()
}

const selectDate = (day) => {
  const newDate = new Date(currentYear.value, currentMonth.value, day)
  if (!isFutureDate(day)) {
    selectedDate.value = newDate
    showDatePicker.value = false
    // 刷新所有数据模块
    refreshAllData()
  }
}

// 刷新所有数据模块
const refreshAllData = async () => {
  try {
    console.log('Refreshing all data for date:', selectedDate.value)
    await updateStats()
    await loadTimelineDataForDate(selectedDate.value)
  } catch (error) {
    console.error('Error refreshing data:', error)
  }
}

const hasDataForDate = (day) => {
  return datesWithData.value.includes(day)
}

const isToday = (day) => {
  const today = new Date()
  return day === today.getDate() && 
         currentMonth.value === today.getMonth() && 
         currentYear.value === today.getFullYear()
}

const isPastDate = (day) => {
  const checkDate = new Date(currentYear.value, currentMonth.value, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return checkDate < today
}

const isFutureDate = (day) => {
  const checkDate = new Date(currentYear.value, currentMonth.value, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return checkDate > today
}

// 加载指定日期的时间轴数据
const loadTimelineDataForDate = async (date) => {
  try {
    console.log('Loading timeline data for date:', date)
    // 这里应该从数据库中获取指定日期的时间轴数据
    // 暂时使用模拟数据
    timelineData.value = [
      {
        id: '1',
        title: `${date.getMonth() + 1}月${date.getDate()}日上午活动`,
        time: '09:00 - 10:00',
        summary: '主要使用了VS Code进行代码开发，同时使用了Chrome浏览器查阅文档。',
        details: '在这个时间段内，用户主要进行了前端代码开发工作，使用VS Code编辑了多个Vue组件文件，并通过Chrome浏览器查阅了相关的技术文档和API参考。',
        screenshots: []
      },
      {
        id: '2',
        title: `${date.getMonth() + 1}月${date.getDate()}日下午活动`,
        time: '14:00 - 15:00',
        summary: '参加了团队视频会议，讨论了项目进展和下一步计划。',
        details: '用户参加了团队的视频会议，与团队成员讨论了当前项目的进展情况，以及下一步的开发计划和任务分配。',
        screenshots: []
      }
    ]
  } catch (error) {
    console.error('Error loading timeline data for date:', error)
  }
}

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

    // 获取时间轴数据
    await loadTimelineData()
  } catch (error) {
    console.error('Error in updateStats:', error)
  }
}

// 加载时间轴数据
const loadTimelineData = async () => {
  try {
    // 这里应该从数据库中获取时间轴数据
    // 暂时使用模拟数据

    // 获取今天所有的key
    const roundedTimeList =  getTodayRoundedTimes()
    console.log('roundedTimeList:', roundedTimeList)

    // 批量获取所有时间轴数据
    const rawResults = await Promise.all(roundedTimeList.map(async (roundedTime) => {
      return await activityTracker.getTimelineData(roundedTime)
    }))

    // 过滤掉timelineDataList中空对象的数据
    // const filteredData = timelineDataList.filter(item => item.screenshots.length > 0)
    const timelineDataList = rawResults.filter(result => result !== null);
    
    console.log('timelineDataList:', timelineDataList)

    timelineData.value = timelineDataList

    // timelineData.value = [
    //   {
    //     id: '1',
    //     title: '上午工作时间',
    //     time: '09:00 - 10:00',
    //     summary: '主要使用了VS Code进行代码开发，同时使用了Chrome浏览器查阅文档。',
    //     details: '在这个时间段内，用户主要进行了前端代码开发工作，使用VS Code编辑了多个Vue组件文件，并通过Chrome浏览器查阅了相关的技术文档和API参考。',
    //     screenshots: [] // 实际应用中应该从数据库获取
    //   },
    //   {
    //     id: '2',
    //     title: '中午休息时间',
    //     time: '12:00 - 13:00',
    //     summary: '使用了Spotify听音乐，同时浏览了社交媒体。',
    //     details: '在午休时间，用户使用Spotify播放了音乐，并通过社交媒体查看了朋友的动态，短暂休息后继续工作。',
    //     screenshots: [] // 实际应用中应该从数据库获取
    //   },
    //   {
    //     id: '3',
    //     title: '下午会议时间',
    //     time: '14:00 - 15:00',
    //     summary: '参加了团队视频会议，讨论了项目进展和下一步计划。',
    //     details: '用户参加了团队的视频会议，与团队成员讨论了当前项目的进展情况，以及下一步的开发计划和任务分配。',
    //     screenshots: [] // 实际应用中应该从数据库获取
    //   }
    // ]
  } catch (error) {
    console.error('Error in loadTimelineData:', error)
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
  if (currentScreenshots.value.length === 0) return null
  return currentScreenshots.value[currentScreenshotIndex.value]
})

// 打开视频弹窗
const openVideoModal = async (item) => {
  selectedTimelineItem.value = item
  showVideoModal.value = true
  currentScreenshots.value = item.screenshots || []

  // console.log('item:', item)
  
  // 加载该时间轴项目的截图数据
  // try {
  //   // 实际应用中应该从数据库获取截图
  //   // 暂时使用模拟数据
  //   currentScreenshots.value = [
  //     {
  //       imageData: 'https://via.placeholder.com/800x600?text=Screenshot+1',
  //       time: '09:15',
  //       app: 'VS Code'
  //     },
  //     {
  //       imageData: 'https://via.placeholder.com/800x600?text=Screenshot+2',
  //       time: '09:30',
  //       app: 'Chrome'
  //     },
  //     {
  //       imageData: 'https://via.placeholder.com/800x600?text=Screenshot+3',
  //       time: '09:45',
  //       app: 'VS Code'
  //     }
  //   ]
  //   currentScreenshotIndex.value = 0
  //   videoProgress.value = 0
  // } catch (error) {
  //   console.error('Error loading screenshots for timeline item:', error)
  // }
}

// 关闭视频弹窗
const closeVideoModal = () => {
  showVideoModal.value = false
  selectedTimelineItem.value = null
  currentScreenshots.value = []
  currentScreenshotIndex.value = 0
  videoProgress.value = 0
  isPlaying.value = false
  if (videoInterval.value) {
    clearInterval(videoInterval.value)
    videoInterval.value = null
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
    if (currentScreenshots.value.length === 0) return
    
    videoInterval.value = setInterval(() => {
      currentScreenshotIndex.value = (currentScreenshotIndex.value + 1) % currentScreenshots.value.length
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
  align-items: center;
  position: relative;
}

/* 日期选择器样式 */
.date-picker-container {
  position: relative;
}

.date-picker-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 5px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  padding: 15px;
  z-index: 100;
  min-width: 300px;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.calendar-day.selected {
  background: #1976d2;
  color: white;
  font-weight: 600;
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

/* 时间轴样式 */
.timeline-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.timeline-section h2 {
  margin: 0 0 20px 0;
  color: #2c3e50;
}

.timeline {
  position: relative;
  padding-left: 30px;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 10px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #3498db;
}

.timeline-item {
  position: relative;
  margin-bottom: 25px;
  cursor: pointer;
  transition: all 0.2s;
  padding: 15px;
  border-radius: 6px;
}

.timeline-item:hover {
  background: #f8f9fa;
  transform: translateX(5px);
}

.timeline-marker {
  position: absolute;
  left: -30px;
  top: 20px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #3498db;
  border: 3px solid white;
  box-shadow: 0 0 0 2px #3498db;
}

.timeline-content {
  background: white;
  padding: 15px;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.timeline-title {
  margin: 0 0 5px 0;
  color: #2c3e50;
  font-size: 16px;
  font-weight: 600;
}

.timeline-time {
  margin: 0;
  color: #7f8c8d;
  font-size: 14px;
}

/* 日历样式 */
.calendar-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.calendar-section h2 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 18px;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.calendar-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 16px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
  margin-bottom: 15px;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s;
}

.calendar-day.header {
  font-weight: 600;
  color: #7f8c8d;
  cursor: default;
  background: #f8f9fa;
}

.calendar-day.empty {
  cursor: default;
  background: #f8f9fa;
}

.calendar-day.has-data {
  background: #e3f2fd;
  color: #1976d2;
}

.calendar-day.has-data:hover {
  background: #bbdefb;
}

.calendar-day.today {
  background: #4caf50;
  color: white;
  font-weight: 600;
}

.calendar-day.past {
  color: #2c3e50;
}

.calendar-day.disabled {
  color: #9e9e9e;
  cursor: not-allowed;
  background: #f5f5f5;
}

.data-indicator {
  position: absolute;
  bottom: 2px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #1976d2;
}

.calendar-footer {
  text-align: center;
  font-size: 14px;
  color: #7f8c8d;
}

.calendar-footer p {
  margin: 0;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e1e5e9;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #7f8c8d;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f8f9fa;
  color: #2c3e50;
}

.modal-body {
  padding: 20px;
}

.ai-summary {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 6px;
  margin-bottom: 20px;
  border-left: 4px solid #3498db;
}

.ai-summary h4 {
  margin: 0 0 10px 0;
  color: #2c3e50;
}

.ai-summary p {
  margin: 0 0 15px 0;
  color: #34495e;
  line-height: 1.5;
}

.ai-summary p:last-child {
  margin-bottom: 0;
}

/* 视频播放区域样式 */
.screenshot-video-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e1e5e9;
}

.screenshot-video-section h4 {
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

  .modal-content {
    width: 95%;
    margin: 20px;
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
  
  .header-actions {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .date-picker-dropdown {
    right: 50%;
    transform: translateX(50%);
  }
} 
</style>