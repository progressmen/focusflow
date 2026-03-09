# FocusFlow 插件安装指南

## 📦 安装方式

### 方法一：开发模式安装

1. **克隆项目**
   ```bash
   git clone https://github.com/yourname/focusflow.git
   cd focusflow
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **开发模式运行**
   ```bash
   npm run dev
   ```

4. **在 uTools 中安装**
   - 打开 uTools
   - 点击右上角 "+" 按钮
   - 选择 "开发插件"
   - 选择项目目录
   - 点击 "安装"

### 方法二：构建后安装

1. **构建项目**
   ```bash
   npm run build
   ```

2. **打包插件**
   ```bash
   # 将整个项目文件夹压缩为 .zip
   zip -r focusflow.zip ./*
   ```

3. **在 uTools 中安装**
   - 打开 uTools
   - 点击右上角 "+" 按钮
   - 选择 "安装插件"
   - 选择 focusflow.zip 文件

## 🔧 首次配置

### 1. 设置 Claude API Key

1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 创建账户并获取 API Key
3. 在插件设置中输入 API Key
4. 点击 "保存 API Key"

### 2. 配置追踪选项

- **自动开始追踪**：插件启动时自动开始记录
- **通知提醒**：重要事件的通知提醒
- **检查间隔**：应用切换检测的频率（1-60秒）

## 🎯 使用指南

### 基本操作

1. **启动追踪**：点击 "开始追踪" 按钮
2. **查看统计**：实时查看使用时间、应用排行等
3. **生成报告**：点击 "AI 生成报告" 获取分析
4. **管理数据**：在设置中导出、导入或清除数据

### 快捷键

- `Alt + Space`：打开 uTools 搜索框
- 输入 "activity" 或 "活动追踪"：快速启动插件

### 数据解读

#### 统计指标

- **今日使用时间**：累计电脑使用时间
- **活跃应用**：当天使用过的应用数量
- **切换次数**：应用间切换的总次数
- **专注度**：基于长时间使用计算的专注度分数

#### AI 报告内容

- 时间使用效率评估
- 主要生产力应用分析
- 潜在干扰因素识别
- 个性化改进建议

## 🔍 故障排除

### 插件无法启动

1. **检查 uTools 版本**
   - 确保 uTools 版本 >= 3.0.0
   - 更新到最新版本

2. **检查开发环境**
   ```bash
   node --version  # 应该 >= 18.0.0
   npm --version   # 应该 >= 8.0.0
   ```

3. **重新安装依赖**
   ```bash
   rm -rf node_modules
   npm install
   ```

### AI 功能无法使用

1. **检查 API Key**
   - 确认 API Key 格式正确
   - 重新输入并保存

2. **检查网络连接**
   - 确保可以访问 Anthropic API
   - 尝试其他网络环境

3. **查看控制台错误**
   - 按 F12 打开开发者工具
   - 查看 Console 中的错误信息

### 数据丢失或异常

1. **检查存储权限**
   - 确保浏览器允许本地存储
   - 清除浏览器缓存后重试

2. **数据恢复**
   - 如果有备份，使用导入功能恢复
   - 检查 localStorage 中的数据

### 性能问题

1. **减少检测频率**
   - 在设置中增加检查间隔
   - 避免过频繁的应用检测

2. **清理历史数据**
   - 定期导出重要数据
   - 清除过期的历史记录

## 📞 获取帮助

### 在线资源

- [项目主页](https://github.com/yourname/focusflow)
- [问题反馈](https://github.com/yourname/focusflow/issues)
- [uTools 官方文档](https://u.tools/docs/developer/intro.html)

### 联系支持

- 邮箱：your.email@example.com
- GitHub：[@yourname](https://github.com/yourname)
- 微信群：FocusFlow 用户群

## 📝 更新日志

### v1.0.0 (2024-01-01)

- 🎉 首次发布
- ✨ 基础活动追踪功能
- 🤖 AI 智能分析
- 📊 数据可视化
- ⚙️ 设置面板
- 💾 数据导出导入

## 🔄 更新插件

### 自动更新

1. 在 uTools 插件管理中找到 FocusFlow
2. 点击 "检查更新"
3. 如有新版本，点击 "更新"

### 手动更新

1. 下载最新版本
2. 在 uTools 中卸载旧版本
3. 安装新版本
4. 导入之前导出的数据（可选）

---

**遇到问题？请查看故障排除部分或联系技术支持！** 🛠️