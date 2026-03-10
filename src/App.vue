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
              <img :src="app.icon" :alt="app.name" class="app-icon">
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

const isTracking = ref(false)
const todayStats = ref({
  totalTime: 0,
  activeApps: 0,
  appSwitches: 0,
  focusScore: 0
})

const topApps = ref([])
const chartData = ref([])
const aiReport = ref('')

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
    utools?.showNotification('报告已复制到剪贴板')
  } catch (error) {
    console.error('Error in copyReport:', error)
  }
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
  width: 24px;
  height: 24px;
  border-radius: 4px;
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