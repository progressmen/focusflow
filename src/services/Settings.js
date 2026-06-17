/**
 * 设置管理服务
 * 用于保存和加载应用设置
 */

class SettingsService {
  constructor() {
    this.defaultSettings = {
      // ========== AI 设置（v2 数据模型） ==========
      // providers: 用户已配置的所有模型/服务商，每项形如：
      //   {
      //     id: 'claude-default',          // 全局唯一 id（自动生成或迁移生成）
      //     name: 'Claude (Anthropic)',    // 显示名
      //     type: 'preset' | 'custom' | 'local',  // 来源类型
      //     protocol: 'claude' | 'openai',  // 协议类型（claude SDK / OpenAI 兼容）
      //     baseURL: 'https://api.openai.com/v1',  // OpenAI 协议必填；claude 协议忽略
      //     apiKey: '',
      //     model: 'gpt-4o-mini',          // 模型 id
      //     vision: true,                  // 是否支持图片输入
      //     builtin: false                  // 是否是内置预设（用于 UI 区分）
      //   }
      providers: [],
      // 当前激活的 provider id
      activeProviderId: '',

      // ====== 旧字段（保留以兼容历史数据，加载时会迁移到 providers）======
      apiKeys: {},
      aiModel: '',
      aiModelNames: {},

      // 追踪设置
      autoStart: false,
      notifications: true,
      // 截图间隔（秒），最小 5 秒，最大 600 秒
      screenshotInterval: 30,

      // 分类设置
      categories: [
        {
          name: '个人',
          color: '#3498db',
          description: '包含社交媒体、聊天工具、音乐、视频等个人娱乐应用'
        },
        {
          name: '工作',
          color: '#2ecc71',
          description: '包含开发工具、文档处理、邮件、项目管理等工作相关应用'
        },
        {
          name: '非专注',
          color: '#e74c3c',
          description: '包含游戏、无关浏览、娱乐视频等让人分心的应用'
        }
      ],
      defaultCategory: '工作',
      
      // 其他设置
      language: 'zh-CN',
      theme: 'light',
      enableSound: true
    }
  }

  /**
   * 加载设置
   * @returns {Object} 加载的设置对象
   */
  loadSettings() {
    try {
      // 尝试从 uTools 数据库加载设置
      if (typeof utools !== 'undefined' && typeof utools.db !== 'undefined') {
        try {
          const docId = 'focusflow-settings'
          const savedSettings = utools.db.get(docId)
          console.log('loadSettings:', savedSettings)
          if (savedSettings) {
            return this.mergeSettings(this.defaultSettings, savedSettings)
          }
        } catch (error) {
          console.error('Failed to get settings from utools db:', error)
        }
      }
      
      // 回退到 localStorage
      const savedSettings = localStorage.getItem('focusflow-settings')
      if (savedSettings) {
        try {
          const parsedSettings = JSON.parse(savedSettings)
          return this.mergeSettings(this.defaultSettings, parsedSettings)
        } catch (error) {
          console.error('Failed to parse settings from localStorage:', error)
        }
      }
      
      // 返回默认设置
      return { ...this.defaultSettings }
    } catch (error) {
      console.error('Failed to load settings:', error)
      return { ...this.defaultSettings }
    }
  }

  /**
   * 保存设置
   * @param {Object} settings 要保存的设置对象
   * @returns {boolean} 是否保存成功
   */
  saveSettings(settings) {
    try {
      // 从入参里剥离 PouchDB 元字段，避免脏数据污染下次的 rev 计算
      const { _id: _ignoreId, _rev: _ignoreRev, ...cleanSettings } = settings || {}

      // 保存到 uTools 数据库
      if (typeof utools !== 'undefined' && typeof utools.db !== 'undefined') {
        try {
          const docId = 'focusflow-settings'
          const ok = this._putSettingsDoc(docId, cleanSettings)
          if (ok) return true
        } catch (error) {
          console.error('[FocusFlow] Failed to save settings to utools db:', error)
        }
      }

      // 回退到 localStorage
      localStorage.setItem('focusflow-settings', JSON.stringify(cleanSettings))
      return true
    } catch (error) {
      console.error('[FocusFlow] Failed to save settings:', error)
      return false
    }
  }

  /**
   * 实际写入 utools.db 的逻辑：自动处理 rev 冲突（最多重试 2 次）
   * 文档结构始终基于「最新 db 中的 rev」+「clean 后的 settings」拼装
   * @private
   */
  _putSettingsDoc(docId, cleanSettings, retry = 0) {
    const existingDoc = utools.db.get(docId)
    const doc = {
      _id: docId,
      ...cleanSettings
    }
    if (existingDoc && existingDoc._rev) {
      doc._rev = existingDoc._rev
    }
    const result = utools.db.put(doc)
    if (result && result.ok) {
      console.log('[FocusFlow] saveSettings 成功，新 rev =', result.rev)
      return true
    }
    // 处理 PouchDB 409 冲突：刷新 rev 后重试
    if (result && (result.error === 'conflict' || result.name === 'conflict') && retry < 2) {
      console.warn('[FocusFlow] saveSettings 冲突，重试中…', result)
      return this._putSettingsDoc(docId, cleanSettings, retry + 1)
    }
    console.error('[FocusFlow] utools.db.put 失败:', result)
    return false
  }

  /**
   * 获取特定设置
   * @param {string} key 设置键名
   * @param {*} defaultValue 默认值
   * @returns {*} 设置值
   */
  getSetting(key, defaultValue = null) {
    const settings = this.loadSettings()
    return this.getNestedValue(settings, key, defaultValue)
  }

  /**
   * 设置特定设置
   * @param {string} key 设置键名
   * @param {*} value 设置值
   * @returns {boolean} 是否设置成功
   */
  setSetting(key, value) {
    const settings = this.loadSettings()
    this.setNestedValue(settings, key, value)
    return this.saveSettings(settings)
  }

  /**
   * 重置设置到默认值
   * @returns {boolean} 是否重置成功
   */
  resetSettings() {
    return this.saveSettings(this.defaultSettings)
  }

  /**
   * 导出设置
   * @returns {string} 导出的设置JSON字符串
   */
  exportSettings() {
    const settings = this.loadSettings()
    return JSON.stringify(settings, null, 2)
  }

  /**
   * 导入设置
   * @param {string} settingsJson 设置JSON字符串
   * @returns {boolean} 是否导入成功
   */
  importSettings(settingsJson) {
    try {
      const settings = JSON.parse(settingsJson)
      return this.saveSettings(settings)
    } catch (error) {
      console.error('Failed to import settings:', error)
      return false
    }
  }

  /**
   * 合并设置
   * @param {Object} defaultSettings 默认设置
   * @param {Object} userSettings 用户设置
   * @returns {Object} 合并后的设置
   */
  mergeSettings(defaultSettings, userSettings) {
    const merged = { ...defaultSettings }
    
    for (const key in userSettings) {
      if (userSettings.hasOwnProperty(key)) {
        if (typeof userSettings[key] === 'object' && userSettings[key] !== null && !Array.isArray(userSettings[key])) {
          merged[key] = this.mergeSettings(defaultSettings[key] || {}, userSettings[key])
        } else if (Array.isArray(userSettings[key]) && Array.isArray(defaultSettings[key])) {
          // 对于数组，使用用户设置的数组
          merged[key] = userSettings[key]
        } else {
          merged[key] = userSettings[key]
        }
      }
    }
    
    return merged
  }

  /**
   * 获取嵌套值
   * @param {Object} obj 对象
   * @param {string} key 键名，支持点号分隔的路径
   * @param {*} defaultValue 默认值
   * @returns {*} 值
   */
  getNestedValue(obj, key, defaultValue) {
    const keys = key.split('.')
    let result = obj
    
    for (const k of keys) {
      if (result === undefined || result === null) {
        return defaultValue
      }
      result = result[k]
    }
    
    return result === undefined ? defaultValue : result
  }

  /**
   * 设置嵌套值
   * @param {Object} obj 对象
   * @param {string} key 键名，支持点号分隔的路径
   * @param {*} value 值
   */
  setNestedValue(obj, key, value) {
    const keys = key.split('.')
    let current = obj
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i]
      if (!current[k]) {
        current[k] = {}  // 自动创建嵌套对象
      }
      current = current[k]
    }
    
    current[keys[keys.length - 1]] = value
  }

  /**
   * 加载API Key
   * @param {string} model 模型名称
   * @returns {string} API Key
   */
  loadApiKey(model) {
    const settings = this.loadSettings()
    return settings.apiKeys?.[model] || ''
  }

  /**
   * 保存API Key
   * @param {string} model 模型名称
   * @param {string} apiKey API Key
   * @returns {boolean} 是否保存成功
   */
  saveApiKey(model, apiKey) {
    const settings = this.loadSettings()
    console.log('saveApiKey:', settings)
    console.log('saveApiKey model apiKey:', model, apiKey)
    if (!settings.apiKeys) {
      settings.apiKeys = {}
    }
    settings.apiKeys[model] = apiKey
    settings.aiModel = model
    return this.saveSettings(settings)
  }

  /**
   * 加载分类设置
   * @returns {Array} 分类数组
   */
  loadCategories() {
    const settings = this.loadSettings()
    return settings.categories || this.defaultSettings.categories
  }

  /**
   * 保存分类设置
   * @param {Array} categories 分类数组
   * @returns {boolean} 是否保存成功
   */
  saveCategories(categories) {
    const settings = this.loadSettings()
    settings.categories = categories
    return this.saveSettings(settings)
  }

  /**
   * 加载默认分类
   * @returns {string} 默认分类名称
   */
  loadDefaultCategory() {
    const settings = this.loadSettings()
    return settings.defaultCategory || this.defaultSettings.defaultCategory
  }

  /**
   * 保存默认分类
   * @param {string} category 分类名称
   * @returns {boolean} 是否保存成功
   */
  saveDefaultCategory(category) {
    const settings = this.loadSettings()
    settings.defaultCategory = category
    return this.saveSettings(settings)
  }

  /**
   * 加载AI模型设置
   * @returns {string} AI模型名称
   */
  loadAiModel() {
    const settings = this.loadSettings()
    return settings.aiModel || ''
  }

  /**
   * 保存AI模型设置
   * @param {string} model 模型名称
   * @returns {boolean} 是否保存成功
   */
  saveAiModel(model) {
    const settings = this.loadSettings()
    settings.aiModel = model
    return this.saveSettings(settings)
  }

  /**
   * 加载指定 provider 的自定义模型名
   * @param {string} model provider id（claude/minimax/kimi）
   * @returns {string} 用户配置的模型名（可能为空）
   */
  loadAiModelName(model) {
    const settings = this.loadSettings()
    return settings.aiModelNames?.[model] || ''
  }

  /**
   * 保存指定 provider 的自定义模型名
   * @param {string} model provider id
   * @param {string} modelName 模型名
   * @returns {boolean} 是否保存成功
   */
  saveAiModelName(model, modelName) {
    const settings = this.loadSettings()
    if (!settings.aiModelNames || typeof settings.aiModelNames !== 'object') {
      settings.aiModelNames = { claude: '', minimax: '', kimi: '' }
    }
    settings.aiModelNames[model] = modelName || ''
    return this.saveSettings(settings)
  }

  // ========== Providers CRUD（v2 数据模型） ==========

  /**
   * 加载所有 providers（自动从旧 apiKeys/aiModelNames 迁移一次）
   * @returns {Array} providers 数组
   */
  loadProviders() {
    const settings = this.loadSettings()
    let list = Array.isArray(settings.providers) ? settings.providers.slice() : []

    // 迁移：旧版 apiKeys.claude/minimax/kimi 自动生成 preset providers（仅在 providers 空且旧字段非空时）
    if (list.length === 0 && settings.apiKeys && typeof settings.apiKeys === 'object') {
      const legacyMap = [
        { key: 'claude', meta: this._presetMeta('claude') },
        { key: 'minimax', meta: this._presetMeta('minimax') },
        { key: 'kimi', meta: this._presetMeta('kimi') }
      ]
      for (const { key, meta } of legacyMap) {
        const ak = settings.apiKeys[key]
        if (ak && meta) {
          list.push({
            id: meta.id,
            name: meta.name,
            type: 'preset',
            protocol: meta.protocol,
            baseURL: meta.baseURL,
            apiKey: ak,
            model: (settings.aiModelNames && settings.aiModelNames[key]) || meta.defaultModel,
            vision: meta.vision,
            builtin: true
          })
        }
      }
      // 一次性回写
      if (list.length > 0) {
        settings.providers = list
        if (!settings.activeProviderId && settings.aiModel) {
          // aiModel 之前是 'claude'/'minimax'/'kimi'
          const preset = legacyMap.find((m) => m.key === settings.aiModel)
          if (preset && preset.meta) settings.activeProviderId = preset.meta.id
        }
        this.saveSettings(settings)
      }
    }
    return list
  }

  /**
   * 内置预设元数据（仅用于迁移与 UI 提示推荐）
   */
  _presetMeta(presetId) {
    const PRESETS = SettingsService.PRESETS || {}
    return PRESETS[presetId] || null
  }

  /**
   * 保存全部 providers（替换式）
   */
  saveProviders(providers) {
    const settings = this.loadSettings()
    settings.providers = Array.isArray(providers) ? providers : []
    return this.saveSettings(settings)
  }

  /**
   * 单条新增/更新 provider
   */
  upsertProvider(provider) {
    if (!provider || !provider.id) return false
    const settings = this.loadSettings()
    const list = Array.isArray(settings.providers) ? settings.providers.slice() : []
    const idx = list.findIndex((p) => p.id === provider.id)
    if (idx >= 0) list[idx] = { ...list[idx], ...provider }
    else list.push({ ...provider })
    settings.providers = list
    return this.saveSettings(settings)
  }

  /**
   * 删除 provider
   */
  removeProvider(providerId) {
    const settings = this.loadSettings()
    const list = Array.isArray(settings.providers) ? settings.providers : []
    settings.providers = list.filter((p) => p.id !== providerId)
    if (settings.activeProviderId === providerId) {
      settings.activeProviderId = settings.providers[0]?.id || ''
    }
    return this.saveSettings(settings)
  }

  /**
   * 获取当前激活的 provider 完整配置
   */
  loadActiveProvider() {
    const settings = this.loadSettings()
    const list = this.loadProviders()
    const id = settings.activeProviderId || ''
    return list.find((p) => p.id === id) || null
  }

  /**
   * 设置激活的 provider id
   */
  setActiveProvider(providerId) {
    const settings = this.loadSettings()
    settings.activeProviderId = providerId || ''
    return this.saveSettings(settings)
  }

  /**
   * 加载追踪设置
   * @returns {Object} 追踪设置
   */
  loadTrackingSettings() {
    const settings = this.loadSettings()
    // 用「显式存在判断」，避免布尔 false 被 || 误吞为默认值
    return {
      autoStart:
        typeof settings.autoStart === 'boolean' ? settings.autoStart : this.defaultSettings.autoStart,
      notifications:
        typeof settings.notifications === 'boolean' ? settings.notifications : this.defaultSettings.notifications,
      screenshotInterval: settings.screenshotInterval || this.defaultSettings.screenshotInterval
    }
  }

  /**
   * 保存追踪设置
   * @param {Object} trackingSettings 追踪设置
   * @returns {boolean} 是否保存成功
   */
  saveTrackingSettings(trackingSettings) {
    const settings = this.loadSettings()
    settings.autoStart = trackingSettings.autoStart
    settings.notifications = trackingSettings.notifications
    if (trackingSettings.screenshotInterval) {
      settings.screenshotInterval = trackingSettings.screenshotInterval
    }
    return this.saveSettings(settings)
  }

}

/**
 * 内置预设服务商目录（用户在「常用模型」中可一键添加）
 * - id: 唯一 id，也用于迁移
 * - protocol: 'claude' (Anthropic SDK) | 'openai' (OpenAI 兼容 chat completions)
 * - baseURL: OpenAI 兼容服务的 base url（claude 协议忽略）
 * - defaultModel: 默认模型 id
 * - vision: 是否支持图片输入
 * - models: 推荐模型列表（UI datalist 用）
 * - link: 申请页面
 */
SettingsService.PRESETS = {
  claude: {
    id: 'claude-default',
    name: 'Claude (Anthropic)',
    protocol: 'claude',
    baseURL: '',
    defaultModel: 'claude-3-5-sonnet-20241022',
    vision: true,
    models: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-haiku-20240307'
    ],
    link: 'https://console.anthropic.com/settings/keys'
  },
  openai: {
    id: 'openai-default',
    name: 'OpenAI',
    protocol: 'openai',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    vision: true,
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4.1', 'gpt-4.1-mini', 'o3-mini'],
    link: 'https://platform.openai.com/api-keys'
  },
  minimax: {
    id: 'minimax-default',
    name: 'MiniMax',
    protocol: 'openai',
    baseURL: 'https://api.minimaxi.com/v1',
    chatPath: '/text/chatcompletion_v2',
    defaultModel: 'MiniMax-M2.7',
    vision: true,
    models: ['MiniMax-M2.7', 'abab6.5-chat'],
    link: 'https://platform.minimaxi.com'
  },
  kimi: {
    id: 'kimi-default',
    name: 'Kimi (Moonshot)',
    protocol: 'openai',
    baseURL: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-32k-vision-preview',
    vision: true,
    models: [
      'moonshot-v1-32k-vision-preview',
      'moonshot-v1-8k-vision-preview',
      'moonshot-v1-32k',
      'moonshot-v1-8k'
    ],
    link: 'https://platform.moonshot.cn/console/api-keys'
  },
  deepseek: {
    id: 'deepseek-default',
    name: 'DeepSeek',
    protocol: 'openai',
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    vision: false,
    models: ['deepseek-chat', 'deepseek-reasoner'],
    link: 'https://platform.deepseek.com/api_keys'
  },
  zhipu: {
    id: 'zhipu-default',
    name: '智谱 GLM',
    protocol: 'openai',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4v-plus',
    vision: true,
    models: ['glm-4v-plus', 'glm-4-plus', 'glm-4-long', 'glm-4-flash'],
    link: 'https://open.bigmodel.cn/usercenter/apikeys'
  },
  qwen: {
    id: 'qwen-default',
    name: '通义千问 (DashScope)',
    protocol: 'openai',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-vl-max-latest',
    vision: true,
    models: ['qwen-vl-max-latest', 'qwen-vl-plus', 'qwen-max-latest', 'qwen-plus', 'qwen-turbo'],
    link: 'https://bailian.console.aliyun.com'
  },
  doubao: {
    id: 'doubao-default',
    name: '豆包 (火山引擎)',
    protocol: 'openai',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-pro-32k',
    vision: false,
    models: ['doubao-pro-32k', 'doubao-pro-128k', 'doubao-vision-pro-32k', 'doubao-lite-32k'],
    link: 'https://www.volcengine.com/docs/82379'
  }
}

/**
 * 本地模型预设（apiKey 可为空）
 */
SettingsService.LOCAL_PRESETS = {
  ollama: {
    id: 'ollama-local',
    name: 'Ollama 本地',
    protocol: 'openai',
    baseURL: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    vision: false,
    models: ['llama3.2', 'llama3.2-vision', 'qwen2.5', 'gemma2'],
    link: 'https://ollama.com'
  },
  lmstudio: {
    id: 'lmstudio-local',
    name: 'LM Studio',
    protocol: 'openai',
    baseURL: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
    vision: false,
    models: [],
    link: 'https://lmstudio.ai'
  },
  vllm: {
    id: 'vllm-local',
    name: 'vLLM 本地',
    protocol: 'openai',
    baseURL: 'http://localhost:8000/v1',
    defaultModel: '',
    vision: false,
    models: [],
    link: 'https://docs.vllm.ai'
  }
}

// 导出单例
const settingsService = new SettingsService()
export default settingsService
export { SettingsService }