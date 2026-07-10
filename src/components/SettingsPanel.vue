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
          <span>AI 模型</span>
          <span :class="['ai-status-tag', aiOverallStatus.cls]">{{ aiOverallStatus.label }}</span>
        </h3>

        <!-- 当前激活的 provider 概览 -->
        <div v-if="activeProvider" class="active-provider-card">
          <div class="active-provider-info">
            <span class="active-provider-label">当前使用</span>
            <span class="active-provider-name">{{ activeProvider.name }}</span>
            <span class="active-provider-meta">
              <code>{{ activeProvider.model || '未指定' }}</code>
              <span class="provider-type-tag" :class="`type-${activeProvider.type}`">
                {{ activeProvider.type === 'preset' ? '常用' : activeProvider.type === 'local' ? '本地' : '自定义' }}
              </span>
              <span v-if="activeProvider.vision" class="provider-type-tag vision">视觉</span>
            </span>
          </div>
        </div>
        <div v-else class="active-provider-card empty">
          尚未配置任何 AI 模型，请点击下方「+ 添加模型」开始配置。
        </div>

        <!-- 我的模型列表 -->
        <div v-if="providers.length > 0" class="provider-list">
          <div
            v-for="p in providers"
            :key="p.id"
            :class="['provider-row', { active: p.id === activeProviderId }]"
          >
            <div class="provider-row-main" @click="activateProvider(p.id)">
              <div class="provider-row-title">
                <span v-if="p.id === activeProviderId" class="provider-active-dot">●</span>
                <span class="provider-row-name">{{ p.name }}</span>
                <span class="provider-type-tag" :class="`type-${p.type}`">
                  {{ p.type === 'preset' ? '常用' : p.type === 'local' ? '本地' : '自定义' }}
                </span>
                <span v-if="p.vision" class="provider-type-tag vision">视觉</span>
              </div>
              <div class="provider-row-meta">
                <code class="provider-row-model">{{ p.model || '未指定模型' }}</code>
                <span v-if="p.protocol === 'openai' && p.baseURL" class="provider-row-url" :title="p.baseURL">
                  {{ p.baseURL }}
                </span>
                <span v-if="!p.apiKey && p.protocol === 'claude'" class="provider-warn">⚠ 缺 Key</span>
              </div>
            </div>
            <div class="provider-row-actions">
              <button class="btn-mini" type="button" title="编辑" @click="editProvider(p)">✎</button>
              <button class="btn-mini danger" type="button" title="删除" @click="deleteProvider(p)">🗑</button>
            </div>
          </div>
        </div>

        <!-- 添加模型按钮区 -->
        <div class="add-provider-bar">
          <button
            v-if="!showAddMenu && !providerForm.show"
            class="btn btn-primary"
            type="button"
            @click="showAddMenu = true"
          >
            + 添加模型
          </button>
          <div v-if="showAddMenu" class="add-menu">
            <button class="add-menu-item" type="button" @click="openAddPanel('preset')">
              <span class="add-menu-icon">⭐</span>
              <span class="add-menu-text">
                <strong>常用模型</strong>
                <small>OpenAI · Claude · Kimi · DeepSeek · 智谱 · 通义 · 豆包 · MiniMax</small>
              </span>
            </button>
            <button class="add-menu-item" type="button" @click="openAddPanel('custom')">
              <span class="add-menu-icon">⚙️</span>
              <span class="add-menu-text">
                <strong>自定义模型</strong>
                <small>任意 OpenAI 兼容服务，自定义 baseURL + API Key</small>
              </span>
            </button>
            <button class="add-menu-item" type="button" @click="openAddPanel('local')">
              <span class="add-menu-icon">💻</span>
              <span class="add-menu-text">
                <strong>本地模型</strong>
                <small>Ollama / LM Studio / vLLM 等本地推理服务</small>
              </span>
            </button>
            <button class="btn btn-secondary btn-sm cancel-add" type="button" @click="showAddMenu = false">
              取消
            </button>
          </div>
        </div>

        <!-- 添加/编辑表单 -->
        <div v-if="providerForm.show" class="provider-form">
          <div class="provider-form-header">
            <h4>{{ providerForm.editing ? '编辑模型' : '添加模型' }}</h4>
            <button class="close-btn" type="button" @click="closeProviderForm">×</button>
          </div>

          <!-- 常用模型预设选择 -->
          <div v-if="providerForm.mode === 'preset'" class="form-group">
            <label>选择服务商</label>
            <div class="preset-grid">
              <button
                v-for="(meta, key) in presetCatalog"
                :key="key"
                type="button"
                :class="['preset-card', { active: providerForm.presetKey === key }]"
                @click="applyPresetTemplate(key, meta)"
              >
                <span class="preset-name">{{ meta.name }}</span>
                <span class="preset-tags">
                  <span v-if="meta.vision" class="provider-type-tag vision">视觉</span>
                  <span v-if="meta.protocol === 'claude'" class="provider-type-tag">Claude SDK</span>
                  <span v-else class="provider-type-tag">OpenAI 兼容</span>
                </span>
              </button>
            </div>
          </div>

          <!-- 本地预设选择 -->
          <div v-if="providerForm.mode === 'local' && !providerForm.editing" class="form-group">
            <label>选择本地服务</label>
            <div class="preset-grid">
              <button
                v-for="(meta, key) in localPresetCatalog"
                :key="key"
                type="button"
                :class="['preset-card', { active: providerForm.presetKey === key }]"
                @click="applyLocalTemplate(key, meta)"
              >
                <span class="preset-name">{{ meta.name }}</span>
                <span class="preset-tags">
                  <code>{{ meta.baseURL }}</code>
                </span>
              </button>
            </div>
          </div>

          <!-- 表单字段 -->
          <div class="form-group">
            <label>名称 <span class="required">*</span></label>
            <input
              v-model="providerForm.data.name"
              type="text"
              class="form-input"
              placeholder="如：OpenAI 个人 / 公司 Ollama"
            />
          </div>

          <div class="form-group">
            <label>协议</label>
            <select v-model="providerForm.data.protocol" class="form-input" @change="onProtocolChange">
              <option value="openai">OpenAI 兼容（chat completions）</option>
              <option value="claude">Anthropic Claude SDK</option>
            </select>
            <small class="form-help">同一服务商可按 OpenAI 兼容或 Anthropic SDK 方式接入</small>
          </div>

          <div v-if="providerForm.data.protocol === 'openai' || providerForm.data.protocol === 'claude'" class="form-group">
            <label>
              Base URL <span class="required">*</span>
            </label>
            <input
              v-model="providerForm.data.baseURL"
              type="text"
              class="form-input"
              :placeholder="providerForm.data.protocol === 'claude' ? 'https://api.anthropic.com 或中转地址' : 'https://api.example.com/v1'"
              spellcheck="false"
            />
            <small v-if="providerForm.data.protocol === 'openai'" class="form-help">不要带尾部 /chat/completions，只填到 v1 这一级</small>
            <small v-else class="form-help">官方地址 https://api.anthropic.com 或代理/中转服务地址</small>
          </div>

          <div v-if="providerForm.data.protocol === 'openai' && providerForm.data.chatPath" class="form-group">
            <label>Chat 路径（高级）</label>
            <input
              v-model="providerForm.data.chatPath"
              type="text"
              class="form-input"
              spellcheck="false"
            />
            <small class="form-help">默认 /chat/completions；MiniMax 等使用自定义路径</small>
          </div>

          <div class="form-group">
            <label>
              API Key
              <span v-if="providerForm.data.type !== 'local'" class="required">*</span>
              <span v-else class="optional">（本地服务可留空）</span>
            </label>
            <div class="api-key-row">
              <input
                :type="showApiKey ? 'text' : 'password'"
                v-model="providerForm.data.apiKey"
                class="form-input api-key-input"
                placeholder="sk-..."
                spellcheck="false"
                autocomplete="off"
              />
              <button class="icon-btn" type="button" @click="showApiKey = !showApiKey">
                {{ showApiKey ? '🙈' : '👁' }}
              </button>
              <button class="icon-btn" type="button" title="粘贴" @click="pasteToForm">📋</button>
            </div>
          </div>

          <div class="form-group">
            <label>模型 ID <span class="required">*</span></label>
            <div class="model-name-row">
              <input
                v-model="providerForm.data.model"
                type="text"
                class="form-input"
                spellcheck="false"
                placeholder="如：gpt-4o-mini / llama3.2 / claude-3-5-sonnet-20241022"
              />
              <button
                class="btn btn-secondary btn-sm"
                type="button"
                :disabled="formFetchingModels"
                @click="fetchFormModels"
              >
                {{ formFetchingModels ? '获取中…' : '🔄 拉取模型' }}
              </button>
            </div>
            <select
              v-if="providerForm.modelOptions && providerForm.modelOptions.length"
              v-model="providerForm.data.model"
              class="form-input model-select"
            >
              <option value="" disabled>从拉取到的模型中选择…</option>
              <option v-for="m in providerForm.modelOptions" :key="m.id" :value="m.id">
                {{ m.label || m.id }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="providerForm.data.vision" />
              支持图片输入（视觉模型）
            </label>
            <small class="form-help">勾选后用于时段截图分析；未勾选时仅基于元数据分析（不发送图片）</small>
          </div>

          <div v-if="providerForm.testResult" :class="['test-result', providerForm.testResult.ok ? 'success' : 'error']">
            <span class="result-icon">{{ providerForm.testResult.ok ? '✓' : '✗' }}</span>
            <span class="result-text">{{ providerForm.testResult.message }}</span>
          </div>

          <div class="button-group">
            <button class="btn btn-primary" type="button" @click="saveProviderForm">
              {{ providerForm.editing ? '保存修改' : '添加并使用' }}
            </button>
            <button class="btn btn-secondary" type="button" :disabled="formTesting" @click="testProviderForm">
              {{ formTesting ? '测试中…' : '测试连接' }}
            </button>
            <button class="btn btn-secondary" type="button" @click="closeProviderForm">取消</button>
          </div>
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
        <label class="checkbox-label">
          <input type="checkbox" v-model="settings.floatingIcon" />
          显示桌面悬浮图标（可一键开关追踪）
        </label>
        <small class="form-help">
          在屏幕角落显示一个可拖动的小图标：绿色 = 正在追踪，灰色 = 已停止。点击可切换状态。
        </small>
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
        <label for="default-category">默认分类（兜底）</label>
        <select
          id="default-category"
          v-model="settings.defaultCategory"
          class="form-input"
        >
          <option value="">不设置（推荐 · 让 AI 在不确定时输出"未分类"）</option>
          <option
            v-for="category in categories"
            :key="category.name"
            :value="category.name"
          >
            {{ category.name }}
          </option>
        </select>
        <small class="form-help">
          AI 仅在所有分类都难以判断时才会回退到此分类；选择「不设置」可避免 AI 把不确定的截图都归为同一类。
        </small>
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
          <button class="btn btn-danger" @click="openClearDialog">
            清理数据…
          </button>
        </div>
        <p class="data-hint">支持按日期清理或全量清理；可选择是否保留 AI 总结/报告。</p>
      </div>

      <div class="settings-section">
        <h3>关于</h3>
        <div class="about-info">
          <p><strong>版本:</strong> 1.0.0</p>
          <p><strong>开发者:</strong> progressmen</p>
          <p><strong>描述:</strong> 智能电脑活动追踪和AI总结工具</p>
          <p><strong>项目地址:</strong>
            <a href="#" @click.prevent="openHomepage">github.com/progressmen/focusflow</a>
          </p>
          <p><strong>问题反馈:</strong>
            <a href="#" @click.prevent="reportIssue">github.com/progressmen/focusflow/issues</a>
          </p>
        </div>
      </div>
      </div>
    </div>

    <!-- 清理数据向导弹窗 -->
    <div v-if="showClearDialog" class="clear-modal-overlay" @click="closeClearDialog">
      <div class="clear-modal-content" @click.stop>
        <div class="clear-modal-header">
          <h3>清理数据</h3>
          <button class="clear-close-btn" @click="closeClearDialog">×</button>
        </div>
        <div class="clear-modal-body">
          <p class="clear-warning">⚠ 此操作不可撤销，请谨慎选择清理范围与内容。</p>

          <div class="clear-section-title">① 清理范围</div>
          <div class="clear-options">
            <label class="clear-option">
              <input type="radio" v-model="clearScope" value="date" />
              <div class="clear-option-body">
                <div class="option-title">指定日期</div>
                <input
                  type="date"
                  v-model="clearDate"
                  :max="todayDateStr"
                  class="date-input"
                  :disabled="clearScope !== 'date'"
                />
              </div>
            </label>
            <label class="clear-option">
              <input type="radio" v-model="clearScope" value="all" />
              <div class="clear-option-body">
                <div class="option-title">全部日期</div>
                <div class="option-hint">作用于所有历史数据</div>
              </div>
            </label>
          </div>

          <div class="clear-section-title">② 清理内容</div>
          <div class="clear-options">
            <label class="clear-option">
              <input type="radio" v-model="clearContent" value="screenshots" />
              <div class="clear-option-body">
                <div class="option-title">仅清理截图</div>
                <div class="option-hint">
                  删除截图原图（含附件），<strong>保留</strong> AI 标题/摘要/分类与日报告
                </div>
              </div>
            </label>
            <label class="clear-option danger">
              <input type="radio" v-model="clearContent" value="everything" />
              <div class="clear-option-body">
                <div class="option-title">截图 + 总结 + 报告</div>
                <div class="option-hint">
                  删除截图、时间轴、月份索引、AI 日报告。<strong>保留</strong>设置（API Key / 分类）
                </div>
              </div>
            </label>
          </div>

          <div v-if="clearResult" :class="['clear-result', clearResult.ok ? 'ok' : 'err']">
            {{ clearResult.message }}
          </div>
        </div>
        <div class="clear-modal-footer">
          <button class="btn btn-secondary" @click="closeClearDialog" :disabled="clearing">
            取消
          </button>
          <button class="btn btn-danger" @click="confirmClear" :disabled="clearing">
            {{ clearing ? '清理中…' : '确认清理' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { AIService } from '../services/AIService'
import settingsService, { SettingsService } from '../services/Settings'

const emit = defineEmits(['close', 'settings-updated'])

const aiService = new AIService()

// ========== v2: AI Provider 管理 ==========
const showApiKey = ref(false)
const providers = ref([])
const activeProviderId = ref('')

// 当前激活的 provider（计算属性）
const activeProvider = computed(() =>
  providers.value.find((p) => p.id === activeProviderId.value) || null
)

// 整体状态徽标
const aiOverallStatus = computed(() => {
  if (providers.value.length === 0) return { label: '未配置', cls: 'tag-warn' }
  if (!activeProviderId.value) return { label: '未激活', cls: 'tag-warn' }
  const p = activeProvider.value
  if (!p) return { label: '配置异常', cls: 'tag-warn' }
  if (p.protocol === 'claude' && !p.apiKey) return { label: '缺少 Key', cls: 'tag-warn' }
  if (!p.model) return { label: '未指定模型', cls: 'tag-warn' }
  return { label: '已就绪', cls: 'tag-ok' }
})

// 添加菜单
const showAddMenu = ref(false)

// 表单状态
const presetCatalog = SettingsService.PRESETS || {}
const localPresetCatalog = SettingsService.LOCAL_PRESETS || {}

const providerForm = reactive({
  show: false,
  editing: false,
  mode: 'preset', // 'preset' | 'custom' | 'local'
  presetKey: '',
  data: makeEmptyProviderData(),
  modelOptions: [],
  testResult: null
})
const formTesting = ref(false)
const formFetchingModels = ref(false)

function makeEmptyProviderData(overrides = {}) {
  return {
    id: '',
    name: '',
    type: 'custom',
    protocol: 'openai',
    baseURL: '',
    chatPath: '',
    apiKey: '',
    model: '',
    vision: false,
    builtin: false,
    ...overrides
  }
}

function loadProvidersFromStore() {
  providers.value = settingsService.loadProviders() || []
  const settingsAll = settingsService.loadSettings()
  activeProviderId.value = settingsAll.activeProviderId || ''
}

function activateProvider(id) {
  if (!id || activeProviderId.value === id) return
  activeProviderId.value = id
  settingsService.setActiveProvider(id)
  emit('settings-updated', { __settingsSaved: true })
  utools?.showNotification?.('已切换激活模型')
}

function openAddPanel(mode) {
  showAddMenu.value = false
  providerForm.show = true
  providerForm.editing = false
  providerForm.mode = mode
  providerForm.presetKey = ''
  providerForm.modelOptions = []
  providerForm.testResult = null
  providerForm.data = makeEmptyProviderData({
    type: mode === 'preset' ? 'preset' : mode === 'local' ? 'local' : 'custom',
    protocol: 'openai'
  })
}

function closeProviderForm() {
  providerForm.show = false
  providerForm.testResult = null
}

function onProtocolChange() {
  // preset 模式下切换协议时，联动 baseURL / chatPath（保留 name/apiKey/model）
  if (providerForm.mode === 'preset' && providerForm.presetKey) {
    const meta = presetCatalog[providerForm.presetKey] || {}
    if (providerForm.data.protocol === 'openai') {
      providerForm.data.baseURL = meta.baseURL || ''
      providerForm.data.chatPath = meta.chatPath || ''
    } else if (providerForm.data.protocol === 'claude') {
      providerForm.data.baseURL = 'https://api.anthropic.com'
      providerForm.data.chatPath = ''
    }
  }
}

function applyPresetTemplate(key, meta) {
  providerForm.presetKey = key
  providerForm.data = makeEmptyProviderData({
    id: providerForm.editing ? providerForm.data.id : `${meta.id}-${Date.now().toString(36).slice(-4)}`,
    name: meta.name,
    type: 'preset',
    protocol: meta.protocol,
    baseURL: meta.baseURL || '',
    chatPath: meta.chatPath || '',
    apiKey: providerForm.data.apiKey, // 保留用户已输入
    model: meta.defaultModel || '',
    vision: !!meta.vision,
    builtin: true
  })
  providerForm.modelOptions = (meta.models || []).map((m) => ({ id: m, label: m }))
}

function applyLocalTemplate(key, meta) {
  providerForm.presetKey = key
  providerForm.data = makeEmptyProviderData({
    id: providerForm.editing ? providerForm.data.id : `${meta.id}-${Date.now().toString(36).slice(-4)}`,
    name: meta.name,
    type: 'local',
    protocol: meta.protocol,
    baseURL: meta.baseURL || '',
    chatPath: meta.chatPath || '',
    apiKey: providerForm.data.apiKey,
    model: meta.defaultModel || '',
    vision: !!meta.vision,
    builtin: true
  })
  providerForm.modelOptions = (meta.models || []).map((m) => ({ id: m, label: m }))
}

function editProvider(p) {
  showAddMenu.value = false
  providerForm.show = true
  providerForm.editing = true
  providerForm.mode = p.type
  providerForm.presetKey = ''
  providerForm.modelOptions = []
  providerForm.testResult = null
  providerForm.data = { ...makeEmptyProviderData(), ...p }
}

function deleteProvider(p) {
  if (!window.confirm(`确定删除「${p.name || p.id}」？`)) return
  settingsService.removeProvider(p.id)
  loadProvidersFromStore()
  emit('settings-updated', { __settingsSaved: true })
  utools?.showNotification?.('已删除')
}

async function pasteToForm() {
  try {
    const text = await navigator.clipboard.readText()
    if (text) providerForm.data.apiKey = text.trim()
  } catch (e) {
    utools?.showNotification?.('无法读取剪贴板')
  }
}

function validateProviderForm() {
  const d = providerForm.data
  if (!d.name || !d.name.trim()) return '请填写名称'
  if (!d.protocol) return '请选择协议'
  if (d.protocol === 'openai' && !d.baseURL) return '请填写 Base URL'
  if (d.protocol === 'claude' && !d.baseURL) return '请填写 Base URL'
  if (!d.model) return '请填写模型 ID'
  if (d.type !== 'local' && !d.apiKey) {
    return d.protocol === 'claude' ? 'Claude 需要 API Key' : '请填写 API Key（本地服务可改类型为「本地」）'
  }
  return ''
}

async function testProviderForm() {
  providerForm.testResult = null
  const err = validateProviderForm()
  if (err) {
    providerForm.testResult = { ok: false, message: err }
    return
  }
  formTesting.value = true
  try {
    const res = await aiService.pingProvider(providerForm.data)
    providerForm.testResult = res
  } catch (e) {
    providerForm.testResult = { ok: false, message: (e && e.message) || String(e) }
  } finally {
    formTesting.value = false
  }
}

async function fetchFormModels() {
  formFetchingModels.value = true
  try {
    const list = await aiService.listModelsByProvider(providerForm.data)
    providerForm.modelOptions = list
    providerForm.testResult = { ok: true, message: `已获取 ${list.length} 个可用模型` }
  } catch (e) {
    providerForm.testResult = { ok: false, message: '获取失败：' + ((e && e.message) || e) }
  } finally {
    formFetchingModels.value = false
  }
}

function saveProviderForm() {
  const err = validateProviderForm()
  if (err) {
    providerForm.testResult = { ok: false, message: err }
    return
  }
  const d = { ...providerForm.data }
  if (!d.id) d.id = `provider-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  // 删除空 chatPath
  if (!d.chatPath) delete d.chatPath
  settingsService.upsertProvider(d)
  // 没有激活时自动激活；编辑时保持激活
  const all = settingsService.loadSettings()
  if (!all.activeProviderId) settingsService.setActiveProvider(d.id)

  loadProvidersFromStore()
  closeProviderForm()
  emit('settings-updated', { __settingsSaved: true })
  utools?.showNotification?.(providerForm.editing ? '已保存修改' : '已添加并设为激活')
}

const settings = reactive({
  autoStart: false,
  notifications: true,
  screenshotInterval: 30,
  floatingIcon: false,
  defaultCategory: '',
  aiModel: ''
})

const categories = ref([])

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
  emit('settings-updated', { ...settings, __settingsSaved: true })
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
    'floatingIcon',
    'defaultCategory'
  ]
  ownKeys.forEach((k) => {
    if (allSettings[k] !== undefined) settings[k] = allSettings[k]
  })

  // 加载 providers（含旧字段一次性迁移）
  loadProvidersFromStore()
}

const saveSettingsHandler = () => {
  // 必须基于「db 中的完整 settings」进行合并，否则会把 providers/categories 等字段抹掉
  const full = settingsService.loadSettings() || {}
  const merged = {
    ...full,
    autoStart: settings.autoStart,
    notifications: settings.notifications,
    screenshotInterval: settings.screenshotInterval,
    floatingIcon: settings.floatingIcon,
    defaultCategory: settings.defaultCategory
  }
  // 兜底清掉 PouchDB 元字段（service 层也会再剥一次）
  delete merged._id
  delete merged._rev

  console.log('[FocusFlow] saveSettingsHandler 写入：', merged)
  const success = settingsService.saveSettings(merged)
  emit('settings-updated', { ...merged, __settingsSaved: true })
  if (typeof utools !== 'undefined' && typeof utools.showNotification === 'function') {
    utools.showNotification(success ? '设置已保存' : '设置保存失败，请查看控制台')
  }
  // 重新读一次，确保 UI 与磁盘一致（也修复了之前面板里 reactive 状态的脏数据）
  loadSettings()
}

const exportData = async () => {
  if (typeof window.exportAllData !== 'function') {
    utools?.showNotification?.('当前环境不支持 exportAllData')
    return
  }
  const includeScreenshots = window.confirm(
    '是否包含截图原图？\n\n· 「确定」：包含截图（文件体积可能很大，几百 MB 起步）\n· 「取消」：仅导出 AI 标题/摘要/分类/日报告/日历索引（推荐，文件小）'
  )
  utools?.showNotification?.(
    includeScreenshots ? '正在导出截图，可能耗时较久…' : '正在导出数据…'
  )
  try {
    const payload = await window.exportAllData({ includeScreenshots })
    if (!payload) {
      utools?.showNotification?.('导出失败，请查看控制台')
      return
    }
    const ts = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const name = `focusflow-backup-${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}.json`
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    const sizeMB = (blob.size / 1024 / 1024).toFixed(2)
    utools?.showNotification?.(
      `导出完成：${payload.timeslots.length} 时段 / ${payload.reports.length} 报告 / ${payload.screenshots.length} 截图（${sizeMB} MB）`
    )
  } catch (e) {
    console.error('exportData 异常:', e)
    utools?.showNotification?.('导出异常：' + (e?.message || String(e)))
  }
}

const importData = () => {
  if (typeof window.importAllData !== 'function') {
    utools?.showNotification?.('当前环境不支持 importAllData')
    return
  }
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = (event) => {
    const file = event.target.files && event.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const payload = JSON.parse(e.target.result)
        if (!payload || payload.meta?.app !== 'focusflow') {
          utools?.showNotification?.('文件格式不正确（不是 FocusFlow 导出包）')
          return
        }
        const exportedTime = payload.meta?.exportedAt
          ? new Date(payload.meta.exportedAt).toLocaleString()
          : '未知时间'
        const counts = `时段 ${payload.timeslots?.length || 0} / 月份 ${payload.months?.length || 0} / 报告 ${payload.reports?.length || 0} / 截图 ${payload.screenshots?.length || 0}`

        // 询问导入模式
        const overwrite = window.confirm(
          `备份文件信息：\n· 导出时间：${exportedTime}\n· 内容：${counts}\n\n请选择导入模式：\n· 「确定」覆盖：先清空现有数据再导入（仅保留你的设置）\n· 「取消」合并：与现有数据合并（同 _id 用导入数据覆盖，其余保留）`
        )
        const mode = overwrite ? 'overwrite' : 'merge'

        utools?.showNotification?.(
          mode === 'overwrite' ? '正在覆盖式导入…' : '正在合并式导入…'
        )
        const result = await window.importAllData(payload, { mode })
        if (!result || !result.ok) {
          utools?.showNotification?.('导入失败：' + (result?.message || '未知错误'))
          return
        }
        const i = result.imported
        utools?.showNotification?.(
          `导入完成（${mode === 'overwrite' ? '覆盖' : '合并'}）：时段 ${i.timeslots} / 月份 ${i.months} / 报告 ${i.reports} / 截图 ${i.screenshots}`
        )
        // 通知 App 刷新所有 UI（共用 __clearedAll 的重置链路）
        emit('settings-updated', { __clearedAll: true })
        emit('close')
      } catch (error) {
        console.error('importData 异常:', error)
        utools?.showNotification?.('文件解析失败：' + (error?.message || '未知'))
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

// ========== 清理数据向导 ==========
const showClearDialog = ref(false)
const clearScope = ref('date')        // 'date' | 'all'
const clearContent = ref('screenshots') // 'screenshots' | 'everything'
const clearDate = ref('')
const clearing = ref(false)
const clearResult = ref(null)
const todayDateStr = computed(() => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
})

const openClearDialog = () => {
  clearScope.value = 'date'
  clearContent.value = 'screenshots'
  clearDate.value = todayDateStr.value
  clearResult.value = null
  clearing.value = false
  showClearDialog.value = true
}

const closeClearDialog = () => {
  if (clearing.value) return
  showClearDialog.value = false
  clearResult.value = null
}

/**
 * 清理逻辑：按「范围 × 内容」走 4 个分支
 *  - all + screenshots  → clearScreenshotsOnly({ scope:'all' })
 *  - date + screenshots → clearScreenshotsOnly({ scope:'date', dateStr })
 *  - all + everything   → clearAllData()  + 不需要再单独删 dailyreport（clearAllData 已包含）
 *  - date + everything  → clearDateData(dateStr) + removeDailyReport(dateStr)
 */
const confirmClear = async () => {
  if (clearing.value) return
  clearResult.value = null

  const scope = clearScope.value
  const content = clearContent.value
  const dateStr = clearDate.value

  if (scope === 'date' && !dateStr) {
    clearResult.value = { ok: false, message: '请先选择日期' }
    return
  }

  // 二次确认（醒目）
  const tipScope = scope === 'all' ? '全部日期' : `${dateStr} 这一天`
  const tipContent = content === 'screenshots'
    ? '仅截图原图（保留 AI 总结/分类/日报告）'
    : '截图 + 时间轴 + 分类 + 日报告（仅保留你的设置）'
  const tip = `确定要清理 ${tipScope} 的「${tipContent}」吗？\n\n此操作不可恢复！`
  if (!window.confirm(tip)) return

  clearing.value = true
  try {
    let result = null
    let removedSummary = ''

    if (content === 'screenshots') {
      if (typeof window.clearScreenshotsOnly !== 'function') {
        throw new Error('clearScreenshotsOnly API 不可用')
      }
      result = window.clearScreenshotsOnly({ scope, dateStr })
      removedSummary = `${result?.removed || 0} 张截图`
    } else {
      // everything：截图+总结+报告
      if (scope === 'all') {
        if (typeof window.clearAllData !== 'function') {
          throw new Error('clearAllData API 不可用')
        }
        result = window.clearAllData()
        // clearAllData 已经包含 dailyreport/，不需要额外处理
      } else {
        if (typeof window.clearDateData !== 'function') {
          throw new Error('clearDateData API 不可用')
        }
        result = window.clearDateData(dateStr)
        // clearDateData 不清 dailyreport，单独处理
        try {
          if (typeof window.removeDailyReport === 'function') {
            window.removeDailyReport(dateStr)
          }
        } catch (e) {
          console.warn('清理时同步删除日报告失败：', e)
        }
      }
      removedSummary = `${result?.removed || 0} 条数据`
    }

    if (!result || !result.ok) {
      clearResult.value = {
        ok: false,
        message: '清理失败：' + ((result && result.message) || '未知错误')
      }
      return
    }

    // 旧版 localStorage 残留（仅在 everything 时清）
    if (content === 'everything') {
      try {
        localStorage.removeItem('focusflow-data')
        localStorage.removeItem('focusflow-sessions')
      } catch (e) {}
    }

    clearResult.value = {
      ok: true,
      message: `已清理 ${removedSummary}（${tipScope} · ${content === 'screenshots' ? '仅截图' : '全部'}）`
    }
    utools?.showNotification?.('清理完成')

    // 通知 App.vue 重置内存态并刷新（沿用 __clearedAll 链路）
    emit('settings-updated', { __clearedAll: true })

    // 1.2 秒后自动关闭弹窗
    setTimeout(() => {
      if (clearResult.value && clearResult.value.ok) {
        showClearDialog.value = false
        clearResult.value = null
      }
    }, 1200)
  } catch (e) {
    console.error('[FocusFlow] confirmClear 异常:', e)
    clearResult.value = { ok: false, message: '清理异常：' + (e?.message || String(e)) }
  } finally {
    clearing.value = false
  }
}

const openHomepage = () => {
  const url = 'https://github.com/progressmen/focusflow'
  if (typeof utools !== 'undefined' && typeof utools.shellOpenExternal === 'function') {
    utools.shellOpenExternal(url)
  } else {
    window.open(url, '_blank', 'noopener')
  }
}

const reportIssue = () => {
  const url = 'https://github.com/progressmen/focusflow/issues'
  if (typeof utools !== 'undefined' && typeof utools.shellOpenExternal === 'function') {
    utools.shellOpenExternal(url)
  } else {
    window.open(url, '_blank', 'noopener')
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

/* ========== 清理数据弹窗 ========== */
.data-hint {
  margin: 10px 0 0 0;
  font-size: 12px;
  color: #7f8c8d;
}
.clear-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 16px;
}
.clear-modal-content {
  background: white;
  border-radius: 10px;
  width: 100%;
  max-width: 520px;
  max-height: calc(100% - 32px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}
.clear-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #e1e5e9;
}
.clear-modal-header h3 {
  margin: 0;
  font-size: 16px;
  color: #2c3e50;
}
.clear-close-btn {
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 22px;
  color: #95a5a6;
  border-radius: 4px;
}
.clear-close-btn:hover { background: #f1f3f5; color: #2c3e50; }
.clear-modal-body {
  padding: 16px 20px;
  overflow-y: auto;
}
.clear-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid #e1e5e9;
  background: #fafbfc;
}
.clear-warning {
  background: #fff8e6;
  color: #b8860b;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
  margin: 0 0 16px 0;
}
.clear-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #2c3e50;
  margin: 14px 0 8px;
}
.clear-section-title:first-of-type { margin-top: 0; }
.clear-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.clear-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e1e5e9;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.clear-option:hover { border-color: #3498db; background: #f8fbfd; }
.clear-option.danger:hover { border-color: #e74c3c; background: #fef6f5; }
.clear-option input[type="radio"] {
  margin-top: 3px;
  accent-color: #e74c3c;
  flex-shrink: 0;
}
.clear-option-body { flex: 1; min-width: 0; }
.option-title { font-size: 14px; font-weight: 600; color: #2c3e50; margin-bottom: 4px; }
.option-hint { font-size: 12px; color: #7f8c8d; line-height: 1.55; }
.date-input {
  margin-top: 4px;
  padding: 6px 10px;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  font-size: 13px;
  color: #2c3e50;
  outline: none;
}
.date-input:focus { border-color: #3498db; }
.date-input:disabled { background: #f1f3f5; color: #95a5a6; cursor: not-allowed; }
.clear-result {
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
}
.clear-result.ok { background: #e8f8f0; color: #27ae60; border: 1px solid #abebc6; }
.clear-result.err { background: #fdecea; color: #c0392b; border: 1px solid #f5b7b1; }

/* ========== AI 模型 v2 UI ========== */
.active-provider-card {
  background: linear-gradient(90deg, #ebf5fb 0%, #f8fbfd 100%);
  border: 1px solid #d6eaf8;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 12px;
}
.active-provider-card.empty {
  background: #f8f9fa;
  border-style: dashed;
  color: #7f8c8d;
  font-size: 13px;
}
.active-provider-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.active-provider-label {
  font-size: 12px;
  color: #7f8c8d;
}
.active-provider-name {
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
}
.active-provider-meta {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.active-provider-meta code {
  background: white;
  border: 1px solid #ecf0f1;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #2c3e50;
}

.provider-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}
.provider-row {
  display: flex;
  align-items: stretch;
  border: 1px solid #e1e5e9;
  border-radius: 6px;
  background: white;
  overflow: hidden;
  transition: all 0.15s;
}
.provider-row:hover { border-color: #3498db; }
.provider-row.active { border-color: #3498db; box-shadow: 0 0 0 1px #3498db inset; }
.provider-row-main {
  flex: 1;
  padding: 10px 12px;
  cursor: pointer;
  min-width: 0;
}
.provider-row-title {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.provider-active-dot { color: #27ae60; font-size: 10px; }
.provider-row-name { font-size: 14px; font-weight: 600; color: #2c3e50; }
.provider-row-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #7f8c8d;
  flex-wrap: wrap;
}
.provider-row-model {
  background: #f4f6f8;
  padding: 1px 6px;
  border-radius: 4px;
  color: #2c3e50;
}
.provider-row-url {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 11px;
  color: #95a5a6;
  max-width: 280px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.provider-warn { color: #e67e22; font-weight: 500; }
.provider-row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border-left: 1px solid #f1f3f5;
}
.btn-mini {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: #7f8c8d;
}
.btn-mini:hover { background: #f1f3f5; color: #2c3e50; }
.btn-mini.danger:hover { background: #fdecea; color: #c0392b; }

.provider-type-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  background: #ecf0f1;
  color: #7f8c8d;
}
.provider-type-tag.type-preset { background: #d6eaf8; color: #2980b9; }
.provider-type-tag.type-local { background: #d5f5e3; color: #229954; }
.provider-type-tag.type-custom { background: #fcf3cf; color: #b7950b; }
.provider-type-tag.vision { background: #f4ecf7; color: #8e44ad; }

.add-provider-bar { margin: 8px 0; }
.add-menu {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  background: #fafbfc;
}
.add-menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #e1e5e9;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}
.add-menu-item:hover {
  border-color: #3498db;
  background: #f8fbfd;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(52, 152, 219, 0.1);
}
.add-menu-icon { font-size: 24px; flex-shrink: 0; }
.add-menu-text { display: flex; flex-direction: column; gap: 2px; }
.add-menu-text strong { font-size: 14px; color: #2c3e50; }
.add-menu-text small { font-size: 12px; color: #7f8c8d; }
.cancel-add { align-self: flex-end; }

.provider-form {
  margin-top: 12px;
  padding: 16px;
  border: 1px solid #d6eaf8;
  border-radius: 8px;
  background: #f8fbfd;
}
.provider-form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.provider-form-header h4 { margin: 0; color: #2c3e50; font-size: 14px; }
.provider-form .close-btn {
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 18px;
  color: #95a5a6;
  border-radius: 4px;
}
.provider-form .close-btn:hover { background: #ecf0f1; }

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
}
.preset-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border: 1px solid #e1e5e9;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}
.preset-card:hover { border-color: #3498db; background: #f8fbfd; }
.preset-card.active {
  border-color: #3498db;
  background: #ebf5fb;
  box-shadow: 0 0 0 1px #3498db inset;
}
.preset-name { font-size: 13px; font-weight: 600; color: #2c3e50; }
.preset-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  align-items: center;
}
.preset-tags code {
  font-size: 11px;
  background: #f4f6f8;
  padding: 1px 6px;
  border-radius: 3px;
  color: #7f8c8d;
}
.required { color: #e74c3c; }
.optional { color: #7f8c8d; font-size: 12px; font-weight: normal; }

.api-key-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.api-key-input { flex: 1; }
.icon-btn {
  width: 34px;
  height: 34px;
  border: 1px solid #d0d7de;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
.icon-btn:hover { background: #f1f3f5; }
.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.model-name-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.model-name-row .form-input { flex: 1; }

.model-select {
  margin-top: 8px;
  width: 100%;
  cursor: pointer;
}

.test-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  margin: 12px 0 0;
  font-size: 13px;
}
.test-result.success { background: #e8f8f0; color: #27ae60; border: 1px solid #abebc6; }
.test-result.error { background: #fdecea; color: #c0392b; border: 1px solid #f5b7b1; }
.test-result .result-icon { font-size: 16px; flex-shrink: 0; }
.test-result .result-text { flex: 1; }

.ai-status-tag {
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}
.ai-status-tag.tag-ok { background: #d5f5e3; color: #229954; }
.ai-status-tag.tag-warn { background: #fff3cd; color: #b8860b; }
</style>
