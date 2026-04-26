<template>
  <div class="settings-panel">
    <div class="settings-container">
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
          <label for="ai-model">AI 模型</label>
          <select id="ai-model" v-model="settings.aiModel" class="form-input" @change="onModelChange">
            <option value="">选择 AI 模型</option>
            <option value="claude">Claude</option>
            <option value="minimax">MiniMax</option>
            <option value="kimi">Kimi</option>
          </select>
        </div>

        <div class="form-group" v-if="settings.aiModel === 'claude'">
          <label for="api-key">Claude API Key</label>
          <input
            id="api-key"
            v-model="currentApiKey"
            type="password"
            placeholder="请输入 Claude API Key"
            class="form-input"
          />
          <small class="form-help">
            获取 API Key: <a href="https://console.anthropic.com/" target="_blank">Anthropic Console</a>
          </small>
        </div>

        <div class="form-group" v-if="settings.aiModel === 'minimax'">
          <label for="api-key">MiniMax API Key</label>
          <input
            id="api-key"
            v-model="currentApiKey"
            type="password"
            placeholder="请输入 MiniMax API Key"
            class="form-input"
          />
          <small class="form-help">
            获取 API Key: <a href="https://www.minimaxi.com/" target="_blank">MiniMax Console</a>
          </small>
        </div>

        <div class="form-group" v-if="settings.aiModel === 'kimi'">
          <label for="api-key">Kimi API Key</label>
          <input
            id="api-key"
            v-model="currentApiKey"
            type="password"
            placeholder="请输入 Kimi API Key"
            class="form-input"
          />
          <small class="form-help">
            获取 API Key: <a href="https://platform.moonshot.cn/" target="_blank">Moonshot Console</a>
          </small>
        </div>

        <div class="button-group">
          <button class="btn btn-primary" @click="saveApiKeys">保存</button>
          <button class="btn btn-secondary" @click="testConnection" :disabled="testing || !settings.aiModel">
            {{ testing ? '测试中...' : '测试连接' }}
          </button>
        </div>

        <div v-if="testResult" :class="['test-result', testResult.success ? 'success' : 'error']">
          <span class="result-icon">{{ testResult.success ? '✓' : '✗' }}</span>
          <span class="result-text">{{ testResult.message }}</span>
        </div>
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
    </div>

    <div class="settings-section">
      <h3>截图设置</h3>
      <div class="form-group">
        <label for="screenshot-dir">截图保存目录</label>
        <input
          id="screenshot-dir"
          v-model="settings.screenshotDir"
          type="text"
          class="form-input"
        />
        <button class="btn btn-secondary mt-2" @click="selectScreenshotDir">选择目录</button>
      </div>
      <button class="btn btn-primary" @click="saveSettings">保存设置</button>
    </div>

    <div class="settings-section">
      <h3>分类设置</h3>
      <p class="section-help">配置活动分类，用于AI判断应用属于哪个分类</p>
      <div class="form-group">
        <div class="flex justify-between items-center mb-2">
          <label>分类列表</label>
          <button class="btn btn-primary btn-sm" @click="addCategory">
            添加分类
          </button>
        </div>
        <div v-if="categories.length === 0" class="empty-state">
          暂无分类，点击添加分类
        </div>
        <div v-else class="category-list">
          <div v-for="(category, index) in categories" :key="index" class="category-item">
            <div class="category-header">
              <input
                v-model="category.color"
                type="color"
                class="category-color"
              />
              <input
                v-model="category.name"
                type="text"
                class="form-input category-name"
                placeholder="分类名称"
              />
            </div>
            <textarea
              v-model="category.description"
              class="form-input category-desc"
              placeholder="分类描述（用于AI判断，如：包含浏览器、聊天工具等）"
              rows="2"
            ></textarea>
            <div class="category-actions">
              <button
                class="btn btn-secondary btn-sm"
                @click="removeCategory(index)"
                :disabled="categories.length <= 1"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="form-group">
        <label for="default-category">默认分类</label>
        <select
          id="default-category"
          v-model="settings.defaultCategory"
          class="form-input"
        >
          <option value="">选择默认分类</option>
          <option
            v-for="category in categories"
            :key="category.name"
            :value="category.name"
          >
            {{ category.name }}
          </option>
        </select>
      </div>
      <button class="btn btn-primary" @click="saveCategories">保存分类设置</button>
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { AIService } from '../services/AIService'
import { Storage, DataManager } from '../utils/storage'

const emit = defineEmits(['close', 'settings-updated'])

const aiService = new AIService()

const currentApiKey = ref('')
const categories = ref([])
const testing = ref(false)
const testResult = ref(null)

const settings = reactive({
  autoStart: false,
  notifications: true,
  checkInterval: 1,
  screenshotDir: '',
  defaultCategory: '',
  aiModel: ''
})

// 加载分类设置
const loadCategories = () => {
  if (typeof window.getSettingsFromDb === 'function') {
    const savedSettings = window.getSettingsFromDb()
    if (savedSettings.categories && savedSettings.categories.length > 0) {
      categories.value = savedSettings.categories
    } else {
      categories.value = [
        { name: '个人', color: '#3498db', description: '包含社交媒体、聊天工具、音乐、视频等个人娱乐应用' },
        { name: '工作', color: '#2ecc71', description: '包含开发工具、文档处理、邮件、项目管理等工作相关应用' },
        { name: '非专注', color: '#e74c3c', description: '包含游戏、无关浏览、娱乐视频等让人分心的应用' }
      ]
    }
  } else {
    categories.value = [
      { name: '个人', color: '#3498db', description: '包含社交媒体、聊天工具、音乐、视频等个人娱乐应用' },
      { name: '工作', color: '#2ecc71', description: '包含开发工具、文档处理、邮件、项目管理等工作相关应用' },
      { name: '非专注', color: '#e74c3c', description: '包含游戏、无关浏览、娱乐视频等让人分心的应用' }
    ]
  }
}

const addCategory = () => {
  categories.value.push({ name: '', color: '#95a5a6', description: '' })
}

const removeCategory = (index) => {
  if (categories.value.length > 1) {
    categories.value.splice(index, 1)
  }
}

const saveCategories = () => {
  if (typeof window.saveSettingsToDb === 'function') {
    const savedSettings = window.getSettingsFromDb() || {}
    savedSettings.categories = categories.value
    savedSettings.defaultCategory = settings.defaultCategory
    window.saveSettingsToDb(savedSettings)
  } else {
    Storage.set('focusflow-categories', categories.value)
    Storage.set('focusflow-defaultCategory', settings.defaultCategory)
  }
  emit('settings-updated', settings)
  if (typeof utools !== 'undefined' && typeof utools.showNotification === 'function') {
    utools.showNotification('分类设置已保存')
  }
}

const loadSettings = () => {
  if (typeof window.getSettingsFromDb === 'function') {
    const savedSettings = window.getSettingsFromDb()
    Object.assign(settings, savedSettings)
    if (savedSettings.apiKey) {
      currentApiKey.value = savedSettings.apiKey
    }
  } else {
    const savedSettings = Storage.get('focusflow-settings', {})
    Object.assign(settings, savedSettings)
    const savedApiKey = Storage.get('focusflow-api-key', '')
    if (savedApiKey) {
      currentApiKey.value = savedApiKey
    }
  }
}

const onModelChange = () => {
  testResult.value = null
  if (settings.aiModel) {
    if (typeof window.getSettingsFromDb === 'function') {
      const savedSettings = window.getSettingsFromDb() || {}
      const apiKeys = savedSettings.apiKeys || {}
      currentApiKey.value = apiKeys[settings.aiModel] || ''
    } else {
      const savedApiKeys = Storage.get('focusflow-api-keys', {})
      currentApiKey.value = savedApiKeys[settings.aiModel] || ''
    }
  } else {
    currentApiKey.value = ''
  }
}

const saveApiKeys = () => {
  if (!settings.aiModel) {
    if (typeof utools !== 'undefined' && typeof utools.showNotification === 'function') {
      utools.showNotification('请先选择 AI 模型')
    }
    return
  }

  if (typeof window.saveSettingsToDb === 'function') {
    const savedSettings = window.getSettingsFromDb() || {}
    if (!savedSettings.apiKeys) {
      savedSettings.apiKeys = {}
    }
    savedSettings.apiKeys[settings.aiModel] = currentApiKey.value
    savedSettings.aiModel = settings.aiModel
    window.saveSettingsToDb(savedSettings)
  } else {
    const savedApiKeys = Storage.get('focusflow-api-keys', {})
    savedApiKeys[settings.aiModel] = currentApiKey.value
    Storage.set('focusflow-api-keys', savedApiKeys)
    Storage.set('focusflow-ai-model', settings.aiModel)
  }
  emit('settings-updated', settings)
  if (typeof utools !== 'undefined' && typeof utools.showNotification === 'function') {
    utools.showNotification('设置已保存')
  }
}

const testConnection = async () => {
  if (!settings.aiModel || !currentApiKey.value) {
    testResult.value = { success: false, message: '请选择模型并输入 API Key' }
    return
  }

  testing.value = true
  testResult.value = null

  try {
    let success = false
    if (settings.aiModel === 'claude') {
      success = await testClaude()
    } else if (settings.aiModel === 'minimax') {
      success = await testMiniMax()
    } else if (settings.aiModel === 'kimi') {
      success = await testKimi()
    }

    testResult.value = {
      success,
      message: success ? '连接成功' : '连接失败，请检查 API Key'
    }
  } catch (error) {
    testResult.value = {
      success: false,
      message: error.message || '连接失败'
    }
  }

  testing.value = false
}

const testClaude = async () => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': currentApiKey.value,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      })
    })
    return response.ok
  } catch (error) {
    throw new Error('网络错误')
  }
}

const testMiniMax = async () => {
  try {
    const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_pro', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentApiKey.value}`
      },
      body: JSON.stringify({
        model: 'abab5.5-chat',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      })
    })
    return response.ok
  } catch (error) {
    throw new Error('网络错误')
  }
}

const testKimi = async () => {
  try {
    const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentApiKey.value}`
      },
      body: JSON.stringify({
        model: 'moonshot-v1-8k',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      })
    })
    return response.ok
  } catch (error) {
    throw new Error('网络错误')
  }
}

const saveSettings = () => {
  if (typeof window.saveSettingsToDb === 'function') {
    window.saveSettingsToDb(settings)
  } else {
    Storage.set('focusflow-settings', { ...settings })
  }
  emit('settings-updated', settings)
  if (typeof utools !== 'undefined' && typeof utools.showNotification === 'function') {
    utools.showNotification('设置已保存')
  }
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

const selectScreenshotDir = () => {
  try {
    if (typeof utools !== 'undefined' && typeof utools.showOpenDialog === 'function') {
      utools.showOpenDialog({
        title: '选择截图保存目录',
        properties: ['openDirectory']
      }, (files) => {
        if (files && files.length > 0) {
          settings.screenshotDir = files[0]
        }
      })
    } else {
      const defaultDir = process.env.HOME || process.env.USERPROFILE
      const screenshotsDir = `${defaultDir}/Pictures/FocusFlow`
      settings.screenshotDir = screenshotsDir
    }
  } catch (error) {
    // Silent fail
  }
}

onMounted(() => {
  loadSettings()
  loadCategories()
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

.settings-container {
  background: white;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e1e5e9;
  background: white;
}

.settings-header h2 {
  margin: 0;
  color: #2c3e50;
}

.settings-content {
  max-height: calc(80vh - 70px);
  overflow-y: auto;
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

.button-group {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.test-result {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
}

.test-result.success {
  background: #d4edda;
  color: #155724;
}

.test-result.error {
  background: #f8d7da;
  color: #721c24;
}

.result-icon {
  font-weight: bold;
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

.btn-secondary:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.btn-danger {
  background: #e74c3c;
  color: white;
}

.btn-danger:hover {
  background: #c0392b;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.flex {
  display: flex;
}

.justify-between {
  justify-content: space-between;
}

.items-center {
  align-items: center;
}

.mb-2 {
  margin-bottom: 8px;
}

.section-help {
  font-size: 12px;
  color: #7f8c8d;
  margin: 0 0 15px 0;
}

.empty-state {
  padding: 20px;
  text-align: center;
  color: #7f8c8d;
  background: #f8f9fa;
  border-radius: 4px;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-height: 300px;
  overflow-y: auto;
}

.category-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.category-header {
  display: flex;
  gap: 8px;
  align-items: center;
}

.category-color {
  width: 40px;
  height: 32px;
  padding: 0;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.category-name {
  flex: 1;
}

.category-desc {
  width: 100%;
  resize: vertical;
  min-height: 60px;
}

.category-actions {
  display: flex;
  justify-content: flex-end;
}

.category-actions .btn {
  margin-left: 8px;
}

@media (max-width: 768px) {
  .settings-content {
    width: 95%;
    max-height: 90vh;
  }
}
</style>
