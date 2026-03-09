<template>
  <div class="settings-panel">
    <div class="settings-header">
      <h2>设置</h2>
      <button class="btn btn-secondary" @click="$emit('close')">
        关闭
      </button>
    </div>

    <div class="settings-content">
      <div class="settings-section">
        <h3>AI 设置</h3>
        <div class="form-group">
          <label for="api-key">Claude API Key</label>
          <input
            id="api-key"
            v-model="apiKey"
            type="password"
            placeholder="请输入 Claude API Key"
            class="form-input"
          />
          <small class="form-help">
            获取 API Key: <a href="https://console.anthropic.com/" target="_blank">Anthropic Console</a>
          </small>
        </div>
        <button class="btn btn-primary" @click="saveApiKey">保存 API Key</button>
      </div>

      <div class="settings-section">
        <h3>追踪设置</h3>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="settings.autoStart" />
            自动开始追踪
          </label>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="settings.notifications" />
            启用通知提醒
          </label>
        </div>
        <div class="form-group">
          <label for="check-interval">检查间隔（秒）</label>
          <input
            id="check-interval"
            v-model.number="settings.checkInterval"
            type="number"
            min="1"
            max="60"
            class="form-input"
          />
        </div>
        <button class="btn btn-primary" @click="saveSettings">保存设置</button>
      </div>

      <div class="settings-section">
        <h3>数据管理</h3>
        <div class="data-actions">
          <button class="btn btn-secondary" @click="exportData">
            导出数据
          </button>
          <button class="btn btn-secondary" @click="importData">
            导入数据
          </button>
          <button class="btn btn-danger" @click="clearData">
            清除所有数据
          </button>
        </div>
      </div>

      <div class="settings-section">
        <h3>关于</h3>
        <div class="about-info">
          <p><strong>版本:</strong> 1.0.0</p>
          <p><strong>开发者:</strong> Your Name</p>
          <p><strong>描述:</strong> 智能电脑活动追踪和AI总结工具</p>
          <p>
            <a href="#" @click.prevent="openHomepage">项目主页</a> |
            <a href="#" @click.prevent="reportIssue">反馈问题</a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { AIService } from '../services/AIService'
import { Storage, DataManager } from '../utils/storage'

const emit = defineEmits(['close', 'settings-updated'])

const aiService = new AIService()
const apiKey = ref('')

const settings = reactive({
  autoStart: false,
  notifications: true,
  checkInterval: 1
})

const loadSettings = () => {
  const savedSettings = Storage.get('focusflow-settings', {})
  Object.assign(settings, savedSettings)

  const savedApiKey = localStorage.getItem('focusflow-ai-api-key')
  if (savedApiKey) {
    apiKey.value = savedApiKey
  }
}

const saveApiKey = () => {
  aiService.setApiKey(apiKey.value)
  utools?.showNotification('API Key 已保存')
}

const saveSettings = () => {
  Storage.set('focusflow-settings', { ...settings })
  emit('settings-updated', settings)
  utools?.showNotification('设置已保存')
}

const exportData = () => {
  const data = DataManager.export()
  DataManager.download(data)
}

const importData = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result)
          if (DataManager.import(data)) {
            utools?.showNotification('数据导入成功')
            emit('close')
          } else {
            utools?.showNotification('数据导入失败')
          }
        } catch (error) {
          utools?.showNotification('文件格式错误')
        }
      }
      reader.readAsText(file)
    }
  }
  input.click()
}

const clearData = () => {
  if (confirm('确定要清除所有数据吗？此操作不可恢复。')) {
    Storage.clear()
    utools?.showNotification('数据已清除')
    emit('close')
  }
}

const openHomepage = () => {
  if (utools) {
    utools.shellOpenExternal('https://github.com/yourname/focusflow')
  }
}

const reportIssue = () => {
  if (utools) {
    utools.shellOpenExternal('https://github.com/yourname/focusflow/issues')
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.settings-panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e1e5e9;
  background: white;
  border-radius: 8px 8px 0 0;
}

.settings-header h2 {
  margin: 0;
  color: #2c3e50;
}

.settings-content {
  background: white;
  border-radius: 0 0 8px 8px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.settings-section {
  padding: 20px;
  border-bottom: 1px solid #f1f3f4;
}

.settings-section:last-child {
  border-bottom: none;
}

.settings-section h3 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 16px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #2c3e50;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-input:focus {
  border-color: #3498db;
  outline: none;
}

.form-help {
  font-size: 12px;
  color: #7f8c8d;
  margin-top: 5px;
}

.form-help a {
  color: #3498db;
  text-decoration: none;
}

.form-help a:hover {
  text-decoration: underline;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  margin: 0;
}

.data-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.about-info {
  font-size: 14px;
  line-height: 1.6;
}

.about-info a {
  color: #3498db;
  text-decoration: none;
  margin: 0 5px;
}

.about-info a:hover {
  text-decoration: underline;
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

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-secondary:hover {
  background: #7f8c8d;
}

.btn-danger {
  background: #e74c3c;
  color: white;
}

.btn-danger:hover {
  background: #c0392b;
}

@media (max-width: 768px) {
  .settings-content {
    width: 95%;
    max-height: 90vh;
  }
}
</style>