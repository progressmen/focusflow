# FocusFlow - uTools 活动追踪插件

一个智能的电脑活动追踪工具，使用 Vue + Vite 开发，集成 AI 总结功能，帮助你了解和分析自己的电脑使用习惯。

## 🌟 功能特色

- **实时活动追踪**：自动记录应用使用时间和切换频率
- **数据可视化**：直观的图表展示使用统计
- **AI 智能分析**：使用 Claude API 生成个性化使用报告
- **专注度评估**：基于使用模式计算专注度分数
- **数据导出导入**：支持数据备份和迁移
- **隐私保护**：所有数据本地存储，不上传服务器

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn
- uTools 客户端

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建插件

```bash
npm run build
```

## 📁 项目结构

```
focusflow/
├── src/
│   ├── components/     # Vue 组件
│   │   ├── AppUsageChart.vue    # 使用统计图表
│   │   └── SettingsPanel.vue    # 设置面板
│   ├── services/       # 服务层
│   │   ├── ActivityTracker.js   # 活动追踪服务
│   │   └── AIService.js         # AI 分析服务
│   ├── utils/          # 工具函数
│   │   └── storage.js           # 存储工具
│   ├── App.vue         # 主应用组件
│   ├── main.js         # 应用入口
│   └── style.css       # 全局样式
├── public/            # 静态资源
├── plugin.json        # uTools 插件配置
├── preload.js         # 预加载脚本
├── index.html         # HTML 模板
├── vite.config.js     # Vite 配置
├── package.json       # 项目配置
└── README.md          # 项目文档
```

## 🔧 配置说明

### Claude API 配置

1. 访问 [Anthropic Console](https://console.anthropic.com/) 获取 API Key
2. 在插件设置中输入 API Key
3. 开始使用 AI 总结功能

### uTools 插件配置

编辑 `plugin.json` 文件：

```json
{
  "plugin": {
    "name": "FocusFlow 活动追踪",
    "description": "智能追踪电脑使用活动，AI生成使用总结报告",
    "icon": "assets/icon.png",
    "main": "index.html",
    "version": "1.0.0"
  },
  "features": [
    {
      "code": "focusflow",
      "explain": "打开 FocusFlow 主页",
      "cmds": ["focusFlow"]
    }
  ]
}
```

## 📊 数据模型

### 会话数据
```javascript
{
  app: "应用名称",
  start: 1640995200000,  // 开始时间戳
  end: 1640995260000,    // 结束时间戳
  duration: 60000,       // 持续时间（毫秒）
  date: "2023-12-31"    // 日期
}
```

### 每日统计
```javascript
{
  totalTime: 3600000,    // 总使用时间
  activeApps: 5,         // 活跃应用数量
  appSwitches: 20,       // 应用切换次数
  focusScore: 75         // 专注度分数
}
```

## 🔌 API 接口

### ActivityTracker

```javascript
const tracker = new ActivityTracker()

// 开始追踪
tracker.startTracking()

// 停止追踪
tracker.stopTracking()

// 获取今日统计
tracker.getTodayStats()

// 获取应用排行
tracker.getTopApps(10)

// 获取图表数据
tracker.getChartData()
```

### AIService

```javascript
const aiService = new AIService()

// 设置 API Key
aiService.setApiKey('your-api-key')

// 生成日报
aiService.generateReport(activityData)

// 生成周报
aiService.generateWeeklyReport(weeklyData)

// 获取改进建议
aiService.suggestImprovements(activityData)
```

## 🛠️ 开发指南

### 添加新功能

1. 在 `src/services/` 中创建新的服务类
2. 在 `src/components/` 中创建对应的 Vue 组件
3. 在主应用中集成新功能
4. 更新设置面板（如果需要配置选项）

### 自定义追踪规则

修改 `ActivityTracker.js` 中的追踪逻辑：

- 调整应用检测间隔
- 修改专注度计算算法
- 添加新的统计指标

### 扩展 AI 功能

在 `AIService.js` 中添加新的 AI 分析功能：

- 创建新的提示模板
- 添加不同的分析模型
- 扩展报告类型

## 🔒 隐私说明

- 所有活动数据仅在本地存储
- 不会上传任何使用数据到服务器
- AI 分析仅在需要时发送汇总数据
- 用户可以随时清除所有数据

## 📈 性能优化

- 使用本地存储减少网络请求
- 图表组件懒加载
- 数据更新使用防抖
- 内存使用优化

## 🐛 故障排除

### 常见问题

1. **插件无法启动**
   - 检查 uTools 版本是否最新
   - 确认开发环境配置正确

2. **AI 总结失败**
   - 检查 API Key 是否正确
   - 确认网络连接正常
   - 查看浏览器控制台错误信息

3. **数据丢失**
   - 使用导出功能定期备份
   - 检查浏览器存储权限

### 开发调试

```bash
# 开启详细日志
localStorage.setItem('debug', 'focusflow:*')

# 查看存储数据
localStorage.getItem('focusflow-data')
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

## 📄 许可证

MIT License

## 🆘 支持与反馈

- 项目主页：[GitHub](https://github.com/yourname/focusflow)
- 问题反馈：[Issues](https://github.com/yourname/focusflow/issues)
- 邮箱联系：your.email@example.com

---

**使用 FocusFlow，让每一次电脑使用都更有意义！** 🎯