import Anthropic from '@anthropic-ai/sdk'

export class AIService {
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
}