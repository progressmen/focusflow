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
        <h3>
          <span>AI 设置</span>
          <span :class="['ai-status-tag', aiOverallStatus.cls]">{{ aiOverallStatus.label }}</span>
        </h3>

        <!-- 模型卡片选择 -->
        <div class="form-group">
          <label>选择 AI 模型</label>
          <div class="model-grid">
            <button
              v-for="m in modelOptions"
              :key="m.id"
              type="button"
              :class="['model-card', { active: settings.aiModel === m.id }]"
              @click="selectModel(m.id)"
            >
              <div class="model-card-row">
                <span class="model-name">{{ m.name }}</span>
                <span v-if="isModelConfigured(m.id)" class="model-badge configured" title="已配置 API Key">●</span>
                <span v-else class="model-badge unconfigured" title="未配置">○</span>
              </div>
              <div class="model-card-row">
                <span v-if="m.vision" class="model-tag vision">视觉</span>
                <span class="model-tag">{{ m.region }}</span>
              </div>
              <p class="model-desc">{{ m.description }}</p>
            </button>
          </div>
        </div>

        <!-- 选中模型后展示 Key 配置 -->
        <div v-if="settings.aiModel" class="ai-config-card">
          <div class="ai-config-header">
            <div>
              <div class="ai-config-title">{{ currentModelMeta.name }} API Key</div>
              <small class="ai-config-link">
                获取入口：
                <a :href="currentModelMeta.link" target="_blank">{{ currentModelMeta.linkLabel }}</a>
              </small>
            </div>
            <span :class="['conn-pill', connStatusInfo.cls]">
              <span class="conn-dot"></span>{{ connStatusInfo.label }}
            </span>
          </div>

          <div class="api-key-row">
            <input
              :type="showApiKey ? 'text' : 'password'"
              v-model="currentApiKey"
              :placeholder="`粘贴 ${currentModelMeta.name} API Key`"
              class="form-input api-key-input"
              autocomplete="off"
              spellcheck="false"
              @input="onApiKeyInput"
            />
            <button class="icon-btn" type="button" :title="showApiKey ? '隐藏' : '显示'" @click="showApiKey = !showApiKey">
              {{ showApiKey ? '🙈' : '👁' }}
            </button>
            <button class="icon-btn" type="button" title="从剪贴板粘贴" @click="pasteApiKey">📋</button>
            <button
              class="icon-btn"
              type="button"
              title="清除"
              :disabled="!currentApiKey"
              @click="clearApiKey"
            >🗑</button>
          </div>
          <small v-if="currentApiKey" class="form-help">
            已输入 {{ currentApiKey.length }} 字符 · 仅在本机存储，不会上传任何服务器
          </small>

          <div class="form-group model-name-group">
            <label for="ai-model-name">模型名称</label>
            <div class="model-name-row">
              <input
                id="ai-model-name"
                v-model="currentModelName"
                type="text"
                class="form-input model-name-input"
                spellcheck="false"
                autocomplete="off"
                :placeholder="`默认：${currentModelMeta.defaultModel}`"
                :list="`models-${settings.aiModel}`"
                @input="onModelNameInput"
              />
              <datalist :id="`models-${settings.aiModel}`">
                <option v-for="m in availableModels" :key="m.id" :value="m.id">{{ m.label || m.id }}</option>
              </datalist>
              <button
                class="btn btn-secondary btn-sm"
                type="button"
                :disabled="fetchingModels || !currentApiKey"
                :title="currentApiKey ? '点击获取当前账号可用的模型列表' : '请先填写 API Key'"
                @click="fetchAvailableModels"
              >
                {{ fetchingModels ? '获取中…' : '🔄 获取模型' }}
              </button>
            </div>
            <small class="form-help">
              默认模型：<code>{{ currentModelMeta.defaultModel }}</code>
              <span v-if="availableModels.length > 0"> · 已加载 {{ availableModels.length }} 个可用模型</span>
              <span v-if="currentModelName && !isCurrentModelInList" class="model-name-warn">
                · 当前使用的是自定义名称（列表外）
              </span>
            </small>
          </div>

          <div class="button-group">
            <button class="btn btn-primary" @click="saveApiKeys" :disabled="!hasUnsavedChange">
              {{ hasUnsavedChange ? '保存' : '已保存' }}
            </button>
            <button
              class="btn btn-secondary"
              @click="testConnection"
              :disabled="testing || !currentApiKey"
            >
              {{ testing ? '测试中…' : '测试连接' }}
            </button>
          </div>

          <div v-if="testResult" :class="['test-result', testResult.success ? 'success' : 'error']">
            <span class="result-icon">{{ testResult.success ? '✓' : '✗' }}</span>
            <span class="result-text">{{ testResult.message }}</span>
            <button class="result-close" type="button" @click="testResult = null">×</button>
          </div>
        </div>

        <div v-else class="ai-empty-tip">
          请先选择一个 AI 模型，再配置对应的 API Key
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
        <label for="screenshot-interval">截图间隔（秒）</label>
        <input
          id="screenshot-interval"
          v-model.number="settings.screenshotInterval"
          type="number"
          min="5"
          max="600"
          step="5"
          class="form-input"
        />
        <small class="form-help">
          每隔多少秒自动截一张屏（建议 30~120 秒；改动后会立即生效，无需重启追踪）
        </small>
      </div>
      <button class="btn btn-primary" @click="saveSettingsHandler">保存追踪设置</button>
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
      <button class="btn btn-primary" @click="saveSettingsHandler">保存设置</button>
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
import { ref, reactive, onMounted, computed } from 'vue'
import { AIService } from '../services/AIService'
import { Storage, DataManager } from '../utils/storage'
import settingsService from '../services/Settings'

const emit = defineEmits(['close', 'settings-updated'])

const aiService = new AIService()

const currentApiKey = ref('')
const categories = ref([])
const testing = ref(false)
const testResult = ref(null)
// 新增：UI 优化状态
const showApiKey = ref(false)
const savedApiKey = ref('') // 用于检测「未保存修改」状态

// 模型名称相关
const currentModelName = ref('')
const savedModelName = ref('')
const availableModels = ref([]) // 列表来自 aiService.listModels
const fetchingModels = ref(false)

// AI 模型元数据（卡片展示用）
const modelOptions = [
  {
    id: 'claude',
    name: 'Claude',
    description: 'Anthropic 的 Claude 3.5 Sonnet，视觉能力极强',
    vision: true,
    region: '海外',
    link: 'https://console.anthropic.com/',
    linkLabel: 'Anthropic Console',
    defaultModel: 'claude-3-5-sonnet-20241022'
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    description: '国产多模态大模型，截图分析效果不错',
    vision: true,
    region: '国内',
    link: 'https://www.minimaxi.com/',
    linkLabel: 'MiniMax Console',
    defaultModel: 'MiniMax-M2.7'
  },
  {
    id: 'kimi',
    name: 'Kimi',
    description: 'Moonshot 出品，国内访问稳定，支持视觉',
    vision: true,
    region: '国内',
    link: 'https://platform.moonshot.cn/',
    linkLabel: 'Moonshot Console',
    defaultModel: 'moonshot-v1-32k-vision-preview'
  }
]

// 当前选中模型的元数据
const currentModelMeta = computed(() => {
  return modelOptions.find((m) => m.id === settings.aiModel) || {
    name: '',
    description: '',
    vision: false,
    region: '',
    link: '',
    linkLabel: '',
    defaultModel: ''
  }
})

// 总体 AI 配置状态徽标
const aiOverallStatus = computed(() => {
  if (!settings.aiModel) return { label: '未配置', cls: 'tag-warn' }
  const all = settingsService.loadSettings()
  const k = all.apiKeys?.[settings.aiModel]
  if (!k) return { label: '缺少 API Key', cls: 'tag-warn' }
  return { label: '已配置', cls: 'tag-ok' }
})

// 单个模型是否已配置 API Key
function isModelConfigured(id) {
  try {
    const all = settingsService.loadSettings()
    return !!(all.apiKeys && all.apiKeys[id])
  } catch (e) {
    return false
  }
}

// 是否存在未保存的修改
const hasUnsavedChange = computed(() => {
  return currentApiKey.value !== savedApiKey.value || currentModelName.value !== savedModelName.value
})

// 当前填写的模型名是否在已获取的列表里（用于 UI 提示）
const isCurrentModelInList = computed(() => {
  if (!currentModelName.value) return true
  return availableModels.value.some((m) => m.id === currentModelName.value)
})

// 当前模型的连接状态（基于本会话的测试结果 + 是否已保存）
const connStatusInfo = computed(() => {
  if (!currentApiKey.value) return { label: '未填写', cls: 'pill-gray' }
  if (testResult.value && testResult.value.success) return { label: '连接正常', cls: 'pill-ok' }
  if (testResult.value && !testResult.value.success) return { label: '连接异常', cls: 'pill-err' }
  if (hasUnsavedChange.value) return { label: '未保存', cls: 'pill-warn' }
  return { label: '已保存', cls: 'pill-info' }
})

// 选择模型时同步当前 API Key
function selectModel(id) {
  if (settings.aiModel === id) return
  // 切模型若有未保存内容，提示
  if (hasUnsavedChange.value && (currentApiKey.value || currentModelName.value)) {
    if (!window.confirm(`切换模型会丢失尚未保存的 ${currentModelMeta.value.name || '当前'} API Key / 模型名修改，确定继续？`)) {
      return
    }
  }
  settings.aiModel = id
  testResult.value = null
  showApiKey.value = false
  const apiKey = settingsService.loadApiKey(id) || ''
  currentApiKey.value = apiKey
  savedApiKey.value = apiKey
  const modelName = settingsService.loadAiModelName(id) || ''
  currentModelName.value = modelName
  savedModelName.value = modelName
  // 切换 provider 时清空已获取的模型列表（避免跨 provider 残留）
  availableModels.value = []
}

function onApiKeyInput() {
  // 一旦修改 → 清掉上一次的测试结果
  testResult.value = null
}

function onModelNameInput() {
  // 模型名变化时清掉上一次的测试结果（避免「测试时用的旧模型」误导）
  testResult.value = null
}

async function pasteApiKey() {
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      currentApiKey.value = text.trim()
      onApiKeyInput()
    } else {
      utools?.showNotification?.('剪贴板为空')
    }
  } catch (e) {
    utools?.showNotification?.('无法读取剪贴板，请手动粘贴')
  }
}

function clearApiKey() {
  if (!currentApiKey.value) return
  if (!window.confirm('确定清除当前 API Key 输入？（保存后才会真正生效）')) return
  currentApiKey.value = ''
  testResult.value = null
}

const settings = reactive({
  autoStart: false,
  notifications: true,
  screenshotInterval: 30,
  screenshotDir: '',
  defaultCategory: '',
  aiModel: ''
})

// 加载分类设置
const loadCategories = () => {
  const savedCategories = settingsService.loadCategories()
  categories.value = savedCategories
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
  const allSettings = settingsService.loadSettings()
  allSettings.categories = categories.value
  allSettings.defaultCategory = settings.defaultCategory
  const success = settingsService.saveSettings(allSettings)
  emit('settings-updated', settings)
  if (typeof utools !== 'undefined' && typeof utools.showNotification === 'function') {
    utools.showNotification(success ? '分类设置已保存' : '分类设置保存失败')
  }
}

const loadSettings = () => {
  const allSettings = settingsService.loadSettings()
  console.log('[FocusFlow] SettingsPanel loadSettings:', allSettings)
  // 只取当前面板需要双向绑定的字段，避免把 _id/_rev/apiKeys/categories 等灌进 reactive
  const ownKeys = [
    'autoStart',
    'notifications',
    'screenshotInterval',
    'screenshotDir',
    'defaultCategory',
    'aiModel'
  ]
  ownKeys.forEach((k) => {
    if (allSettings[k] !== undefined) settings[k] = allSettings[k]
  })

  if (allSettings.aiModel && allSettings.apiKeys) {
    currentApiKey.value = allSettings.apiKeys[allSettings.aiModel] || ''
    savedApiKey.value = currentApiKey.value
  } else {
    currentApiKey.value = ''
    savedApiKey.value = ''
  }
  // 加载当前 provider 的自定义模型名
  if (allSettings.aiModel) {
    const name = (allSettings.aiModelNames && allSettings.aiModelNames[allSettings.aiModel]) || ''
    currentModelName.value = name
    savedModelName.value = name
  } else {
    currentModelName.value = ''
    savedModelName.value = ''
  }
}

const saveApiKeys = () => {
  console.log('saveApiKeys called, settings:', settings)
  if (!settings.aiModel) {
    if (typeof utools !== 'undefined' && typeof utools.showNotification === 'function') {
      utools.showNotification('请先选择 AI 模型')
    }
    return
  }

  const success = settingsService.saveApiKey(settings.aiModel, currentApiKey.value)
  if (!success) {
    if (typeof utools !== 'undefined' && typeof utools.showNotification === 'function') {
      utools.showNotification('保存 API Key 失败')
    }
    return
  }

  // 同步保存当前 provider 的模型名（允许空 —— 退回默认）
  settingsService.saveAiModelName(settings.aiModel, currentModelName.value || '')

  // 同步「已保存」基线
  savedApiKey.value = currentApiKey.value
  savedModelName.value = currentModelName.value
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
  console.log('testConnection called, settings:', settings)
  try {
    const res = await aiService.pingModel(settings.aiModel, currentApiKey.value)
    if (res.ok) {
      testResult.value = {
        success: true,
        message: `连接成功（已用 ${res.model} 验证）`
      }
    } else {
      testResult.value = {
        success: false,
        message: res.message || '连接失败，请检查 API Key'
      }
    }
  } catch (error) {
    testResult.value = {
      success: false,
      message: error.message || '连接失败'
    }
  }

  testing.value = false
}

/**
 * 通过 provider 的 /models 端点（或内置列表）拉取可用模型
 * 结果会作为 datalist 提供给模型名称输入框
 */
async function fetchAvailableModels() {
  if (!settings.aiModel) {
    testResult.value = { success: false, message: '请先选择模型' }
    return
  }
  if (!currentApiKey.value) {
    testResult.value = { success: false, message: '请先填写 API Key' }
    return
  }
  fetchingModels.value = true
  console.log('fetchAvailableModels:', settings.aiModel)
  try {
    const list = await aiService.listModels(settings.aiModel, currentApiKey.value)
    availableModels.value = list
    testResult.value = {
      success: true,
      message: `已获取 ${list.length} 个可用模型`
    }
  } catch (e) {
    console.error('fetchAvailableModels 失败：', e)
    availableModels.value = []
    testResult.value = {
      success: false,
      message: '获取模型列表失败：' + ((e && e.message) || String(e || '未知错误'))
    }
  } finally {
    fetchingModels.value = false
  }
}

const saveSettingsHandler = () => {
  // 必须基于「db 中的完整 settings」进行合并，否则会把 apiKeys/categories 等字段抹掉
  const full = settingsService.loadSettings() || {}
  const merged = {
    ...full,
    autoStart: settings.autoStart,
    notifications: settings.notifications,
    screenshotInterval: settings.screenshotInterval,
    screenshotDir: settings.screenshotDir,
    defaultCategory: settings.defaultCategory,
    aiModel: settings.aiModel
  }
  // 兜底清掉 PouchDB 元字段（service 层也会再剥一次）
  delete merged._id
  delete merged._rev

  console.log('[FocusFlow] saveSettingsHandler 写入：', merged)
  const success = settingsService.saveSettings(merged)
  emit('settings-updated', merged)
  if (typeof utools !== 'undefined' && typeof utools.showNotification === 'function') {
    utools.showNotification(success ? '设置已保存' : '设置保存失败，请查看控制台')
  }
  // 重新读一次，确保 UI 与磁盘一致（也修复了之前面板里 reactive 状态的脏数据）
  loadSettings()
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
  console.log('SettingsPanel mounted')
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
  align-items: stretch;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
  box-sizing: border-box;
}

.settings-container {
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

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #e1e5e9;
  background: white;
  flex-shrink: 0;
}

.settings-header h2 {
  margin: 0;
  color: #2c3e50;
  font-size: 18px;
}

.settings-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(440px, 1fr));
  gap: 20px;
  align-content: start;
  background: #f8f9fa;
}

.settings-section {
  padding: 20px;
  background: white;
  border-radius: 10px;
  border: 1px solid #ecf0f1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.settings-section:last-child {
  border-bottom: 1px solid #ecf0f1;
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
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
  position: relative;
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
.result-close {
  margin-left: auto;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  opacity: 0.6;
}
.result-close:hover { opacity: 1; }

/* ========== AI 设置区域优化样式 ========== */

.settings-section h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: space-between;
}

.ai-status-tag {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 10px;
  font-weight: 500;
}
.ai-status-tag.tag-ok { background: #e8f8f0; color: #27ae60; }
.ai-status-tag.tag-warn { background: #fff4e0; color: #d68910; }

.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}
.model-card {
  background: white;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
  font-family: inherit;
}
.model-card:hover {
  border-color: #3498db;
  background: #f8fbfd;
}
.model-card.active {
  border-color: #3498db;
  background: #ebf5fb;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.15);
}
.model-card-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.model-card-row:last-of-type { margin-bottom: 8px; }
.model-name {
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
  flex: 1;
}
.model-badge {
  font-size: 12px;
  line-height: 1;
}
.model-badge.configured { color: #27ae60; }
.model-badge.unconfigured { color: #bdc3c7; }
.model-tag {
  font-size: 10px;
  padding: 1px 6px;
  background: #ecf0f1;
  color: #7f8c8d;
  border-radius: 8px;
  font-weight: 500;
}
.model-tag.vision { background: #f3e5f5; color: #8e44ad; }
.model-desc {
  margin: 0;
  font-size: 11px;
  color: #95a5a6;
  line-height: 1.4;
}

.ai-config-card {
  margin-top: 14px;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #ecf0f1;
}
.ai-config-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}
.ai-config-title {
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 2px;
}
.ai-config-link {
  color: #7f8c8d;
  font-size: 11px;
}
.ai-config-link a { color: #3498db; }

.conn-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  font-size: 11px;
  border-radius: 10px;
  font-weight: 500;
  white-space: nowrap;
}
.conn-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.conn-pill.pill-gray { background: #ecf0f1; color: #95a5a6; }
.conn-pill.pill-info { background: #ebf5fb; color: #2980b9; }
.conn-pill.pill-warn { background: #fef5e7; color: #d68910; }
.conn-pill.pill-ok { background: #e8f8f0; color: #27ae60; }
.conn-pill.pill-err { background: #fdedec; color: #c0392b; }

.api-key-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.api-key-input {
  flex: 1;
  font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace;
  font-size: 13px;
  letter-spacing: 0.5px;
}

.model-name-group {
  margin-top: 12px;
}
.model-name-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.model-name-input {
  flex: 1;
  font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace;
  font-size: 13px;
  letter-spacing: 0.3px;
}
.model-name-input::placeholder {
  color: #bdc3c7;
  font-style: italic;
}
.model-name-warn {
  color: #d68910 !important;
}
.form-help code {
  background: #ecf0f1;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  color: #34495e;
}
.icon-btn {
  width: 34px;
  height: 34px;
  border: 1px solid #d0d7de;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  padding: 0;
}
.icon-btn:hover:not(:disabled) {
  border-color: #3498db;
  background: #f8fbfd;
}
.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ai-empty-tip {
  margin-top: 12px;
  padding: 14px;
  text-align: center;
  font-size: 13px;
  color: #95a5a6;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px dashed #d0d7de;
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
  .settings-panel {
    padding: 0;
  }
  .settings-container {
    border-radius: 0;
  }
  .settings-content {
    grid-template-columns: 1fr;
    padding: 12px;
    gap: 12px;
  }
  .settings-section {
    padding: 16px;
  }
}
</style>
