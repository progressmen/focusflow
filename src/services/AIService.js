import Anthropic from '@anthropic-ai/sdk'

// 各 provider 的内置默认模型名（用户未配置时使用）
const DEFAULT_MODELS = {
  claude: 'claude-3-5-sonnet-20241022',
  minimax: 'MiniMax-M2.7',
  kimi: 'moonshot-v1-32k-vision-preview'
}

// 测试连接用的「最便宜/最快」模型名（与配置无关，只验证 key 有效）
const TEST_MODELS = {
  claude: 'claude-3-haiku-20240307',
  minimax: 'MiniMax-M2.7',
  kimi: 'moonshot-v1-8k'
}

// Claude 没有公开的 /models 列表端点，提供常用模型作为下拉候选项
const CLAUDE_MODEL_OPTIONS = [
  { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (最新)', vision: true },
  { id: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet', vision: true },
  { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', vision: true },
  { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', vision: true },
  { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus', vision: true },
  { id: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet', vision: true }
]

// 通过 id 名称判断是否视觉模型（用于在 UI 提示）
const isLikelyVisionModel = (id) => {
  if (!id) return false
  return /vision|vl|multimodal|mm|claude|M2|M3|m2|m3/i.test(id)
}

class AIService {
  constructor() {
    this.apiKey = localStorage.getItem('focusflow-ai-api-key') || ''
    this.client = this.apiKey ? new Anthropic({
      apiKey: this.apiKey,
      dangerouslyAllowBrowser: true
    }) : null
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey
    localStorage.setItem('focusflow-ai-api-key', apiKey)
    this.client = new Anthropic({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    })
  }

  async generateReport(activityData) {
    if (!this.client) {
      return '请先设置 Claude API Key 以使用 AI 总结功能。'
    }

    if (!activityData) {
      return '暂无活动数据可供分析。'
    }

    try {
      const prompt = this.buildPrompt(activityData)

      const response = await this.client.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        temperature: 0.7,
        system: '你是一个专业的个人效率顾问，擅长分析用户的时间使用模式并提供有价值的建议。请用中文回复，语言简洁专业。',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })

      return response.content[0].text
    } catch (error) {
      console.error('AI report generation failed:', error)
      return `AI 报告生成失败: ${error.message}`
    }
  }

  buildPrompt(activityData) {
    const { date, totalTime, apps, sessions, focusScore } = activityData

    const hours = Math.floor(totalTime / 60)
    const minutes = totalTime % 60

    let prompt = `请分析以下用户电脑使用数据，并生成一份简洁的使用总结和建议：

`
    prompt += `📅 日期: ${date}\n`
    prompt += `⏰ 总使用时间: ${hours}小时${minutes}分钟\n`
    prompt += `🔄 应用切换次数: ${sessions}次\n`
    prompt += `🎯 专注度评分: ${focusScore}%\n\n`

    prompt += `📊 应用使用详情:\n`
    apps.forEach((app, index) => {
      prompt += `${index + 1}. ${app.name}: ${app.time}分钟 (${app.sessions}次会话)\n`
    })

    prompt += `\n请提供以下分析：\n`
    prompt += `1. 时间使用效率评估\n`
    prompt += `2. 主要的生产力应用\n`
    prompt += `3. 可能的干扰因素\n`
    prompt += `4. 改进建议\n`
    prompt += `\n请用积极鼓励的语气，重点突出用户的优点和进步空间。`

    return prompt
  }

  async generateWeeklyReport(weeklyData) {
    if (!this.client) {
      return '请先设置 Claude API Key 以使用 AI 总结功能。'
    }

    try {
      const prompt = this.buildWeeklyPrompt(weeklyData)

      const response = await this.client.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1500,
        temperature: 0.7,
        system: '你是一个专业的个人效率顾问，擅长分析用户的时间使用模式并提供有价值的建议。请用中文回复，语言简洁专业。',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })

      return response.content[0].text
    } catch (error) {
      console.error('Weekly AI report generation failed:', error)
      return `AI 周报生成失败: ${error.message}`
    }
  }

  buildWeeklyPrompt(weeklyData) {
    let prompt = `请分析以下用户一周的电脑使用数据，并生成一份周报总结：\n\n`

    weeklyData.forEach((day, index) => {
      const { date, totalTime, focusScore, topApps } = day
      const hours = Math.floor(totalTime / 60)
      const minutes = totalTime % 60

      prompt += `${index + 1}. ${date}: ${hours}小时${minutes}分钟，专注度${focusScore}%\n`
      if (topApps && topApps.length > 0) {
        prompt += `   主要应用: ${topApps.slice(0, 3).map(app => app.name).join('、')}\n`
      }
    })

    prompt += `\n请提供以下分析：\n`
    prompt += `1. 一周工作模式总结\n`
    prompt += `2. 最佳和最差的工作日分析\n`
    prompt += `3. 时间使用趋势\n`
    prompt += `4. 下周改进建议\n`
    prompt += `\n请用积极鼓励的语气，重点突出用户的优点和进步空间。`

    return prompt
  }

  async suggestImprovements(activityData) {
    if (!this.client) {
      return '请先设置 Claude API Key 以使用 AI 建议功能。'
    }

    try {
      const prompt = this.buildImprovementPrompt(activityData)

      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        temperature: 0.8,
        system: '你是一个专业的个人效率顾问，请用中文提供具体可行的改进建议。',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })

      return response.content[0].text
    } catch (error) {
      console.error('Improvement suggestions failed:', error)
      return `AI 建议生成失败: ${error.message}`
    }
  }

  buildImprovementPrompt(activityData) {
    const { totalTime, apps, sessions, focusScore } = activityData

    let prompt = `基于以下用户数据，提供3-5条具体的改进建议：\n\n`
    prompt += `总使用时间: ${Math.floor(totalTime / 60)}小时${totalTime % 60}分钟\n`
    prompt += `应用切换: ${sessions}次\n`
    prompt += `专注度: ${focusScore}%\n\n`

    if (apps.length > 0) {
      prompt += `主要应用: ${apps.slice(0, 5).map(app => `${app.name}(${app.time}分钟)`).join('、')}\n\n`
    }

    prompt += `请提供具体、可执行的改进建议，重点关注：\n`
    prompt += `1. 减少干扰的方法\n`
    prompt += `2. 提高专注度的技巧\n`
    prompt += `3. 优化应用使用习惯\n`
    prompt += `4. 时间管理建议\n`

    return prompt
  }

  async analyzeUserActivity(activityData) {
    if (!this.client) {
      return '请先设置 Claude API Key 以使用 AI 分析功能。'
    }

    if (!activityData || activityData.totalActions === 0) {
      return '暂无用户活动数据可供分析。'
    }

    try {
      const prompt = this.buildActivityAnalysisPrompt(activityData)

      const response = await this.client.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        temperature: 0.7,
        system: '你是一个专业的用户行为分析专家，擅长通过用户活动数据分析用户的电脑使用习惯。请用中文回复，语言简洁专业。',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })

      return response.content[0].text
    } catch (error) {
      console.error('Activity analysis failed:', error)
      return `AI 活动分析失败: ${error.message}`
    }
  }

  buildActivityAnalysisPrompt(activityData) {
    let prompt = `请分析以下用户活动数据，并生成一份详细的使用习惯分析报告：\n\n`
    prompt += `📊 活动统计：\n`
    prompt += `总活动次数: ${activityData.totalActions}\n`
    prompt += `应用切换次数: ${activityData.appSwitches}\n`
    prompt += `专注度评分: ${activityData.focusScore}%\n\n`

    if (activityData.mostActiveApps && activityData.mostActiveApps.length > 0) {
      prompt += `🔥 最活跃应用：\n`
      activityData.mostActiveApps.forEach((app, index) => {
        prompt += `${index + 1}. ${app.name}: ${app.usageTime}分钟\n`
      })
      prompt += `\n`
    }

    if (activityData.timeDistribution) {
      prompt += `⏰ 时间分布：\n`
      const hours = Object.entries(activityData.timeDistribution)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      hours.forEach(([hour, count]) => {
        prompt += `${hour}:00 - ${hour}:59: ${count}次活动\n`
      })
      prompt += `\n`
    }

    prompt += `请提供以下分析：\n`
    prompt += `1. 用户的工作/学习模式分析\n`
    prompt += `2. 时间使用效率评估\n`
    prompt += `3. 可能的干扰因素\n`
    prompt += `4. 改进建议\n`
    prompt += `\n请用中文回复，语言简洁专业，重点突出用户的活动模式和时间使用情况。`

    return prompt
  }



  // ========== 模型列表与默认模型 ==========

  /**
   * 获取当前 provider 的内置默认模型名
   * @param {string} model provider id
   * @returns {string}
   */
  getDefaultModelName(model) {
    return DEFAULT_MODELS[model] || ''
  }

  /**
   * 解析最终使用的模型名（用户配置优先，否则内置默认）
   * @param {string} model provider id
   * @param {string} [modelName] 用户自定义模型名
   * @returns {string}
   */
  resolveModelName(model, modelName) {
    if (modelName && typeof modelName === 'string' && modelName.trim()) {
      return modelName.trim()
    }
    return DEFAULT_MODELS[model] || ''
  }

  /**
   * 获取指定 provider 的可用模型列表
   *  - MiniMax: GET https://api.minimaxi.com/v1/models
   *  - Kimi:    GET https://api.moonshot.cn/v1/models
   *  - Claude:  无公开 endpoint，返回内置候选项
   * @param {string} model provider id
   * @param {string} apiKey API Key
   * @returns {Promise<Array<{id, label, vision}>>}
   */
  async listModels(model, apiKey) {
    if (!apiKey) {
      throw new Error('请先填写 API Key')
    }
    if (model === 'minimax') return this._listMiniMaxModels(apiKey)
    if (model === 'kimi') return this._listKimiModels(apiKey)
    if (model === 'claude') {
      // Claude 没有公开 /models 端点，直接返回内置列表
      return CLAUDE_MODEL_OPTIONS.slice()
    }
    throw new Error('不支持的 AI 模型：' + model)
  }

  async _listMiniMaxModels(apiKey) {
    let res
    try {
      res = await fetch('https://api.minimaxi.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })
    } catch (e) {
      throw new Error('MiniMax 网络请求失败：' + (e && e.message))
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = err.error?.message || err.base_resp?.status_msg || res.statusText || '未知错误'
      throw new Error(`MiniMax 模型列表 ${res.status}：${msg}`)
    }
    const data = await res.json()
    console.log('[FocusFlow] MiniMax 模型列表响应：', data)
    const items = Array.isArray(data?.data) ? data.data : []
    return items
      .filter((m) => m && m.id)
      .map((m) => ({
        id: m.id,
        label: m.id,
        vision: isLikelyVisionModel(m.id)
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  }

  async _listKimiModels(apiKey) {
    let res
    try {
      res = await fetch('https://api.moonshot.cn/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })
    } catch (e) {
      throw new Error('Kimi 网络请求失败：' + (e && e.message))
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = err.error?.message || res.statusText || '未知错误'
      throw new Error(`Kimi 模型列表 ${res.status}：${msg}`)
    }
    const data = await res.json()
    console.log('[FocusFlow] Kimi 模型列表响应：', data)
    const items = Array.isArray(data?.data) ? data.data : []
    return items
      .filter((m) => m && m.id)
      .map((m) => ({
        id: m.id,
        label: m.id,
        vision: isLikelyVisionModel(m.id)
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  }

  /**
   * 简单连通性测试：仅用「测试专用模型」发一个最小请求，验证 key 是否有效
   * 不要求用户已经选好正式模型
   * @param {string} model provider id
   * @param {string} apiKey API Key
   * @returns {Promise<{ok: boolean, model: string, message?: string}>}
   */
  async pingModel(model, apiKey) {
    if (!apiKey) {
      return { ok: false, message: '请先填写 API Key' }
    }
    const testModel = TEST_MODELS[model]
    if (!testModel) {
      return { ok: false, message: '不支持的 provider：' + model }
    }
    if (model === 'claude') {
      try {
        const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
        const r = await client.messages.create({
          model: testModel,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }]
        })
        return { ok: !!r, model: testModel }
      } catch (e) {
        const status = e && (e.status || e.statusCode)
        const msg = (e && e.error && e.error.error && e.error.error.message) || e.message || String(e)
        return { ok: false, model: testModel, message: `Claude ${status || ''} ${msg}`.trim() }
      }
    }
    if (model === 'minimax' || model === 'kimi') {
      const url =
        model === 'minimax'
          ? 'https://api.minimaxi.com/v1/text/chatcompletion_v2'
          : 'https://api.moonshot.cn/v1/chat/completions'
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: testModel,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1
          })
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          const msg =
            err.error?.message || err.base_resp?.status_msg || res.statusText || '未知错误'
          return { ok: false, model: testModel, message: `${model} ${res.status} ${msg}` }
        }
        return { ok: true, model: testModel }
      } catch (e) {
        return { ok: false, model: testModel, message: '网络错误：' + (e && e.message) }
      }
    }
    return { ok: false, message: '不支持的 provider：' + model }
  }

  /**
   * 生成单张图片的描述总结
   * @param {string} imageBase64 - base64 格式的图片数据
   * @param {string} apiKey - MiniMax API Key
   * @returns {Promise<string>} 图片描述总结
   */
  async generateImageInfoByMiniMax(imageBase64, apiKey) {
    if (!imageBase64) {
      throw new Error('图片数据不能为空')
    }
    
    if (!apiKey) {
      throw new Error('API Key 不能为空')
    }

    try {
      // 构建 base64 图片 URL
      const imageUrl = `data:image/png;base64,${imageBase64}`
      
      const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'MiniMax-M2.7',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: "image_url",
                  text: "请详细描述这张图片的内容，包括：\n1. 图片的主要内容和场景\n2. 图片中的关键元素\n3. 图片的整体风格和氛围\n4. 可能的拍摄意图或用途\n请用简洁明了的语言进行描述，不超过500字。",
                  image_url: {
                    url: imageUrl
                  }
                }
              ]
            }
          ],
          max_tokens: 1000,
          temperature: 0.7
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`API 错误: ${errorData.error?.message || `HTTP ${response.status}`}`)
      }
      
      const data = await response.json()
      console.log('MiniMax 图片描述响应:', data)
      
      // 提取描述内容
      if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        return data.choices[0].message.content
      } else {
        throw new Error('API 响应格式错误')
      }
    } catch (error) {
      console.error('生成图片描述失败:', error)
      throw error
    }
  }

  /**
   * 分析一个时间槽的截图集合，并根据分类设置给出归类
   * @param {Object} params
   * @param {string} params.model - 'claude' | 'minimax' | 'kimi'
   * @param {string} [params.modelName] - 用户自定义的模型名；为空则用内置默认
   * @param {string} params.apiKey - 对应模型的 API Key
   * @param {Array}  params.categories - [{name, description, color}]
   * @param {string} params.defaultCategory - 默认分类名
   * @param {Array}  params.screenshots - [{imageData(base64 dataURL), app, time}]
   * @param {string} params.timeLabel - 该时段的时间标签（如 '14:10 - 14:20'）
   * @returns {Promise<{title, summary, detail, categories: string[], model: string}>}
   */
  async analyzeTimeslot({ model, modelName, apiKey, categories = [], defaultCategory = '', screenshots = [], timeLabel = '' }) {
    if (!apiKey) {
      throw new Error('未配置 AI API Key，无法分析时间槽')
    }
    if (!screenshots || screenshots.length === 0) {
      throw new Error('没有可分析的截图')
    }

    // 控制输入图片数量，避免 token 超限（最多取 4 张：首、中、末、最近）
    const sample = pickSampleScreenshots(screenshots, 4)
    const catLines = (categories || [])
      .map((c) => `- ${c.name}：${c.description || ''}`)
      .join('\n')
    const appList = Array.from(new Set(sample.map((s) => s.app).filter(Boolean))).join('、')

    const instructionText = [
      `你是一名个人活动分析师。请基于下列截图和元数据，判断用户在时段「${timeLabel}」内做了什么，并将其归类到给定的分类中。`,
      '',
      `本时段涉及的应用：${appList || '未知'}`,
      '',
      '可用分类（请只能从中选择，可以选多个相关分类）：',
      catLines || '（未配置分类，请使用 "未分类"）',
      defaultCategory ? `如果难以判断，请回退到默认分类：「${defaultCategory}」` : '',
      '',
      '请严格按照下面的 JSON 格式输出，不要输出 JSON 之外的任何文字：',
      '{',
      '  "title": "10 个字以内的本时段标题",',
      '  "summary": "30~80 字的本时段活动摘要",',
      '  "detail": "100~200 字的详细描述，包括看到了什么、可能在做什么",',
      '  "categories": ["分类名1", "分类名2"]',
      '}'
    ].filter(Boolean).join('\n')

    const finalModel = this.resolveModelName(model, modelName)
    console.log('[FocusFlow] analyzeTimeslot 使用模型：', model, '→', finalModel)

    let result
    if (model === 'claude') {
      result = await this._analyzeWithClaude(apiKey, sample, instructionText, finalModel)
    } else if (model === 'minimax') {
      result = await this._analyzeWithMiniMax(apiKey, sample, instructionText, finalModel)
    } else if (model === 'kimi') {
      result = await this._analyzeWithKimi(apiKey, sample, instructionText, finalModel)
    } else {
      throw new Error('不支持的 AI 模型：' + model)
    }
    // 附带真实使用的模型名，方便上层展示/排错
    if (result && typeof result === 'object') result.model = finalModel
    return result
  }

  async _analyzeWithClaude(apiKey, screenshots, instructionText, modelName) {
    const finalModel = modelName || DEFAULT_MODELS.claude
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
    const content = []
    let skipped = 0
    for (const s of screenshots) {
      const parsed = parseDataUrl(s.imageData)
      if (!parsed) {
        skipped++
        continue
      }
      // Claude 只支持 image/jpeg | image/png | image/gif | image/webp
      let mime = parsed.mime || 'image/png'
      if (!/^image\/(jpeg|png|gif|webp)$/i.test(mime)) {
        console.warn('[FocusFlow] Claude 不支持的图片 MIME，已回退为 image/png：', mime)
        mime = 'image/png'
      }
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: mime, data: parsed.base64 }
      })
    }
    if (content.length === 0) {
      throw new Error(`没有有效的截图可传给 Claude（${skipped} 张被跳过）`)
    }
    content.push({ type: 'text', text: instructionText })
    console.log('[FocusFlow] Claude 请求：model=', finalModel, 'images=', content.length - 1)
    let response
    try {
      response = await client.messages.create({
        model: finalModel,
        max_tokens: 800,
        temperature: 0.4,
        system: '你是一名严谨的活动分析助理，回复时严格输出 JSON，不要有任何额外文字。',
        messages: [{ role: 'user', content }]
      })
    } catch (e) {
      // Anthropic SDK 抛出的错误通常带 status 和 error 信息
      const status = e && (e.status || e.statusCode)
      const errMsg = (e && e.error && e.error.error && e.error.error.message) || e.message || String(e)
      throw new Error(`Claude API ${status || ''} ${errMsg}`.trim())
    }
    const text = response.content && response.content[0] ? response.content[0].text : ''
    console.log('[FocusFlow] Claude 响应文本：', text)
    return parseAnalysisJson(text)
  }

  async _analyzeWithMiniMax(apiKey, screenshots, instructionText, modelName) {
    const finalModel = modelName || DEFAULT_MODELS.minimax
    const content = []
    for (const s of screenshots) {
      if (!s.imageData) continue
      content.push({
        type: 'image_url',
        image_url: { url: s.imageData }
      })
    }
    if (content.length === 0) {
      throw new Error('没有有效的截图可传给 MiniMax')
    }
    content.push({ type: 'text', text: instructionText })
    console.log('[FocusFlow] MiniMax 请求：model=', finalModel, 'images=', content.length - 1)
    let response
    try {
      response = await fetch('https://api.minimaxi.com/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: finalModel,
          messages: [{ role: 'user', content }],
          max_tokens: 1000,
          temperature: 0.4
        })
      })
    } catch (e) {
      throw new Error('MiniMax 网络请求失败：' + (e && e.message))
    }
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(`MiniMax API ${response.status}：${err.error?.message || err.base_resp?.status_msg || '未知错误'}`)
    }
    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content || ''
    console.log('[FocusFlow] MiniMax 响应文本：', text)
    if (!text) {
      throw new Error('MiniMax 返回了空内容（可能是所选模型不支持图片或额度耗尽）')
    }
    return parseAnalysisJson(text)
  }

  async _analyzeWithKimi(apiKey, screenshots, instructionText, modelName) {
    const finalModel = modelName || DEFAULT_MODELS.kimi
    const content = []
    for (const s of screenshots) {
      if (!s.imageData) continue
      content.push({
        type: 'image_url',
        image_url: { url: s.imageData }
      })
    }
    if (content.length === 0) {
      throw new Error('没有有效的截图可传给 Kimi')
    }
    content.push({ type: 'text', text: instructionText })
    console.log('[FocusFlow] Kimi 请求：model=', finalModel, 'images=', content.length - 1)
    let response
    try {
      response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: finalModel,
          messages: [{ role: 'user', content }],
          max_tokens: 1000,
          temperature: 0.4
        })
      })
    } catch (e) {
      throw new Error('Kimi 网络请求失败：' + (e && e.message))
    }
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(`Kimi API ${response.status}：${err.error?.message || '未知错误'}`)
    }
    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content || ''
    console.log('[FocusFlow] Kimi 响应文本：', text)
    if (!text) {
      throw new Error('Kimi 返回了空内容（可能是所选模型不支持图片或额度耗尽）')
    }
    return parseAnalysisJson(text)
  }

  // ========== AI 日报告（基于时段摘要的纯文本总结） ==========

  /**
   * 基于一整天的时间槽摘要、分类统计，生成今日总结报告（纯文本，markdown 格式）
   * 不传图片，只传文字摘要，对三家 provider 都能用
   * @param {Object} params
   * @param {string} params.model       provider id (claude/minimax/kimi)
   * @param {string} [params.modelName] 用户自定义模型名
   * @param {string} params.apiKey      对应 provider 的 API Key
   * @param {string} params.dateStr     'YYYY-MM-DD'
   * @param {Array}  params.slots       [{time, title, summary, categories: []}]
   * @param {Object} [params.stats]     { totalScreenshots, activeCategories, totalSessions, focusScore }
   * @param {Array}  [params.categories] 分类配置（用于让 AI 知道分类的语义）
   * @returns {Promise<{ content: string, model: string }>}
   */
  async generateDailyReport({ model, modelName, apiKey, dateStr, slots = [], stats = null, categories = [] }) {
    if (!apiKey) throw new Error('未配置 AI API Key，无法生成日报告')
    if (!Array.isArray(slots) || slots.length === 0) {
      throw new Error('当天没有任何已分析的时段，无法生成报告')
    }

    const finalModel = this.resolveModelName(model, modelName)

    // 拼装结构化的「时段摘要清单」
    const slotLines = slots
      .map((s) => {
        const cats = (s.categories && s.categories.length) ? `[${s.categories.join(', ')}]` : '[未分类]'
        const title = s.title ? `「${s.title}」` : ''
        const sum = s.summary ? ` —— ${s.summary}` : ''
        return `- ${s.time || ''} ${cats} ${title}${sum}`.trim()
      })
      .join('\n')

    const catLines = (categories || [])
      .map((c) => `- ${c.name}：${c.description || ''}`)
      .join('\n')

    const statsLine = stats
      ? `截图 ${stats.totalScreenshots || 0} 张 · 时段 ${stats.totalSessions || 0} 个 · 活跃分类 ${stats.activeCategories || 0} 类 · 专注度 ${stats.focusScore || 0}%`
      : ''

    const prompt = [
      `你是一名个人效率顾问。下面是用户在 ${dateStr} 这一天的所有 10 分钟时段摘要（已由 AI 分析过），请基于这些摘要生成一份当日总结报告。`,
      '',
      statsLine ? `今日整体统计：${statsLine}` : '',
      '',
      catLines ? `当前分类配置：\n${catLines}` : '',
      '',
      '今日时段摘要清单：',
      slotLines,
      '',
      '请用 Markdown 格式输出一份精炼的中文报告，结构包含：',
      '1. **🎯 今日概览**：1~2 句话提炼整体状态',
      '2. **📊 时间分配**：按分类粗略归纳花了多少时段在什么上',
      '3. **✨ 主要成果**：今天做成了哪几件事（基于时段标题/摘要归并）',
      '4. **⚠️ 干扰与待优化**：发现了哪些非专注 / 频繁切换 / 中断的迹象',
      '5. **💡 明日建议**：3 条可执行的小建议',
      '',
      '注意：',
      '- 严格基于上面的时段摘要，不要编造没出现过的内容',
      '- 全文 300~600 字，简洁、具体、避免空话',
      '- 直接输出 Markdown，不要包裹在 ```代码块``` 中'
    ].filter(Boolean).join('\n')

    console.log('[FocusFlow] generateDailyReport：', { model, finalModel, slotCount: slots.length })

    let content = ''
    if (model === 'claude') {
      content = await this._dailyReportClaude(apiKey, finalModel, prompt)
    } else if (model === 'minimax') {
      content = await this._dailyReportMiniMax(apiKey, finalModel, prompt)
    } else if (model === 'kimi') {
      content = await this._dailyReportKimi(apiKey, finalModel, prompt)
    } else {
      throw new Error('不支持的 AI 模型：' + model)
    }

    content = stripCodeFence(content)
    if (!content) throw new Error('AI 返回了空报告，请检查模型是否正常')
    return { content, model: finalModel }
  }

  async _dailyReportClaude(apiKey, finalModel, prompt) {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
    try {
      const res = await client.messages.create({
        model: finalModel,
        max_tokens: 1500,
        temperature: 0.6,
        system: '你是一名严谨、温暖、有洞察力的个人效率顾问，回复使用 Markdown 格式的中文。',
        messages: [{ role: 'user', content: prompt }]
      })
      return (res.content && res.content[0] && res.content[0].text) || ''
    } catch (e) {
      const status = e && (e.status || e.statusCode)
      const errMsg = (e && e.error && e.error.error && e.error.error.message) || e.message || String(e)
      throw new Error(`Claude API ${status || ''} ${errMsg}`.trim())
    }
  }

  async _dailyReportMiniMax(apiKey, finalModel, prompt) {
    let res
    try {
      res = await fetch('https://api.minimaxi.com/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: finalModel,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1500,
          temperature: 0.6
        })
      })
    } catch (e) {
      throw new Error('MiniMax 网络请求失败：' + (e && e.message))
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`MiniMax API ${res.status}：${err.error?.message || err.base_resp?.status_msg || '未知错误'}`)
    }
    const data = await res.json()
    return data?.choices?.[0]?.message?.content || ''
  }

  async _dailyReportKimi(apiKey, finalModel, prompt) {
    let res
    try {
      res = await fetch('https://api.moonshot.cn/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: finalModel,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1500,
          temperature: 0.6
        })
      })
    } catch (e) {
      throw new Error('Kimi 网络请求失败：' + (e && e.message))
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`Kimi API ${res.status}：${err.error?.message || '未知错误'}`)
    }
    const data = await res.json()
    return data?.choices?.[0]?.message?.content || ''
  }

}

// 从大数组中等距采样 N 张（首、中、末优先）
function pickSampleScreenshots(list, n) {
  if (list.length <= n) return list.slice()
  const out = []
  const step = (list.length - 1) / (n - 1)
  for (let i = 0; i < n; i++) {
    out.push(list[Math.round(i * step)])
  }
  return out
}

// 解析 base64 dataURL → { mime, base64 }
function parseDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!m) return null
  return { mime: m[1], base64: m[2] }
}

// 去除 AI 输出中可能包裹的 ```markdown / ``` 围栏（仅一层）
function stripCodeFence(text) {
  if (!text) return ''
  let raw = String(text).trim()
  raw = raw.replace(/^```(?:markdown|md)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
  return raw
}

// 从 AI 返回的文本中提取 JSON（容错：可能带 ```json ... ``` 围栏）
function parseAnalysisJson(text) {
  if (!text) return { title: '', summary: '', detail: '', categories: [] }
  let raw = text.trim()
  // 去除可能的 markdown 代码块围栏
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  // 提取第一个 { ... }
  const m = raw.match(/\{[\s\S]*\}/)
  if (m) raw = m[0]
  try {
    const obj = JSON.parse(raw)
    return {
      title: String(obj.title || '').trim(),
      summary: String(obj.summary || '').trim(),
      detail: String(obj.detail || '').trim(),
      categories: Array.isArray(obj.categories) ? obj.categories.filter(Boolean).map(String) : []
    }
  } catch (e) {
    console.error('parseAnalysisJson 失败:', e, '原文：', text)
    return { title: '', summary: text.slice(0, 80), detail: text, categories: [] }
  }
}

// ============================================================
// v2 协议适配层（基于 provider 配置驱动）
// ============================================================

/**
 * 拼接 baseURL + path（健壮处理斜杠）
 */
function joinUrl(base, path) {
  if (!base) return path || ''
  const b = String(base).replace(/\/+$/, '')
  const p = path ? (path.startsWith('/') ? path : '/' + path) : ''
  return b + p
}

/**
 * OpenAI 兼容 chat completions 调用
 * @param {Object} provider { baseURL, apiKey, model, chatPath? }
 * @param {Array} messages
 * @param {Object} extraBody
 * @returns {Promise<string>} content text
 */
async function callOpenAICompatChat(provider, messages, extraBody = {}) {
  const url = joinUrl(provider.baseURL, provider.chatPath || '/chat/completions')
  const headers = { 'Content-Type': 'application/json' }
  // 本地模型 apiKey 可为空；非空才带 Authorization
  if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`

  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: provider.model,
        messages,
        max_tokens: 1000,
        temperature: 0.4,
        ...extraBody
      })
    })
  } catch (e) {
    throw new Error(`网络请求失败（${provider.name || provider.id}）：${(e && e.message) || e}`)
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg =
      err.error?.message ||
      err.base_resp?.status_msg ||
      err.message ||
      `HTTP ${response.status}`
    throw new Error(`${provider.name || provider.id} API ${response.status}：${msg}`)
  }
  const data = await response.json()
  return data?.choices?.[0]?.message?.content || ''
}

/**
 * 从截图的 time 字段提取 HH:mm:ss（time 形如 "YYYY-MM-DD HH:mm:ss"）
 * fallback：基于 timestamp 计算
 */
function extractClockTime(s) {
  if (s && typeof s.time === 'string') {
    const m = s.time.match(/(\d{1,2}:\d{2}(?::\d{2})?)$/)
    if (m) return m[1]
  }
  if (s && typeof s.timestamp === 'number') {
    const d = new Date(s.timestamp)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  }
  return ''
}

/**
 * 构建「截图时间轴」文本（按时间排序）
 *   1. 14:13:27 [Chrome]
 *   2. 14:15:02 [VSCode]
 *   3. 14:18:51 [Slack]
 */
function buildScreenshotTimeline(screenshots) {
  const items = (screenshots || [])
    .map((s, i) => ({
      idx: i + 1,
      time: extractClockTime(s),
      app: s.app || '未知应用'
    }))
    .filter((x) => x.time)
  if (items.length === 0) return ''
  return items.map((x) => `  ${x.idx}. ${x.time} [${x.app}]`).join('\n')
}

/**
 * 把图片+文本组装成多模态 messages（OpenAI 兼容格式）
 * 每张图片前插入一段时间/应用标注，让模型理解时序
 */
function buildVisionMessages(screenshots, instructionText) {
  const content = []
  for (let i = 0; i < screenshots.length; i++) {
    const s = screenshots[i]
    if (!s.imageData) continue
    const clock = extractClockTime(s)
    const label = `第 ${i + 1} 张截图 · 时间 ${clock || '未知'} · 应用 ${s.app || '未知'}`
    content.push({ type: 'text', text: label })
    content.push({ type: 'image_url', image_url: { url: s.imageData } })
  }
  if (content.length === 0) return null
  content.push({ type: 'text', text: instructionText })
  return [{ role: 'user', content }]
}

/**
 * Claude SDK 调用（图片）
 */
async function callClaudeVision(provider, screenshots, instructionText) {
  const client = new Anthropic({ apiKey: provider.apiKey, dangerouslyAllowBrowser: true })
  const content = []
  let skipped = 0
  for (let i = 0; i < screenshots.length; i++) {
    const s = screenshots[i]
    const parsed = parseDataUrl(s.imageData)
    if (!parsed) { skipped++; continue }
    let mime = parsed.mime || 'image/png'
    if (!/^image\/(jpeg|png|gif|webp)$/i.test(mime)) mime = 'image/png'
    const clock = extractClockTime(s)
    const label = `第 ${i + 1} 张截图 · 时间 ${clock || '未知'} · 应用 ${s.app || '未知'}`
    content.push({ type: 'text', text: label })
    content.push({ type: 'image', source: { type: 'base64', media_type: mime, data: parsed.base64 } })
  }
  if (content.length === 0) {
    throw new Error(`没有有效的截图可传给 Claude（${skipped} 张被跳过）`)
  }
  content.push({ type: 'text', text: instructionText })
  const response = await client.messages.create({
    model: provider.model,
    max_tokens: 1000,
    temperature: 0.4,
    system: '你是一名严谨的活动分析助理，必须严格按照指定的 JSON 格式输出，不要输出 JSON 之外的任何文字。',
    messages: [{ role: 'user', content }]
  })
  const text = (response?.content || []).map((c) => (c?.text || '')).join('').trim()
  if (!text) throw new Error('Claude 返回了空内容')
  return text
}

/**
 * Claude SDK 调用（纯文本）
 */
async function callClaudeText(provider, prompt, opts = {}) {
  const client = new Anthropic({ apiKey: provider.apiKey, dangerouslyAllowBrowser: true })
  const response = await client.messages.create({
    model: provider.model,
    max_tokens: opts.maxTokens || 1500,
    temperature: opts.temperature ?? 0.5,
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
  })
  return (response?.content || []).map((c) => (c?.text || '')).join('').trim()
}

// ============================================================
// 给 AIService 类挂载 v2 入口（用 prototype 扩展，避免大幅改动原 class）
// ============================================================

/**
 * 用 provider 配置分析时间槽（截图 → 标题/摘要/分类）
 */
AIService.prototype.analyzeTimeslotByProvider = async function (provider, args) {
  const { categories = [], defaultCategory = '', screenshots = [], timeLabel = '' } = args || {}
  if (!provider) throw new Error('未指定 AI provider')
  if (!provider.model) throw new Error(`${provider.name || provider.id} 未指定模型 id`)
  if (provider.protocol !== 'openai' && provider.protocol !== 'claude') {
    throw new Error('未知协议：' + provider.protocol)
  }
  // 本地模型允许 apiKey 为空；其他要求必填
  if (provider.protocol === 'claude' && !provider.apiKey) {
    throw new Error('Claude 需要 API Key')
  }
  if (!screenshots.length) throw new Error('没有可分析的截图')

  const sample = pickSampleScreenshots(screenshots, 4)
  const catLines = (categories || []).map((c) => `- ${c.name}：${c.description || ''}`).join('\n')
  const appList = Array.from(new Set(sample.map((s) => s.app).filter(Boolean))).join('、')
  const timeline = buildScreenshotTimeline(sample)

  const instructionText = [
    `你是一名个人活动分析师。请基于下列截图和元数据，判断用户在时段「${timeLabel}」内做了什么，并将其归类到给定的分类中。`,
    '',
    `本时段涉及的应用：${appList || '未知'}`,
    timeline ? `\n本时段截图时间轴（共 ${sample.length} 张，已按时间顺序排列）：\n${timeline}` : '',
    '',
    '可用分类（请只能从中选择，可以选 1~3 个最贴切的分类，不要全部勾选）：',
    catLines || '（未配置分类，请使用 "未分类"）',
    '',
    '【分类原则 — 重要】',
    '1. 必须严格依据「截图实际显示的内容」判断，不要只看应用名称：',
    '   - 同一个浏览器既可能是「工作」也可能是「个人」/「非专注」，要看打开的具体网页/视频/文章；',
    '   - 同一个 IM 工具（微信/Slack 等）既可能是工作沟通也可能是私聊娱乐；',
    '   - 文档/邮件不一定都是工作，要看内容主题。',
    '2. 当截图证据不足时，请优先选择「未分类」（如果分类列表里没有"未分类"则保持空数组 []），不要硬性归到任意一类。',
    '3. 不要把所有不确定情况都归为同一类（特别避免默认归为「工作」）；只在你能从截图找到明确支持依据时才打上对应分类。',
    defaultCategory
      ? `4. 用户配置的兜底分类是「${defaultCategory}」，但仅当 1~3 条都判定不出时才能使用，不要轻易回退。`
      : '',
    '',
    '请严格按照下面的 JSON 格式输出，不要输出 JSON 之外的任何文字：',
    '{',
    '  "title": "10 个字以内的本时段标题",',
    '  "summary": "30~80 字的本时段活动摘要",',
    '  "detail": "150~250 字的详细描述。请按截图时间轴顺序还原过程：例如「14:13 在 Chrome 浏览 X，14:15 切到 VSCode 编辑 Y，14:18 在 Slack 回复 Z」，体现出每个时间点对应的具体内容与场景切换。在描述中请简短点出每个时间点选用的分类依据（如：14:15 切到 VSCode 编辑 Y → 工作）",',
    '  "categories": ["分类名1"]',
    '}'
  ].filter(Boolean).join('\n')

  let text = ''
  if (provider.protocol === 'claude') {
    text = await callClaudeVision(provider, sample, instructionText)
  } else {
    if (!provider.vision) {
      // 不支持图片的模型，仍可基于元数据让它分析
      const fallback = `（注：当前模型不支持图片，仅基于元数据分析）\n\n${instructionText}`
      text = await callOpenAICompatChat(provider, [{ role: 'user', content: fallback }])
    } else {
      const messages = buildVisionMessages(sample, instructionText)
      if (!messages) throw new Error(`没有有效的截图可传给 ${provider.name || provider.id}`)
      text = await callOpenAICompatChat(provider, messages)
    }
  }
  if (!text) throw new Error('AI 返回了空内容')
  const parsed = parseAnalysisJson(text)
  parsed.model = provider.model
  return parsed
}

/**
 * 用 provider 配置生成日报告
 */
AIService.prototype.generateDailyReportByProvider = async function (provider, args) {
  const { dateStr, slots = [], stats = null, categories = [] } = args || {}
  if (!provider) throw new Error('未指定 AI provider')
  if (!provider.model) throw new Error(`${provider.name || provider.id} 未指定模型 id`)
  if (!Array.isArray(slots) || slots.length === 0) {
    throw new Error('当天没有任何已分析的时段，无法生成报告')
  }

  const slotLines = slots.map((s) => {
    const cats = (s.categories && s.categories.length) ? `[${s.categories.join(', ')}]` : '[未分类]'
    const title = s.title ? `「${s.title}」` : ''
    const sum = s.summary ? ` —— ${s.summary}` : ''
    return `- ${s.time || ''} ${cats} ${title}${sum}`.trim()
  }).join('\n')

  const catLines = (categories || []).map((c) => `- ${c.name}：${c.description || ''}`).join('\n')

  const statsLine = stats
    ? `截图 ${stats.totalScreenshots || 0} 张 · 时段 ${stats.totalSessions || 0} 个 · 活跃分类 ${stats.activeCategories || 0} 类 · 专注度 ${stats.focusScore || 0}%`
    : ''

  const prompt = [
    `你是一名个人效率顾问。下面是用户在 ${dateStr} 这一天的所有 10 分钟时段摘要（已由 AI 分析过），请基于这些摘要生成一份当日总结报告。`,
    '',
    statsLine ? `今日整体统计：${statsLine}` : '',
    '',
    catLines ? `当前分类配置：\n${catLines}` : '',
    '',
    '今日时段摘要清单：',
    slotLines,
    '',
    '请用 Markdown 格式输出一份精炼的中文报告，结构包含：',
    '1. **🎯 今日概览**：1~2 句话提炼整体状态',
    '2. **📊 时间分配**：按分类粗略归纳花了多少时段在什么上',
    '3. **✨ 主要成果**：今天做成了哪几件事（基于时段标题/摘要归并）',
    '4. **⚠️ 干扰与待优化**：发现了哪些非专注 / 频繁切换 / 中断的迹象',
    '5. **💡 明日建议**：3 条可执行的小建议',
    '',
    '注意：',
    '- 严格基于上面的时段摘要，不要编造没出现过的内容',
    '- 全文 300~600 字，简洁、具体、避免空话',
    '- 直接输出 Markdown，不要包裹在 ```代码块``` 中'
  ].filter(Boolean).join('\n')

  let content = ''
  if (provider.protocol === 'claude') {
    content = await callClaudeText(provider, prompt, { maxTokens: 1500 })
  } else {
    content = await callOpenAICompatChat(
      provider,
      [{ role: 'user', content: prompt }],
      { max_tokens: 1500 }
    )
  }
  content = stripCodeFence(content)
  if (!content) throw new Error('AI 返回了空报告')
  return { content, model: provider.model }
}

/**
 * 测试 provider 连通性（发一条最短文本）
 */
AIService.prototype.pingProvider = async function (provider) {
  if (!provider) return { ok: false, message: '未选择模型' }
  if (!provider.model) return { ok: false, message: '未配置模型 id' }
  if (provider.protocol === 'claude') {
    if (!provider.apiKey) return { ok: false, message: '未配置 API Key' }
    try {
      const client = new Anthropic({ apiKey: provider.apiKey, dangerouslyAllowBrowser: true })
      await client.messages.create({
        model: provider.model,
        max_tokens: 8,
        messages: [{ role: 'user', content: 'ping' }]
      })
      return { ok: true, message: '连接成功' }
    } catch (e) {
      return { ok: false, message: (e && e.message) || String(e) }
    }
  }
  // OpenAI 兼容
  try {
    await callOpenAICompatChat(
      provider,
      [{ role: 'user', content: 'ping' }],
      { max_tokens: 4 }
    )
    return { ok: true, message: '连接成功' }
  } catch (e) {
    return { ok: false, message: (e && e.message) || String(e) }
  }
}

/**
 * 拉取 provider 的可用模型列表（OpenAI 兼容服务支持 GET /models）
 */
AIService.prototype.listModelsByProvider = async function (provider) {
  if (!provider) return []
  if (provider.protocol === 'claude') {
    // Claude 没有公开 list models 接口，返回内置静态列表
    return CLAUDE_MODEL_OPTIONS
  }
  if (!provider.baseURL) return []
  try {
    const url = joinUrl(provider.baseURL, '/models')
    const headers = {}
    if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`
    const resp = await fetch(url, { method: 'GET', headers })
    if (!resp.ok) {
      // Ollama 还有专门的 /api/tags 接口
      if (provider.baseURL.includes('11434')) {
        const tagUrl = provider.baseURL.replace(/\/v1\/?$/, '') + '/api/tags'
        const r2 = await fetch(tagUrl)
        if (r2.ok) {
          const j2 = await r2.json()
          return (j2?.models || []).map((m) => ({ id: m.name || m.model, label: m.name || m.model }))
        }
      }
      return []
    }
    const data = await resp.json()
    const arr = data?.data || data?.models || []
    return arr.map((m) => ({
      id: m.id || m.model || m.name,
      label: m.id || m.model || m.name
    })).filter((m) => m.id)
  } catch (e) {
    console.warn('[FocusFlow] listModelsByProvider 失败：', e)
    return []
  }
}

export default AIService
export { AIService }